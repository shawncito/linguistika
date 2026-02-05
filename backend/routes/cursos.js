import express from 'express';
import { supabaseAdmin, supabaseForToken } from '../supabase.js';
import { validateTutorCourseSchedule } from '../utils/scheduleValidator.js';

const router = express.Router();

function getDb(req) {
  return supabaseAdmin ?? supabaseForToken(req.accessToken);
}

function parseJsonMaybe(value) {
  if (value == null) return null;
  if (typeof value === 'object') return value;
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed);
  } catch {
    return null;
  }
}

function normalizeDiaKey(value) {
  if (value == null) return '';
  return String(value)
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function timeToMinutesSafe(time) {
  if (!time) return null;
  const [h, m] = String(time).split(':').map((n) => Number(n));
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return h * 60 + m;
}

function scheduleOverlaps(scheduleA, scheduleB) {
  const a = scheduleA ?? {};
  const b = scheduleB ?? {};

  const bKeyByNorm = {};
  for (const k of Object.keys(b)) {
    const nk = normalizeDiaKey(k);
    if (nk && !bKeyByNorm[nk]) bKeyByNorm[nk] = k;
  }

  const conflicts = [];
  for (const diaA of Object.keys(a)) {
    const diaNorm = normalizeDiaKey(diaA);
    const diaB = bKeyByNorm[diaNorm];
    if (!diaB) continue;

    const aHorario = a[diaA];
    const bHorario = b[diaB];
    const aStart = timeToMinutesSafe(aHorario?.hora_inicio);
    const aEnd = timeToMinutesSafe(aHorario?.hora_fin);
    const bStart = timeToMinutesSafe(bHorario?.hora_inicio);
    const bEnd = timeToMinutesSafe(bHorario?.hora_fin);

    if (aStart == null || aEnd == null || bStart == null || bEnd == null) continue;
    // Overlap si hay intersección real; permitir pegado exacto (fin == inicio)
    const overlap = aStart < bEnd && aEnd > bStart;
    if (overlap) {
      conflicts.push({
        dia: diaA,
        a: { hora_inicio: aHorario?.hora_inicio, hora_fin: aHorario?.hora_fin },
        b: { hora_inicio: bHorario?.hora_inicio, hora_fin: bHorario?.hora_fin }
      });
    }
  }

  return conflicts;
}

function validateTutorAptitudeForCourse(tutor, cursoNivel) {
  const nivel = String(cursoNivel ?? '').trim();
  if (!nivel || nivel === 'None') return { ok: true };

  const niveles = Array.isArray(tutor?.niveles_apto) ? tutor.niveles_apto : [];
  const specialized = !!tutor?.es_especializado || niveles.length > 0;

  if (!specialized) return { ok: true };
  if (!niveles.includes(nivel)) {
    return {
      ok: false,
      reason: `El tutor no está marcado como apto para el nivel ${nivel}`
    };
  }
  return { ok: true };
}

async function validateTutorNoCourseConflicts(db, tutorId, nextSchedule, excludeCursoId = null) {
  const { data: cursos, error } = await db
    .from('cursos')
    .select('id,nombre,nivel,dias_schedule,estado')
    .eq('tutor_id', tutorId)
    .order('created_at', { ascending: false });
  if (error) throw error;

  const conflicts = [];
  for (const c of cursos ?? []) {
    if (excludeCursoId != null && String(c.id) === String(excludeCursoId)) continue;
    if (c?.estado === false) continue;

    const otherSchedule = parseJsonMaybe(c.dias_schedule);
    if (!otherSchedule || Object.keys(otherSchedule).length === 0) continue;

    const overlaps = scheduleOverlaps(nextSchedule, otherSchedule);
    if (overlaps.length > 0) {
      conflicts.push({
        curso_id: c.id,
        curso_nombre: c.nombre,
        curso_nivel: c.nivel,
        overlaps
      });
    }
  }

  return conflicts;
}

function isForeignKeyViolation(err) {
  // Postgres FK violation code
  return String(err?.code ?? '') === '23503' || String(err?.message ?? '').toLowerCase().includes('foreign key');
}

function isMissingTableOrColumn(err) {
  const code = String(err?.code ?? '');
  const msg = String(err?.message ?? '').toLowerCase();
  return code === '42P01' || code === '42703' || msg.includes('does not exist') || msg.includes('column') && msg.includes('not found');
}

async function safeSelectIdsEq(db, table, idColumn, filterColumn, value) {
  try {
    const { data, error } = await db.from(table).select(idColumn).eq(filterColumn, value);
    if (error && !isMissingTableOrColumn(error)) throw error;
    return (data ?? []).map((r) => r?.[idColumn]).filter((v) => v != null);
  } catch (e) {
    if (!isMissingTableOrColumn(e)) throw e;
    return [];
  }
}

async function safeSelectIdsIn(db, table, idColumn, filterColumn, values) {
  const list = (values ?? []).filter((v) => v != null);
  if (list.length === 0) return [];
  try {
    const { data, error } = await db.from(table).select(idColumn).in(filterColumn, list);
    if (error && !isMissingTableOrColumn(error)) throw error;
    return (data ?? []).map((r) => r?.[idColumn]).filter((v) => v != null);
  } catch (e) {
    if (!isMissingTableOrColumn(e)) throw e;
    return [];
  }
}

async function countRefs(db, table, column, value) {
  try {
    const { count, error } = await db
      .from(table)
      .select(column, { count: 'exact', head: true })
      .eq(column, value);
    if (error) return null;
    return count ?? 0;
  } catch {
    return null;
  }
}

async function countRefsIn(db, table, column, values) {
  const list = (values ?? []).filter((v) => v != null);
  if (list.length === 0) return 0;
  try {
    const { count, error } = await db
      .from(table)
      .select(column, { count: 'exact', head: true })
      .in(column, list);
    if (error) return null;
    return count ?? 0;
  } catch {
    return null;
  }
}

async function getCursoDeleteBlockers(db, cursoId) {
  const matriculaIds = await safeSelectIdsEq(db, 'matriculas', 'id', 'curso_id', cursoId);
  const grupoIds = await safeSelectIdsEq(db, 'matriculas_grupo', 'id', 'curso_id', cursoId);
  const claseIds = await safeSelectIdsEq(db, 'clases', 'id', 'curso_id', cursoId);
  const claseIdsByMatricula = await safeSelectIdsIn(db, 'clases', 'id', 'matricula_id', matriculaIds);
  const allClaseIds = Array.from(new Set([...(claseIds ?? []), ...(claseIdsByMatricula ?? [])]));

  const blockers = {
    matriculas_grupo: await countRefs(db, 'matriculas_grupo', 'curso_id', cursoId),
    matriculas: await countRefs(db, 'matriculas', 'curso_id', cursoId),
    clases: await countRefs(db, 'clases', 'curso_id', cursoId),
    sesiones_clases: await countRefs(db, 'sesiones_clases', 'curso_id', cursoId),
    movimientos_financieros: await countRefs(db, 'movimientos_financieros', 'curso_id', cursoId),
    movimientos_dinero: await countRefs(db, 'movimientos_dinero', 'curso_id', cursoId),
  };

  // Bloqueos indirectos típicos (por clase/grupo/movimiento)
  const pagos = await countRefsIn(db, 'pagos', 'clase_id', allClaseIds);
  if (pagos != null && pagos > 0) blockers.pagos = pagos;

  const horas = await countRefsIn(db, 'horas_trabajo', 'clase_id', allClaseIds);
  if (horas != null && horas > 0) blockers.horas_trabajo = horas;

  const movsPorGrupo = await countRefsIn(db, 'movimientos_financieros', 'matricula_grupo_id', grupoIds);
  if (movsPorGrupo != null && movsPorGrupo > 0) blockers.movimientos_financieros_grupo = movsPorGrupo;

  const movsPorClase = await countRefsIn(db, 'movimientos_financieros', 'clase_id', allClaseIds);
  if (movsPorClase != null && movsPorClase > 0) blockers.movimientos_financieros_clase = movsPorClase;

  // limpiar nulls (si una tabla/col no existe o no hay permisos)
  for (const k of Object.keys(blockers)) {
    if (blockers[k] == null) delete blockers[k];
  }
  return blockers;
}

async function safeUpdateEq(db, table, patch, column, value) {
  try {
    const { error } = await db.from(table).update(patch).eq(column, value);
    if (error && !isMissingTableOrColumn(error)) throw error;
  } catch (e) {
    if (!isMissingTableOrColumn(e)) throw e;
  }
}

async function safeDeleteEq(db, table, column, value) {
  try {
    const { error } = await db.from(table).delete().eq(column, value);
    if (error && !isMissingTableOrColumn(error)) throw error;
  } catch (e) {
    if (!isMissingTableOrColumn(e)) throw e;
  }
}

async function safeDeleteIn(db, table, column, values) {
  const list = (values ?? []).filter((v) => v != null);
  if (list.length === 0) return;
  try {
    const { error } = await db.from(table).delete().in(column, list);
    if (error && !isMissingTableOrColumn(error)) throw error;
  } catch (e) {
    if (!isMissingTableOrColumn(e)) throw e;
  }
}

async function deleteGrupoCascade(db, grupoId) {
  const gid = Number(grupoId);
  if (!Number.isFinite(gid)) return;

  // estudiantes normales (si existe columna)
  await safeUpdateEq(db, 'estudiantes', { matricula_grupo_id: null, updated_at: new Date().toISOString() }, 'matricula_grupo_id', gid);
  // movimientos financieros (si existe tabla/col)
  await safeUpdateEq(db, 'movimientos_financieros', { matricula_grupo_id: null, updated_at: new Date().toISOString() }, 'matricula_grupo_id', gid);
  // links bulk (si existe) y grupo
  await safeDeleteEq(db, 'estudiantes_en_grupo', 'matricula_grupo_id', gid);
  await safeDeleteEq(db, 'matriculas_grupo', 'id', gid);
}

// GET - Listar todos los cursos
router.get('/', async (req, res) => {
  try {
    const db = getDb(req);
    const { data: cursos, error } = await db
      .from('cursos')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) throw error;

    // Parse JSON fields y convertir estado a número
    const cursosResponse = cursos.map(c => ({
      ...c,
      dias: c.dias ? JSON.parse(c.dias) : null,
      dias_turno: c.dias_turno ? JSON.parse(c.dias_turno) : null,
      dias_schedule: c.dias_schedule ? JSON.parse(c.dias_schedule) : null,
      grado_activo: c.grado_activo,
      grado_nombre: c.grado_nombre,
      grado_color: c.grado_color,
      tutor_id: c.tutor_id,
      estado: c.estado ? 1 : 0
    }));

    res.json(cursosResponse);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET - Obtener un curso por ID
router.get('/:id', async (req, res) => {
  try {
    const db = getDb(req);
    const { data: curso, error } = await db
      .from('cursos')
      .select('*')
      .eq('id', req.params.id)
      .maybeSingle();

    if (error) throw error;
    if (!curso) {
      return res.status(404).json({ error: 'Curso no encontrado' });
    }

    // Parse JSON fields
    const cursoResponse = {
      ...curso,
      dias: curso.dias ? JSON.parse(curso.dias) : null,
      dias_turno: curso.dias_turno ? JSON.parse(curso.dias_turno) : null,
      dias_schedule: curso.dias_schedule ? JSON.parse(curso.dias_schedule) : null,
      grado_activo: curso.grado_activo,
      grado_nombre: curso.grado_nombre,
      grado_color: curso.grado_color,
      tutor_id: curso.tutor_id
    };

    res.json(cursoResponse);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST - Crear nuevo curso
router.post('/', async (req, res) => {
  try {
    const db = getDb(req);
    const { 
      nombre, descripcion, nivel, max_estudiantes = null,
      tipo_clase = 'grupal', dias = null, dias_turno = null, dias_schedule = null,
      costo_curso = 0, pago_tutor = 0,
      tipo_pago = 'sesion',
      grado_activo = false, grado_nombre = null, grado_color = null,
      tutor_id = null
    } = req.body;
    const userId = req.user?.id;
    
    if (!nombre) {
      return res.status(400).json({ error: 'Campo requerido: nombre' });
    }

    // Si se proporciona tutor_id, validar SIEMPRE: aptitud + compatibilidad + no-conflicto
    if (tutor_id) {
      const scheduleObj = typeof dias_schedule === 'string' ? parseJsonMaybe(dias_schedule) : dias_schedule;
      if (!scheduleObj || Object.keys(scheduleObj).length === 0) {
        return res.status(400).json({
          error: 'No se puede asignar tutor sin horario (dias_schedule) definido'
        });
      }

      const { data: tutor, error: tutorError } = await db
        .from('tutores')
        .select('*')
        .eq('id', tutor_id)
        .maybeSingle();
      
      if (tutorError || !tutor) {
        return res.status(404).json({ error: 'Tutor no encontrado' });
      }

      const aptitude = validateTutorAptitudeForCourse(tutor, nivel);
      if (!aptitude.ok) {
        return res.status(409).json({
          error: 'Tutor no apto para este curso',
          code: 'TUTOR_NOT_APTO',
          details: [aptitude.reason]
        });
      }

      // Validar compatibilidad de horarios
      const tutorObj = {
        ...tutor,
        dias_horarios: tutor.dias_horarios // Ya viene como objeto desde Supabase JSONB
      };
      const cursoObj = {
        dias_schedule: scheduleObj,
        dias_turno: dias_turno
      };

      const validation = validateTutorCourseSchedule(tutorObj, cursoObj);
      if (!validation.compatible) {
        return res.status(409).json({
          error: 'Horarios incompatibles',
          code: 'TUTOR_SCHEDULE_INCOMPATIBLE',
          details: validation.issues
        });
      }

      const scheduleConflicts = await validateTutorNoCourseConflicts(db, tutor_id, scheduleObj, null);
      if (scheduleConflicts.length > 0) {
        return res.status(409).json({
          error: 'Choque de horario: este tutor ya tiene otro curso en esa franja',
          code: 'TUTOR_SCHEDULE_CONFLICT',
          conflicts: scheduleConflicts
        });
      }
    }

    // Si es tutoría, max_estudiantes debe ser null
    const maxEstudiantes = tipo_clase === 'tutoria' ? null : (max_estudiantes || 10);

    const { data: curso, error } = await db
      .from('cursos')
      .insert({
        nombre,
        descripcion,
        nivel: nivel || 'None',
        max_estudiantes: maxEstudiantes,
        tipo_clase,
        tipo_pago,
        dias: dias ? JSON.stringify(dias) : null,
        dias_schedule: dias_schedule ? JSON.stringify(dias_schedule) : null,
        costo_curso: parseFloat(costo_curso) || 0,
        pago_tutor: parseFloat(pago_tutor) || 0,
        grado_activo: !!grado_activo,
        grado_nombre: grado_nombre || null,
        grado_color: grado_color || null,
        tutor_id: tutor_id || null,
        created_by: userId,
        estado: true
      })
      .select()
      .single();
    
    if (error) {
      console.error('Error en Supabase:', error);
      throw error;
    }

    // Parse JSON fields for response
    const cursoResponse = {
      ...curso,
      dias: curso.dias ? JSON.parse(curso.dias) : null,
      dias_turno: curso.dias_turno ? JSON.parse(curso.dias_turno) : null,
      dias_schedule: curso.dias_schedule ? JSON.parse(curso.dias_schedule) : null,
      tipo_pago: curso.tipo_pago,
      grado_activo: curso.grado_activo,
      grado_nombre: curso.grado_nombre,
      grado_color: curso.grado_color,
      tutor_id: curso.tutor_id
    };

    res.status(201).json(cursoResponse);
  } catch (error) {
    console.error('Error al crear curso:', error);
    res.status(500).json({ error: error.message });
  }
});

// PUT - Actualizar curso
router.put('/:id', async (req, res) => {
  try {
    const db = getDb(req);
    const userId = req.user?.id;

    // Necesitamos el estado actual para validar (tutor_id/horario/nivel) incluso si no vienen en el body
    const { data: existingCurso, error: existingErr } = await db
      .from('cursos')
      .select('id,nombre,nivel,tutor_id,dias_schedule,dias_turno')
      .eq('id', req.params.id)
      .maybeSingle();
    if (existingErr) throw existingErr;
    if (!existingCurso) {
      return res.status(404).json({ error: 'Curso no encontrado' });
    }
    
    // Construir objeto de actualización solo con campos presentes
    const updateData = {
      updated_by: userId,
      updated_at: new Date().toISOString()
    };

    if (req.body.nombre !== undefined) updateData.nombre = req.body.nombre;
    if (req.body.descripcion !== undefined) updateData.descripcion = req.body.descripcion;
    if (req.body.nivel !== undefined) updateData.nivel = req.body.nivel;
    if (req.body.tipo_clase !== undefined) updateData.tipo_clase = req.body.tipo_clase;
    
    // Si es tutoría, max_estudiantes debe ser null
    if (req.body.max_estudiantes !== undefined) {
      updateData.max_estudiantes = req.body.tipo_clase === 'tutoria' ? null : req.body.max_estudiantes;
    }
    
    if (req.body.dias !== undefined) updateData.dias = req.body.dias ? JSON.stringify(req.body.dias) : null;
    if (req.body.dias_schedule !== undefined) updateData.dias_schedule = req.body.dias_schedule ? JSON.stringify(req.body.dias_schedule) : null;
    if (req.body.costo_curso !== undefined) updateData.costo_curso = parseFloat(req.body.costo_curso) || 0;
    if (req.body.pago_tutor !== undefined) updateData.pago_tutor = parseFloat(req.body.pago_tutor) || 0;
    if (req.body.tipo_pago !== undefined) updateData.tipo_pago = req.body.tipo_pago;
    if (req.body.grado_activo !== undefined) updateData.grado_activo = !!req.body.grado_activo;
    if (req.body.grado_nombre !== undefined) updateData.grado_nombre = req.body.grado_nombre || null;
    if (req.body.grado_color !== undefined) updateData.grado_color = req.body.grado_color || null;
    if (req.body.tutor_id !== undefined) updateData.tutor_id = req.body.tutor_id || null;
    if (req.body.estado !== undefined) updateData.estado = req.body.estado === 1 || req.body.estado === true;

    // Validación obligatoria si el curso queda con tutor asignado
    const nextTutorId = req.body.tutor_id !== undefined ? (req.body.tutor_id || null) : (existingCurso.tutor_id ?? null);
    const nextNivel = req.body.nivel !== undefined ? req.body.nivel : existingCurso.nivel;
    const nextSchedule = req.body.dias_schedule !== undefined
      ? (typeof req.body.dias_schedule === 'string' ? parseJsonMaybe(req.body.dias_schedule) : (req.body.dias_schedule || null))
      : parseJsonMaybe(existingCurso.dias_schedule);

    if (nextTutorId) {
      if (!nextSchedule || Object.keys(nextSchedule).length === 0) {
        return res.status(400).json({
          error: 'No se puede asignar tutor sin horario (dias_schedule) definido'
        });
      }

      const { data: tutor, error: tutorError } = await db
        .from('tutores')
        .select('*')
        .eq('id', nextTutorId)
        .maybeSingle();
      if (tutorError || !tutor) {
        return res.status(404).json({ error: 'Tutor no encontrado' });
      }

      const aptitude = validateTutorAptitudeForCourse(tutor, nextNivel);
      if (!aptitude.ok) {
        return res.status(409).json({
          error: 'Tutor no apto para este curso',
          code: 'TUTOR_NOT_APTO',
          details: [aptitude.reason]
        });
      }

      const tutorObj = { ...tutor, dias_horarios: tutor.dias_horarios };
      const cursoObj = { dias_schedule: nextSchedule, dias_turno: parseJsonMaybe(existingCurso.dias_turno) };
      const validation = validateTutorCourseSchedule(tutorObj, cursoObj);
      if (!validation.compatible) {
        return res.status(409).json({
          error: 'Horarios incompatibles',
          code: 'TUTOR_SCHEDULE_INCOMPATIBLE',
          details: validation.issues
        });
      }

      const scheduleConflicts = await validateTutorNoCourseConflicts(db, nextTutorId, nextSchedule, req.params.id);
      if (scheduleConflicts.length > 0) {
        return res.status(409).json({
          error: 'Choque de horario: este tutor ya tiene otro curso en esa franja',
          code: 'TUTOR_SCHEDULE_CONFLICT',
          conflicts: scheduleConflicts
        });
      }
    }

    const { data: curso, error } = await db
      .from('cursos')
      .update(updateData)
      .eq('id', req.params.id)
      .select()
      .single();
    
    if (error) throw error;

    // Parse JSON fields for response y convertir estado a número
    const cursoResponse = {
      ...curso,
      dias: curso.dias ? JSON.parse(curso.dias) : null,
      dias_turno: curso.dias_turno ? JSON.parse(curso.dias_turno) : null,
      dias_schedule: curso.dias_schedule ? JSON.parse(curso.dias_schedule) : null,
      tipo_pago: curso.tipo_pago,
      grado_activo: curso.grado_activo,
      grado_nombre: curso.grado_nombre,
      grado_color: curso.grado_color,
      tutor_id: curso.tutor_id,
      estado: curso.estado ? 1 : 0
    };

    res.json(cursoResponse);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE - Eliminar curso permanentemente
router.delete('/:id', async (req, res) => {
  try {
    const db = getDb(req);
    const id = req.params.id;
    const cascade = ['1', 'true', 'yes', 'si'].includes(String(req.query?.cascade ?? '').toLowerCase());

    if (cascade) {
      try {
        // IDs relacionados (para poder limpiar dependencias por IN)
        const grupoIds = await safeSelectIdsEq(db, 'matriculas_grupo', 'id', 'curso_id', id);
        const matriculaIds = await safeSelectIdsEq(db, 'matriculas', 'id', 'curso_id', id);
        const claseIdsDirect = await safeSelectIdsEq(db, 'clases', 'id', 'curso_id', id);
        const claseIdsByMatricula = await safeSelectIdsIn(db, 'clases', 'id', 'matricula_id', matriculaIds);
        const claseIds = Array.from(new Set([...(claseIdsDirect ?? []), ...(claseIdsByMatricula ?? [])]));

        // 0) limpiar movimientos/artefactos que bloquean el borrado de clases/grupos/matrículas
        // - Pagos/Horas trabajo dependen de clases
        await safeDeleteIn(db, 'pagos', 'clase_id', claseIds);
        await safeDeleteIn(db, 'horas_trabajo', 'clase_id', claseIds);

        // - Movimientos (dos esquemas conviven: movimientos_financieros y movimientos_dinero)
        //   a) movimientos_dinero apunta directo a curso_id/matricula_id/sesion_id
        await safeDeleteEq(db, 'movimientos_dinero', 'curso_id', id);
        await safeDeleteIn(db, 'movimientos_dinero', 'matricula_id', matriculaIds);

        //   b) movimientos_financieros puede apuntar a curso/grupo/clase
        const mfIdsByCurso = await safeSelectIdsEq(db, 'movimientos_financieros', 'id', 'curso_id', id);
        const mfIdsByGrupo = await safeSelectIdsIn(db, 'movimientos_financieros', 'id', 'matricula_grupo_id', grupoIds);
        const mfIdsByClase = await safeSelectIdsIn(db, 'movimientos_financieros', 'id', 'clase_id', claseIds);
        const mfIds = Array.from(new Set([...(mfIdsByCurso ?? []), ...(mfIdsByGrupo ?? []), ...(mfIdsByClase ?? [])]));

        // comprobantes_ingresos depende de movimientos_financieros
        await safeDeleteIn(db, 'comprobantes_ingresos', 'movimiento_financiero_id', mfIds);
        // ahora sí, borrar movimientos_financieros
        await safeDeleteEq(db, 'movimientos_financieros', 'curso_id', id);
        await safeDeleteIn(db, 'movimientos_financieros', 'matricula_grupo_id', grupoIds);
        await safeDeleteIn(db, 'movimientos_financieros', 'clase_id', claseIds);

        // 1) borrar grupos asociados al curso
        try {
          const { data: grupos, error: gErr } = await db.from('matriculas_grupo').select('id').eq('curso_id', id);
          if (gErr && !isMissingTableOrColumn(gErr)) throw gErr;
          for (const g of grupos ?? []) {
            await deleteGrupoCascade(db, g.id);
          }
        } catch (e) {
          if (!isMissingTableOrColumn(e)) throw e;
        }

        // 2) borrar clases (directas y/o por matrícula)
        await safeDeleteEq(db, 'clases', 'curso_id', id);
        await safeDeleteIn(db, 'clases', 'matricula_id', matriculaIds);

        // 2.1) borrar sesiones_clases (si se usa agenda por sesiones)
        await safeDeleteEq(db, 'sesiones_clases', 'curso_id', id);

        // 3) borrar matrículas por curso_id
        await safeDeleteEq(db, 'matriculas', 'curso_id', id);
      } catch (e) {
        if (isForeignKeyViolation(e)) {
          const blockers = await getCursoDeleteBlockers(db, id);
          const detailsParts = [];
          if (blockers.matriculas_grupo) detailsParts.push(`grupos: ${blockers.matriculas_grupo}`);
          if (blockers.matriculas) detailsParts.push(`matrículas: ${blockers.matriculas}`);
          if (blockers.clases) detailsParts.push(`clases: ${blockers.clases}`);
          if (blockers.sesiones_clases) detailsParts.push(`sesiones: ${blockers.sesiones_clases}`);
          if (blockers.movimientos_financieros) detailsParts.push(`movimientos_fin: ${blockers.movimientos_financieros}`);
          if (blockers.movimientos_dinero) detailsParts.push(`movimientos_dinero: ${blockers.movimientos_dinero}`);
          if (blockers.pagos) detailsParts.push(`pagos: ${blockers.pagos}`);
          if (blockers.horas_trabajo) detailsParts.push(`horas_trabajo: ${blockers.horas_trabajo}`);

          return res.status(409).json({
            error: `No se pudo eliminar en cascada: aún hay dependencias (${detailsParts.join(', ') || 'desconocidas'}).`,
            blockers,
            cleanup_attempted: true,
            details: String(e?.message ?? e),
          });
        }
        throw e;
      }
    }

    const { data: deleted, error } = await db
      .from('cursos')
      .delete()
      .eq('id', id)
      .select('id')
      .maybeSingle();

    if (error) {
      if (isForeignKeyViolation(error)) {
        const blockers = await getCursoDeleteBlockers(db, id);
        const hasKnownBlockers = Object.keys(blockers).length > 0;
        const detailsParts = [];
        if (blockers.matriculas_grupo) detailsParts.push(`grupos: ${blockers.matriculas_grupo}`);
        if (blockers.matriculas) detailsParts.push(`matrículas: ${blockers.matriculas}`);
        if (blockers.clases) detailsParts.push(`clases: ${blockers.clases}`);
        if (blockers.sesiones_clases) detailsParts.push(`sesiones: ${blockers.sesiones_clases}`);
        if (blockers.movimientos_financieros) detailsParts.push(`movimientos_fin: ${blockers.movimientos_financieros}`);
        if (blockers.movimientos_dinero) detailsParts.push(`movimientos_dinero: ${blockers.movimientos_dinero}`);
        if (blockers.pagos) detailsParts.push(`pagos: ${blockers.pagos}`);
        if (blockers.horas_trabajo) detailsParts.push(`horas_trabajo: ${blockers.horas_trabajo}`);

        return res.status(409).json({
          error: hasKnownBlockers
            ? `No se puede eliminar el curso porque está en uso (${detailsParts.join(', ')}). Elimina esos registros primero o inactiva el curso.`
            : 'No se puede eliminar el curso porque está siendo usado en otros registros. Elimina primero los registros relacionados o inactiva el curso.',
          blockers,
          cleanup_attempted: cascade,
          details: error.message,
        });
      }
      throw error;
    }

    if (!deleted) return res.status(404).json({ error: 'Curso no encontrado' });
    res.json({ message: 'Curso eliminado correctamente' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;

