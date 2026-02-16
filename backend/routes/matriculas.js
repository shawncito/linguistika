import express from 'express';
import { randomUUID } from 'crypto';
import { supabase, supabaseAdmin, supabaseForToken } from '../supabase.js';

const router = express.Router();

function getDb(req) {
  return supabaseAdmin ?? supabaseForToken(req.accessToken);
}

function isNotFoundSingleError(err) {
  const msg = String(err?.message ?? '').toLowerCase();
  return msg.includes('json object requested') && msg.includes('no) rows returned');
}

// GET - Listar todas las matrículas
router.get('/', async (req, res) => {
  try {
    const db = getDb(req);
    const { data: matriculas, error } = await db
      .from('matriculas')
      .select(`
        *,
        estudiantes:estudiante_id (nombre),
        cursos:curso_id (nombre, metodo, dias_turno, dias_schedule, tipo_clase, tipo_pago, max_estudiantes, grado_activo, grado_nombre, grado_color, costo_curso, pago_tutor),
        tutores:tutor_id (nombre, tarifa_por_hora)
      `)
      .eq('estado', true)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    
    // Reformatear respuesta para compatibilidad
    const formatted = matriculas.map(m => ({
      ...m,
      estudiante_nombre: m.estudiantes?.nombre,
      curso_nombre: m.cursos?.nombre,
      tutor_nombre: m.tutores?.nombre,
      tarifa_por_hora: m.tutores?.tarifa_por_hora,
      es_grupo: m.es_grupo,
      grupo_id: m.grupo_id,
      grupo_nombre: m.grupo_nombre,
      curso_dias_turno: m.cursos?.dias_turno || null,
      curso_dias_schedule: m.cursos?.dias_schedule || null,
      curso_tipo_clase: m.cursos?.tipo_clase || null,
      curso_tipo_pago: m.cursos?.tipo_pago || null,
      curso_metodo: m.cursos?.metodo || null,
      curso_max_estudiantes: m.cursos?.max_estudiantes || null,
      curso_grado_activo: m.cursos?.grado_activo || null,
      curso_grado_nombre: m.cursos?.grado_nombre || null,
      curso_grado_color: m.cursos?.grado_color || null,
      curso_costo_curso: m.cursos?.costo_curso || null,
      curso_pago_tutor: m.cursos?.pago_tutor || null
    }));
    
    res.json(formatted);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET - Obtener una matrícula por ID
router.get('/:id', async (req, res) => {
  try {
    const db = getDb(req);
    const { data: matricula, error } = await db
      .from('matriculas')
      .select(`
        *,
        estudiantes:estudiante_id (nombre),
        cursos:curso_id (nombre, metodo, dias_turno, dias_schedule, tipo_clase, tipo_pago, max_estudiantes, grado_activo, grado_nombre, grado_color, costo_curso, pago_tutor),
        tutores:tutor_id (nombre, tarifa_por_hora)
      `)
      .eq('id', req.params.id)
      .single();

    if (error) {
      if (isNotFoundSingleError(error)) return res.status(404).json({ error: 'Matrícula no encontrada' });
      throw error;
    }
    if (!matricula) {
      return res.status(404).json({ error: 'Matrícula no encontrada' });
    }
    
    // Reformatear respuesta
    const formatted = {
      ...matricula,
      estudiante_nombre: matricula.estudiantes?.nombre,
      curso_nombre: matricula.cursos?.nombre,
      tutor_nombre: matricula.tutores?.nombre,
      tarifa_por_hora: matricula.tutores?.tarifa_por_hora,
      es_grupo: matricula.es_grupo,
      grupo_id: matricula.grupo_id,
      grupo_nombre: matricula.grupo_nombre,
      curso_dias_turno: matricula.cursos?.dias_turno || null,
      curso_dias_schedule: matricula.cursos?.dias_schedule || null,
      curso_tipo_clase: matricula.cursos?.tipo_clase || null,
      curso_tipo_pago: matricula.cursos?.tipo_pago || null,
      curso_metodo: matricula.cursos?.metodo || null,
      curso_max_estudiantes: matricula.cursos?.max_estudiantes || null,
      curso_grado_activo: matricula.cursos?.grado_activo || null,
      curso_grado_nombre: matricula.cursos?.grado_nombre || null,
      curso_grado_color: matricula.cursos?.grado_color || null,
      curso_costo_curso: matricula.cursos?.costo_curso || null,
      curso_pago_tutor: matricula.cursos?.pago_tutor || null
    };
    
    res.json(formatted);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST - Crear nueva matrícula
router.post('/', async (req, res) => {
  try {
    const db = getDb(req);
    const { estudiante_id, estudiante_ids, curso_id, tutor_id, es_grupo = false, grupo_id = null, grupo_nombre = null } = req.body;
    const userId = req.user?.id;
    
    if ((!estudiante_id && !Array.isArray(estudiante_ids)) || !curso_id || !tutor_id) {
      return res.status(400).json({ error: 'Campos requeridos: estudiante_id o estudiante_ids, curso_id, tutor_id' });
    }

    // Verificar que estudiante, curso y tutor existan
    const [cursoCheck, tutorCheck] = await Promise.all([
      db.from('cursos').select('id, estado, activo_para_matricula').eq('id', curso_id).maybeSingle(),
      db.from('tutores').select('id, estado').eq('id', tutor_id).maybeSingle()
    ]);

    if (cursoCheck.error || tutorCheck.error) {
      return res.status(400).json({ error: 'Curso o tutor no existen' });
    }

    if (!cursoCheck.data || !tutorCheck.data) {
      return res.status(400).json({ error: 'Curso o tutor no existen' });
    }

    // Verificar que el curso esté activo y disponible para matrícula
    if (cursoCheck.data.estado === false) {
      return res.status(409).json({ error: 'El curso está inactivo. Actívalo para poder matricular.' });
    }
    if (cursoCheck.data.activo_para_matricula === false) {
      return res.status(409).json({ error: 'El curso no está activo para matrícula.' });
    }

    if (tutorCheck.data.estado === false) {
      return res.status(409).json({ error: 'El tutor está inactivo. Actívalo para poder matricular.' });
    }

    // Normalizar lista de estudiantes
    let listaEstudiantes = [];
    if (Array.isArray(estudiante_ids) && estudiante_ids.length > 0) {
      listaEstudiantes = estudiante_ids.map((x) => parseInt(x)).filter((x) => !!x);
    } else if (estudiante_id) {
      listaEstudiantes = [parseInt(estudiante_id)];
    }
    if (!listaEstudiantes.length) {
      return res.status(400).json({ error: 'No se recibieron estudiantes' });
    }

    // Validar existencia de los estudiantes
    const { data: estRows, error: estErr } = await db
      .from('estudiantes')
      .select('id')
      .in('id', listaEstudiantes);
    if (estErr) throw estErr;
    const existentes = new Set((estRows || []).map((r) => r.id));
    const faltantes = listaEstudiantes.filter((id) => !existentes.has(id));
    if (faltantes.length > 0) {
      return res.status(400).json({ error: `Estudiantes no encontrados: ${faltantes.join(', ')}` });
    }

    // Determinar si es grupo
    const esGrupo = !!es_grupo || listaEstudiantes.length > 1;
    
    if (esGrupo) {
      // UNA SOLA matrícula grupal con array de estudiantes
      const registro = {
        estudiante_id: null,
        estudiante_ids: listaEstudiantes,
        curso_id,
        tutor_id,
        es_grupo: true,
        grupo_id: grupo_id || randomUUID(),
        grupo_nombre: grupo_nombre || null,
        created_by: userId,
        estado: true
      };

      const { data: nueva, error } = await db
        .from('matriculas')
        .insert([registro])
        .select(`
          *,
          cursos:curso_id (nombre),
          tutores:tutor_id (nombre)
        `);
      if (error) throw error;

      const m = nueva[0];
      
      // Obtener nombres de estudiantes para respuesta
      const { data: estRows } = await db
        .from('estudiantes')
        .select('id, nombre')
        .in('id', listaEstudiantes);
      
      const formatted = {
        ...m,
        curso_nombre: m.cursos?.nombre,
        tutor_nombre: m.tutores?.nombre,
        es_grupo: true,
        grupo_id: m.grupo_id,
        grupo_nombre: m.grupo_nombre,
        estudiante_ids: m.estudiante_ids,
        estudiantes_detalle: estRows || []
      };

      res.status(201).json(formatted);
    } else {
      // UNA matrícula individual
      const registro = {
        estudiante_id: listaEstudiantes[0],
        estudiante_ids: null,
        curso_id,
        tutor_id,
        es_grupo: false,
        grupo_id: null,
        grupo_nombre: null,
        created_by: userId,
        estado: true
      };

      const { data: nueva, error } = await db
        .from('matriculas')
        .insert([registro])
        .select(`
          *,
          estudiantes:estudiante_id (nombre),
          cursos:curso_id (nombre),
          tutores:tutor_id (nombre)
        `);
      if (error) throw error;

      const m = nueva[0];
      const formatted = {
        ...m,
        estudiante_nombre: m.estudiantes?.nombre,
        curso_nombre: m.cursos?.nombre,
        tutor_nombre: m.tutores?.nombre,
        es_grupo: false
      };

      res.status(201).json(formatted);
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT - Actualizar matrícula
router.put('/:id', async (req, res) => {
  try {
    const db = getDb(req);
    const { estudiante_id, curso_id, tutor_id, estado, es_grupo = false, grupo_id = null, grupo_nombre = null } = req.body;
    const userId = req.user?.id;

    const { data: matricula, error } = await db
      .from('matriculas')
      .update({
        estudiante_id,
        curso_id,
        tutor_id,
        estado,
        es_grupo: !!es_grupo,
        grupo_id: grupo_id || randomUUID(),
        grupo_nombre: grupo_nombre || null,
        updated_by: userId,
        updated_at: new Date().toISOString()
      })
      .eq('id', req.params.id)
      .select(`
        *,
        estudiantes:estudiante_id (nombre),
        cursos:curso_id (nombre),
        tutores:tutor_id (nombre)
      `)
      .single();
    
    if (error) throw error;
    
    const formatted = {
      ...matricula,
      estudiante_nombre: matricula.estudiantes?.nombre,
      curso_nombre: matricula.cursos?.nombre,
      tutor_nombre: matricula.tutores?.nombre,
      es_grupo: matricula.es_grupo,
      grupo_id: matricula.grupo_id,
      grupo_nombre: matricula.grupo_nombre
    };
    
    res.json(formatted);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST - Crear matrícula grupal desde un grupo importado (bulk)
// Convierte estudiantes_bulk -> estudiantes (si no existen) y crea UNA matrícula con estudiante_ids[]
router.post('/from-bulk-grupo', async (req, res) => {
  try {
    const userId = req.user?.id;
    const { matricula_grupo_id, grupo_nombre } = req.body ?? {};

    // Importante: usar un cliente con permisos (service role o JWT) porque estas rutas
    // corren detrás de requireAuth y pueden estar protegidas por RLS.
    const db = supabaseAdmin ?? (req.accessToken ? supabaseForToken(req.accessToken) : supabase);

    const gid = String(matricula_grupo_id ?? '').trim();
    if (!gid) {
      return res.status(400).json({ error: 'matricula_grupo_id requerido' });
    }

    const { data: grupo, error: gErr } = await db
      .from('matriculas_grupo')
      .select('id, curso_id, tutor_id, nombre_grupo, estado')
      .eq('id', gid)
      .maybeSingle();
    if (gErr) throw gErr;
    if (!grupo) return res.status(404).json({ error: 'Grupo no encontrado' });

    const [{ data: links, error: lErr }, { data: normales, error: nErr }] = await Promise.all([
      db
        .from('estudiantes_en_grupo')
        .select('estudiante_bulk_id')
        .eq('matricula_grupo_id', gid),
      // Soporte: estudiantes ya "vinculados" al grupo por columna matricula_grupo_id (si existe)
      db
        .from('estudiantes')
        .select('id, nombre, email, telefono, estado')
        .eq('matricula_grupo_id', Number(gid)),
    ]);

    // Si la columna matricula_grupo_id no existe, Supabase devolverá error; degradamos a []
    if (nErr && !(String(nErr.message || '').toLowerCase().includes('column') && String(nErr.message || '').toLowerCase().includes('matricula_grupo_id'))) {
      throw nErr;
    }
    if (lErr) throw lErr;

    const bulkIds = (links ?? []).map((x) => x.estudiante_bulk_id).filter(Boolean);

    const { data: bulkStudents, error: bErr } = bulkIds.length
      ? await db
          .from('estudiantes_bulk')
          .select('id, nombre, correo, telefono, estado')
          .in('id', bulkIds)
      : { data: [], error: null };
    if (bErr) throw bErr;

    const normalIds = Array.from(new Set((normales ?? []).map((s) => s?.id).filter(Boolean)));
    if (!bulkIds.length && !normalIds.length) {
      return res.status(400).json({ error: 'Este grupo no tiene estudiantes adjuntos.' });
    }

    // Mapear existentes por email/teléfono para evitar duplicados
    const emails = Array.from(new Set((bulkStudents ?? []).map((s) => String(s.correo ?? '').trim()).filter(Boolean)));
    const phones = Array.from(new Set((bulkStudents ?? []).map((s) => String(s.telefono ?? '').trim()).filter(Boolean)));

    const [{ data: existingByEmail, error: eEmailErr }, { data: existingByPhone, error: ePhoneErr }] = await Promise.all([
      emails.length ? db.from('estudiantes').select('id, email').in('email', emails) : Promise.resolve({ data: [], error: null }),
      phones.length ? db.from('estudiantes').select('id, telefono').in('telefono', phones) : Promise.resolve({ data: [], error: null }),
    ]);
    if (eEmailErr) throw eEmailErr;
    if (ePhoneErr) throw ePhoneErr;

    const emailToId = new Map((existingByEmail ?? []).map((r) => [String(r.email ?? '').trim().toLowerCase(), r.id]));
    const phoneToId = new Map((existingByPhone ?? []).map((r) => [String(r.telefono ?? '').trim(), r.id]));

    const createdStudentIds = [];
    // Incluir estudiantes ya vinculados (normales)
    for (const nid of normalIds) createdStudentIds.push(nid);
    for (const s of bulkStudents ?? []) {
      const email = String(s.correo ?? '').trim();
      const phone = String(s.telefono ?? '').trim();
      const emailKey = email ? email.toLowerCase() : '';

      let estudianteId = null;
      if (emailKey && emailToId.has(emailKey)) estudianteId = emailToId.get(emailKey);
      if (!estudianteId && phone && phoneToId.has(phone)) estudianteId = phoneToId.get(phone);

      if (!estudianteId) {
        const { data: created, error: cErr } = await db
          .from('estudiantes')
          .insert({
            nombre: String(s.nombre ?? '').trim(),
            email: email || null,
            telefono: phone || null,
            grado: null,
            dias: null,
            turno: null,
            dias_turno: null,
            created_by: userId,
            estado: true,
          })
          .select('id, email, telefono')
          .single();
        if (cErr) throw cErr;
        estudianteId = created.id;
        if (created.email) emailToId.set(String(created.email).trim().toLowerCase(), created.id);
        if (created.telefono) phoneToId.set(String(created.telefono).trim(), created.id);
      }

      if (estudianteId) createdStudentIds.push(estudianteId);
    }

    const uniqueStudentIds = Array.from(new Set(createdStudentIds.filter(Boolean)));
    if (!uniqueStudentIds.length) {
      return res.status(400).json({ error: 'No se pudieron convertir estudiantes del grupo.' });
    }

    const registro = {
      estudiante_id: null,
      estudiante_ids: uniqueStudentIds,
      curso_id: grupo.curso_id,
      tutor_id: grupo.tutor_id,
      es_grupo: true,
      grupo_id: randomUUID(),
      grupo_nombre: (grupo_nombre ?? grupo.nombre_grupo ?? null) ? String(grupo_nombre ?? grupo.nombre_grupo).trim() : null,
      created_by: userId,
      estado: true,
    };

    const { data: nueva, error: mErr } = await db
      .from('matriculas')
      .insert([registro])
      .select(`
        *,
        cursos:curso_id (nombre),
        tutores:tutor_id (nombre)
      `);
    if (mErr) throw mErr;

    const m = (nueva || [])[0];

    // Obtener nombres de estudiantes para respuesta
    const { data: estRows, error: estErr } = await db
      .from('estudiantes')
      .select('id, nombre')
      .in('id', uniqueStudentIds);
    if (estErr) throw estErr;

    return res.status(201).json({
      ...m,
      curso_nombre: m.cursos?.nombre,
      tutor_nombre: m.tutores?.nombre,
      es_grupo: true,
      grupo_id: m.grupo_id,
      grupo_nombre: m.grupo_nombre,
      estudiante_ids: m.estudiante_ids,
      estudiantes_detalle: estRows || [],
      source_bulk_grupo_id: gid,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE - Desactivar matrícula
router.delete('/:id', async (req, res) => {
  try {
    const userId = req.user?.id;
    const { error } = await supabase
      .from('matriculas')
      .update({
        estado: false,
        updated_by: userId,
        updated_at: new Date().toISOString()
      })
      .eq('id', req.params.id);
    
    if (error) throw error;
    res.json({ message: 'Matrícula desactivada correctamente' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
