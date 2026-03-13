import { supabase, supabaseAdmin } from '../../shared/config/supabaseClient.mjs';

const diasSemanaES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const notasDb = supabaseAdmin ?? supabase;
const TUTOR_NOTA_STATES = new Set(['pendiente', 'hecha']);

function sanitizeTutorNoteMessage(value) {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim();
  if (!text) throw new Error('El mensaje de la nota es requerido');
  return text.slice(0, 5000);
}

function summarizeNoteText(text) {
  const clean = String(text || '').trim();
  if (!clean) return '(sin texto)';
  return clean.length > 90 ? `${clean.slice(0, 90)}...` : clean;
}

async function registrarHistorialTutorNota({
  notaId,
  tutorId,
  accion,
  mensaje,
  estado,
  actor,
  meta,
}) {
  const { error } = await notasDb
    .from('tutor_notas_historial')
    .insert({
      nota_id: Number(notaId),
      tutor_id: Number(tutorId),
      accion,
      mensaje,
      estado: estado ?? null,
      actor_user_id: actor?.userId ?? null,
      actor_name: actor?.name ?? actor?.email ?? null,
      actor_role: actor?.role ?? null,
      meta: meta ?? {},
    });
  if (error) throw error;
}

async function registrarActividadTutorNota({
  action,
  summary,
  tutorId,
  noteId,
  actor,
  meta,
}) {
  if (!supabaseAdmin) return;
  const route = `/api/v1/dashboard/tutores/${tutorId}/notas${noteId ? `/${noteId}` : ''}`;
  const method = action === 'create' ? 'POST' : action === 'delete' ? 'DELETE' : 'PATCH';
  const entityId = noteId ? String(noteId) : String(tutorId);
  try {
    await supabaseAdmin
      .from('activity_logs')
      .insert({
        actor_user_id: actor?.userId ?? null,
        actor_email: actor?.email ?? null,
        actor_role: actor?.role ?? null,
        actor_name: actor?.name ?? null,
        action,
        summary,
        entity_type: 'tutor_nota',
        entity_id: entityId,
        method,
        route,
        status: 200,
        request_id: null,
        meta: {
          tutor_id: Number(tutorId),
          nota_id: noteId ? Number(noteId) : null,
          ...(meta || {}),
        },
      });
  } catch (error) {
    console.warn('TutorNotas activity log error:', error?.message || error);
  }
}

function safeJsonParse(value) {
  try {
    if (value === null || value === undefined) return null;
    if (typeof value === 'object') return value;
    return JSON.parse(String(value));
  } catch { return null; }
}

function calcDuracionHoras(hi, hf) {
  try {
    const [hh, mm] = String(hi).split(':').map(Number);
    const [hh2, mm2] = String(hf).split(':').map(Number);
    if (![hh, mm, hh2, mm2].every(Number.isFinite)) return null;
    const min = (hh2 * 60 + mm2) - (hh * 60 + mm);
    return min > 0 ? parseFloat((min / 60).toFixed(2)) : null;
  } catch { return null; }
}

export async function buildTutoriasMerged(fecha, bloqueadasSet) {
  const date = new Date(`${fecha}T00:00:00`);
  const diaSemana = diasSemanaES[date.getDay()];

  const { data: clasesRaw, error: clasesErr } = await supabase
    .from('clases')
    .select(`id,fecha,hora_inicio,hora_fin,estado,avisado,confirmado,motivo_cancelacion,matricula_id,
      matriculas!inner(id,estudiante_id,tutor_id,curso_id,estado,
        estudiantes(id,nombre),tutores(id,nombre),
        cursos(nombre,tipo_pago,dias_turno,dias_schedule))`)
    .eq('fecha', fecha)
    .eq('matriculas.estado', true)
    .in('estado', ['programada', 'completada'])
    .order('hora_inicio', { ascending: true });
  if (clasesErr) throw clasesErr;

  const clases = (clasesRaw ?? [])
    .filter(t => !t?.matricula_id || !bloqueadasSet.has(t.matricula_id))
    .map(t => ({
      id: t.id, fecha: t.fecha, hora_inicio: t.hora_inicio, hora_fin: t.hora_fin,
      estado: t.estado, avisado: Boolean(t.avisado), confirmado: Boolean(t.confirmado),
      motivo_cancelacion: t.motivo_cancelacion ?? null,
      matricula_id: t.matricula_id || t.matriculas?.id,
      estudiante_id: t.matriculas?.estudiante_id, estudiante_nombre: t.matriculas?.estudiantes?.nombre,
      tutor_id: t.matriculas?.tutor_id, tutor_nombre: t.matriculas?.tutores?.nombre,
      curso_nombre: t.matriculas?.cursos?.nombre, curso_tipo_pago: t.matriculas?.cursos?.tipo_pago ?? null,
      turno: null, duracion_horas: null, _source: 'clases',
    }));

  const clasesByMatricula = new Map();
  for (const c of clases) { if (c.matricula_id && !clasesByMatricula.has(c.matricula_id)) clasesByMatricula.set(c.matricula_id, c); }

  const { data: matriculasActivas, error: mErr } = await supabase
    .from('matriculas')
    .select(`id,estudiante_id,tutor_id,curso_id,
      estudiantes:estudiante_id(nombre),tutores:tutor_id(nombre),
      cursos:curso_id(nombre,tipo_pago,dias_turno,dias_schedule)`)
    .eq('estado', true);
  if (mErr) throw mErr;

  const computed = [];
  for (const m of matriculasActivas ?? []) {
    if (bloqueadasSet.has(m.id)) continue;
    const curso = m.cursos;
    const diasScheduleObj = safeJsonParse(curso?.dias_schedule);
    const diasTurnoObj = safeJsonParse(curso?.dias_turno);
    if (diasScheduleObj?.[diaSemana]) {
      const sch = diasScheduleObj[diaSemana];
      computed.push({
        id: null, fecha, hora_inicio: sch.hora_inicio || '—', hora_fin: sch.hora_fin || '—',
        estado: 'programada', avisado: false, confirmado: false, motivo_cancelacion: null,
        matricula_id: m.id, estudiante_id: m.estudiante_id, estudiante_nombre: m.estudiantes?.nombre,
        tutor_id: m.tutor_id, tutor_nombre: m.tutores?.nombre,
        curso_nombre: curso?.nombre, curso_tipo_pago: curso?.tipo_pago ?? null,
        turno: sch.turno || null, duracion_horas: calcDuracionHoras(sch.hora_inicio, sch.hora_fin), _source: 'computed',
      });
    } else if (diasTurnoObj?.[diaSemana]) {
      computed.push({
        id: null, fecha, hora_inicio: '—', hora_fin: '—',
        estado: 'programada', avisado: false, confirmado: false, motivo_cancelacion: null,
        matricula_id: m.id, estudiante_id: m.estudiante_id, estudiante_nombre: m.estudiantes?.nombre,
        tutor_id: m.tutor_id, tutor_nombre: m.tutores?.nombre,
        curso_nombre: curso?.nombre, curso_tipo_pago: curso?.tipo_pago ?? null,
        turno: diasTurnoObj[diaSemana] || null, duracion_horas: null, _source: 'computed',
      });
    }
  }

  const seenMatriculas = new Set();
  const merged = [];
  for (const s of computed) {
    if (!s.matricula_id) continue;
    const persisted = clasesByMatricula.get(s.matricula_id);
    merged.push(persisted ? { ...s, ...persisted, _source: 'merged' } : s);
    seenMatriculas.add(s.matricula_id);
  }
  for (const c of clases) {
    if (c.matricula_id && seenMatriculas.has(c.matricula_id)) continue;
    merged.push(c);
  }

  const keyHora = (h) => { const s = String(h || '').trim(); if (!s || s === '—') return '99:99:99'; return s.length === 5 ? `${s}:00` : s; };
  return merged.sort((a, b) => keyHora(a.hora_inicio).localeCompare(keyHora(b.hora_inicio)));
}

export async function getSesionesBloqueadas(fecha) {
  const { data, error } = await supabase.from('sesiones_clases')
    .select('matricula_id,estado').eq('fecha', fecha).in('estado', ['dada', 'cancelada']);
  if (error) throw error;
  return new Set((data ?? []).map(r => r.matricula_id));
}

export async function getResumenTutores(fecha) {
  const { data: tutores, error: tErr } = await supabase.from('tutores').select('id,nombre').eq('estado', true);
  if (tErr) throw tErr;
  const resumen = await Promise.all((tutores ?? []).map(async (tutor) => {
    const { data: clases, error: cErr } = await supabase.from('clases')
      .select(`id,matriculas!inner(tutor_id,cursos(nombre),estudiantes(nombre))`)
      .eq('matriculas.tutor_id', tutor.id).eq('fecha', fecha);
    if (cErr) throw cErr;
    const cursosUnicos = [...new Set((clases ?? []).map(c => c.matriculas?.cursos?.nombre).filter(Boolean))];
    const estUnicos = [...new Set((clases ?? []).map(c => c.matriculas?.estudiantes?.nombre).filter(Boolean))];
    return { id: tutor.id, nombre: tutor.nombre, total_clases: (clases ?? []).length, cursos: cursosUnicos.join(', '), estudiantes: estUnicos.join(', ') };
  }));
  return resumen.sort((a, b) => b.total_clases - a.total_clases);
}

export async function getResumenTutoresEstudiantes() {
  const [{ data: matriculas, error: mErr }, { data: tutores, error: tErr }] = await Promise.all([
    supabase.from('matriculas').select('tutor_id,estudiante_id').eq('estado', true),
    supabase.from('tutores').select('id,nombre').eq('estado', true),
  ]);
  if (mErr) throw mErr;
  if (tErr) throw tErr;
  const mapa = new Map();
  for (const m of matriculas ?? []) {
    if (!mapa.has(m.tutor_id)) mapa.set(m.tutor_id, new Set());
    mapa.get(m.tutor_id).add(m.estudiante_id);
  }
  return (tutores ?? [])
    .map(t => ({ tutor_id: t.id, tutor_nombre: t.nombre, total_estudiantes: mapa.get(t.id)?.size || 0 }))
    .sort((a, b) => b.total_estudiantes - a.total_estudiantes);
}

export async function getResumenCursosGrupos() {
  const [{ data: matriculas, error: mErr }, { data: cursos, error: cErr }] = await Promise.all([
    supabase.from('matriculas').select('curso_id,estudiante_id,grupo_id,es_grupo,grupo_nombre').eq('estado', true),
    supabase.from('cursos').select('id,nombre,grado_activo,grado_nombre,grado_color,tipo_clase,max_estudiantes').eq('estado', true),
  ]);
  if (mErr) throw mErr;
  if (cErr) throw cErr;
  return (cursos ?? []).map(curso => {
    const mats = (matriculas ?? []).filter(m => m.curso_id === curso.id);
    const estSet = new Set(mats.map(m => m.estudiante_id));
    const grpSet = new Set(mats.filter(m => m.es_grupo).map(m => m.grupo_id));
    return { curso_id: curso.id, curso_nombre: curso.nombre, grado_activo: curso.grado_activo, grado_nombre: curso.grado_nombre, grado_color: curso.grado_color, tipo_clase: curso.tipo_clase, max_estudiantes: curso.max_estudiantes, total_estudiantes: estSet.size, total_grupos: grpSet.size };
  }).sort((a, b) => b.total_estudiantes - a.total_estudiantes);
}

export async function getDebugMatriculasCursos() {
  const { data, error } = await supabase.from('matriculas')
    .select(`id,estudiante_id,curso_id,estado,estudiantes:estudiante_id(nombre),cursos:curso_id(id,nombre,estado,dias_schedule)`)
    .eq('estado', true);
  if (error) throw error;
  return (data ?? []).map(m => ({
    matricula_id: m.id, estudiante: m.estudiantes?.nombre,
    curso_id: m.curso_id, curso_nombre: m.cursos?.nombre,
    curso_estado: m.cursos?.estado ? 'ACTIVO' : 'INACTIVO',
    tiene_dias_schedule: !!m.cursos?.dias_schedule,
  }));
}

export async function getEstadosClasesRango({ fecha_inicio, fecha_fin }) {
  const [clasesRes, sesionesRes] = await Promise.all([
    supabase.from('clases')
      .select('fecha,matricula_id,avisado,confirmado,estado')
      .gte('fecha', fecha_inicio).lte('fecha', fecha_fin)
      .not('matricula_id', 'is', null),
    supabase.from('sesiones_clases')
      .select('fecha,matricula_id,estado,hora_inicio,hora_fin,duracion_horas')
      .gte('fecha', fecha_inicio).lte('fecha', fecha_fin)
      .not('matricula_id', 'is', null),
  ]);
  if (clasesRes.error) throw clasesRes.error;
  if (sesionesRes.error) throw sesionesRes.error;

  const sesionesMap = new Map();
  for (const s of sesionesRes.data ?? []) {
    if (!s.matricula_id || !s.fecha) continue;
    const key = `${String(s.fecha).slice(0, 10)}|${s.matricula_id}`;
    const est = s.estado === 'dada' ? 'dada' : s.estado === 'cancelada' ? 'cancelada' : null;
    if (est) sesionesMap.set(key, est);
  }

  const result = [];
  const clasesKeys = new Set();
  for (const c of clasesRes.data ?? []) {
    if (!c.matricula_id || !c.fecha) continue;
    const fecha = String(c.fecha).slice(0, 10);
    const key = `${fecha}|${c.matricula_id}`;
    clasesKeys.add(key);
    let estado_sesion = sesionesMap.get(key) ?? null;
    if (!estado_sesion) {
      if (c.estado === 'completada') estado_sesion = 'dada';
      else if (c.estado === 'cancelada') estado_sesion = 'cancelada';
    }
    result.push({ fecha, matricula_id: c.matricula_id, avisado: Boolean(c.avisado), confirmado: Boolean(c.confirmado), estado_sesion });
  }
  for (const s of sesionesRes.data ?? []) {
    if (!s.matricula_id || !s.fecha) continue;
    const fecha = String(s.fecha).slice(0, 10);
    const key = `${fecha}|${s.matricula_id}`;
    if (clasesKeys.has(key)) continue;
    const estado_sesion = s.estado === 'dada' ? 'dada' : s.estado === 'cancelada' ? 'cancelada' : null;
    if (estado_sesion) result.push({ fecha, matricula_id: s.matricula_id, avisado: false, confirmado: false, estado_sesion, hora_inicio: s.hora_inicio || null, hora_fin: s.hora_fin || null, duracion_horas: s.duracion_horas || null });
  }
  return result;
}

export async function getMetricas({ mes, tutor_id }) {
  const [year, monthStr] = String(mes || '').split('-');
  const month = Number(monthStr);
  if (!year || !month) throw new Error('mes debe tener formato YYYY-MM');
  const fecha_inicio = `${year}-${String(month).padStart(2, '0')}-01`;
  const lastDay = new Date(Number(year), month, 0).getDate();
  const fecha_fin = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

  // ── Real: movimientos completados/verificados del mes ──
  let qReal = supabase.from('movimientos_dinero')
    .select('tipo,monto,estado,tutor_id')
    .gte('fecha_pago', fecha_inicio).lte('fecha_pago', fecha_fin)
    .or('estado.is.null,estado.in.(completado,verificado)');
  if (tutor_id) qReal = qReal.eq('tutor_id', String(tutor_id));
  const { data: realData, error: realError } = await qReal;
  if (realError) throw realError;

  let realIngresos = 0, realPagosTutores = 0;
  for (const m of realData ?? []) {
    const monto = Number(m.monto) || 0;
    const tipo = String(m.tipo || '');
    if (tipo === 'ingreso_estudiante' || tipo.startsWith('ingreso_')) realIngresos += monto;
    else if (tipo === 'pago_tutor_pendiente' || tipo === 'pago_tutor' || tipo.startsWith('pago_') || tipo.startsWith('egreso_')) realPagosTutores += monto;
  }

  // ── Esperado: movimientos pendientes del mes ──
  let qEsp = supabase.from('movimientos_dinero')
    .select('tipo,monto,estado,tutor_id')
    .gte('fecha_pago', fecha_inicio).lte('fecha_pago', fecha_fin)
    .eq('estado', 'pendiente');
  if (tutor_id) qEsp = qEsp.eq('tutor_id', String(tutor_id));
  const { data: espData, error: espError } = await qEsp;
  if (espError) throw espError;

  let espIngresos = 0, espPagosTutores = 0;
  for (const m of espData ?? []) {
    const monto = Number(m.monto) || 0;
    const tipo = String(m.tipo || '');
    if (tipo === 'ingreso_estudiante' || tipo.startsWith('ingreso_')) espIngresos += monto;
    else if (tipo === 'pago_tutor_pendiente' || tipo === 'pago_tutor' || tipo.startsWith('pago_') || tipo.startsWith('egreso_')) espPagosTutores += monto;
  }

  // ── Tesorería real (complementario): from tesoreria_pagos ──
  try {
    const { data: tesPagos } = await supabase.from('tesoreria_pagos')
      .select('direccion,monto,estado,fecha_pago')
      .gte('fecha_pago', fecha_inicio).lte('fecha_pago', fecha_fin)
      .in('estado', ['completado', 'verificado']);
    if (tesPagos && tesPagos.length > 0) {
      let tesIngr = 0, tesEgr = 0;
      for (const p of tesPagos) {
        const monto = Number(p.monto) || 0;
        if (p.direccion === 'entrada') tesIngr += monto;
        else if (p.direccion === 'salida') tesEgr += monto;
      }
      // If tesoreria has data, prefer it for 'real'
      if (tesIngr > 0 || tesEgr > 0) {
        realIngresos = Math.max(realIngresos, tesIngr);
        realPagosTutores = Math.max(realPagosTutores, tesEgr);
      }
    }
  } catch { /* tesoreria_pagos may not exist yet */ }

  // ── Tesorería esperado (complementario): from tesoreria_obligaciones ──
  try {
    const { data: tesObl } = await supabase.from('tesoreria_obligaciones')
      .select('tipo,monto,estado,fecha_devengo')
      .gte('fecha_devengo', fecha_inicio).lte('fecha_devengo', fecha_fin)
      .eq('estado', 'pendiente');
    if (tesObl && tesObl.length > 0) {
      let oblIngr = 0, oblEgr = 0;
      for (const o of tesObl) {
        const monto = Number(o.monto) || 0;
        const tipo = String(o.tipo || '');
        if (tipo === 'cobro' || tipo === 'cobro_sesion' || tipo.startsWith('cobro')) oblIngr += monto;
        else if (tipo === 'pago' || tipo === 'pago_tutor' || tipo.startsWith('pago')) oblEgr += monto;
      }
      if (oblIngr > 0 || oblEgr > 0) {
        espIngresos = Math.max(espIngresos, oblIngr);
        espPagosTutores = Math.max(espPagosTutores, oblEgr);
      }
    }
  } catch { /* tesoreria_obligaciones may not exist yet */ }

  const realNeto = realIngresos - realPagosTutores;
  const espNeto = espIngresos - espPagosTutores;

  return {
    mes, fecha_inicio, fecha_fin,
    fuente: 'movimientos_dinero + tesoreria',
    // Backwards compat
    ingresos: realIngresos + espIngresos,
    pagos_tutores: realPagosTutores + espPagosTutores,
    neto: (realIngresos + espIngresos) - (realPagosTutores + espPagosTutores),
    movimientos: (realData ?? []).length + (espData ?? []).length,
    // Structured
    real: { ingresos: realIngresos, pagos_tutores: realPagosTutores, neto: realNeto, movimientos: (realData ?? []).length },
    esperado: { ingresos: espIngresos, pagos_tutores: espPagosTutores, neto: espNeto, movimientos: (espData ?? []).length },
    diferencial: { neto: espNeto - realNeto },
  };
}

function buildSesionFields(fecha, curso) {
  const date = new Date(`${fecha}T00:00:00`);
  const diaSemana = diasSemanaES[date.getDay()] || 'Lunes';
  const schedule = safeJsonParse(curso?.dias_schedule);
  const sch = schedule?.[diaSemana];
  const hi = sch?.hora_inicio || '00:00';
  const hf = sch?.hora_fin || '01:00';
  return { dia_semana: diaSemana, hora_inicio: hi, hora_fin: hf, duracion_horas: calcDuracionHoras(hi, hf) ?? 1 };
}

export async function completarSesion(matricula_id, fecha) {
  const { data: mat, error: matErr } = await supabase
    .from('matriculas')
    .select('curso_id,tutor_id,cursos(dias_schedule)')
    .eq('id', matricula_id)
    .maybeSingle();
  if (matErr) throw matErr;
  if (!mat) throw new Error('Matrícula no encontrada');

  const sesionFields = buildSesionFields(fecha, mat.cursos);
  await supabase.from('sesiones_clases').delete().eq('matricula_id', matricula_id).eq('fecha', fecha);
  const { error } = await supabase.from('sesiones_clases').insert({
    matricula_id: Number(matricula_id),
    fecha,
    estado: 'dada',
    curso_id: mat.curso_id,
    tutor_id: mat.tutor_id,
    ...sesionFields,
  });
  if (error) throw error;
  await supabase.from('clases').update({ estado: 'completada' }).eq('matricula_id', matricula_id).eq('fecha', fecha);
  return { message: 'Clase marcada como dada.', matricula_id, fecha };
}

export async function cancelarSesionDia(matricula_id, fecha, motivo) {
  const { data: mat, error: matErr } = await supabase
    .from('matriculas')
    .select('curso_id,tutor_id,cursos(dias_schedule)')
    .eq('id', matricula_id)
    .maybeSingle();
  if (matErr) throw matErr;
  if (!mat) throw new Error('Matrícula no encontrada');

  const sesionFields = buildSesionFields(fecha, mat.cursos);
  await supabase.from('sesiones_clases').delete().eq('matricula_id', matricula_id).eq('fecha', fecha);
  const { error } = await supabase.from('sesiones_clases').insert({
    matricula_id: Number(matricula_id),
    fecha,
    estado: 'cancelada',
    curso_id: mat.curso_id,
    tutor_id: mat.tutor_id,
    ...sesionFields,
  });
  if (error) throw error;
  if (motivo) await supabase.from('clases').update({ motivo_cancelacion: motivo, estado: 'cancelada' }).eq('matricula_id', matricula_id).eq('fecha', fecha);
  return { message: 'Clase cancelada para este día.', matricula_id, fecha };
}

export async function actualizarEstadoSesion(matricula_id, fecha, { avisado, confirmado }) {
  const updates = {};
  if (avisado !== undefined) updates.avisado = Boolean(avisado);
  if (confirmado !== undefined) updates.confirmado = Boolean(confirmado);
  if (!Object.keys(updates).length) return { message: 'Sin cambios.', matricula_id, fecha };
  const { data: existing } = await supabase.from('clases').select('id').eq('matricula_id', matricula_id).eq('fecha', fecha).maybeSingle();
  if (existing?.id) {
    const { error } = await supabase.from('clases').update(updates).eq('id', existing.id);
    if (error) throw error;
  } else {
    const { data: mat } = await supabase.from('matriculas').select('curso_id,tutor_id,estudiante_id').eq('id', matricula_id).maybeSingle();
    const { error } = await supabase.from('clases').insert({ matricula_id: Number(matricula_id), fecha, estado: 'programada', curso_id: mat?.curso_id ?? null, tutor_id: mat?.tutor_id ?? null, estudiante_id: mat?.estudiante_id ?? null, ...updates });
    if (error) throw error;
  }
  return { message: 'Estado actualizado.', matricula_id, fecha, ...updates };
}

export async function listTutorNotas(tutorId, { historyLimit = 120 } = {}) {
  const tutorIdNum = Number(tutorId);
  if (!Number.isFinite(tutorIdNum) || tutorIdNum <= 0) throw new Error('Tutor inválido');

  const limit = Number.isFinite(Number(historyLimit))
    ? Math.min(Math.max(Number(historyLimit), 20), 300)
    : 120;

  const [notasRes, historialRes] = await Promise.all([
    notasDb
      .from('tutor_notas')
      .select('id,tutor_id,mensaje,estado,creado_por,creado_por_nombre,actualizado_por,actualizado_por_nombre,eliminado_por,eliminado_por_nombre,hecha_en,eliminada_en,created_at,updated_at')
      .eq('tutor_id', tutorIdNum)
      .neq('estado', 'eliminada')
      .order('created_at', { ascending: true }),
    notasDb
      .from('tutor_notas_historial')
      .select('id,nota_id,tutor_id,accion,mensaje,estado,actor_user_id,actor_name,actor_role,created_at,meta')
      .eq('tutor_id', tutorIdNum)
      .order('created_at', { ascending: false })
      .limit(limit),
  ]);

  if (notasRes.error) throw notasRes.error;
  if (historialRes.error) throw historialRes.error;

  return {
    notas: notasRes.data ?? [],
    historial: historialRes.data ?? [],
  };
}

export async function createTutorNota({ tutorId, mensaje, actor }) {
  const tutorIdNum = Number(tutorId);
  if (!Number.isFinite(tutorIdNum) || tutorIdNum <= 0) throw new Error('Tutor inválido');
  const mensajeClean = sanitizeTutorNoteMessage(mensaje);

  const { data: inserted, error: insertError } = await notasDb
    .from('tutor_notas')
    .insert({
      tutor_id: tutorIdNum,
      mensaje: mensajeClean,
      estado: 'pendiente',
      creado_por: actor?.userId ?? null,
      creado_por_nombre: actor?.name ?? actor?.email ?? null,
      actualizado_por: actor?.userId ?? null,
      actualizado_por_nombre: actor?.name ?? actor?.email ?? null,
      hecha_en: null,
      eliminada_en: null,
      updated_at: new Date().toISOString(),
    })
    .select('id,tutor_id,mensaje,estado,creado_por,creado_por_nombre,actualizado_por,actualizado_por_nombre,eliminado_por,eliminado_por_nombre,hecha_en,eliminada_en,created_at,updated_at')
    .single();
  if (insertError) throw insertError;

  await registrarHistorialTutorNota({
    notaId: inserted.id,
    tutorId: tutorIdNum,
    accion: 'crear',
    mensaje: inserted.mensaje,
    estado: inserted.estado,
    actor,
    meta: { before: null, after: inserted.mensaje },
  });

  await registrarActividadTutorNota({
    action: 'create',
    summary: `Registró nota interna sobre tutor #${tutorIdNum}: ${summarizeNoteText(inserted.mensaje)}`,
    tutorId: tutorIdNum,
    noteId: inserted.id,
    actor,
    meta: {
      estado: inserted.estado,
      mensaje: inserted.mensaje,
    },
  });

  return inserted;
}

export async function updateTutorNotaTexto({ tutorId, notaId, mensaje, actor }) {
  const tutorIdNum = Number(tutorId);
  const notaIdNum = Number(notaId);
  if (!Number.isFinite(tutorIdNum) || tutorIdNum <= 0) throw new Error('Tutor inválido');
  if (!Number.isFinite(notaIdNum) || notaIdNum <= 0) throw new Error('Nota inválida');

  const mensajeClean = sanitizeTutorNoteMessage(mensaje);

  const { data: current, error: currentError } = await notasDb
    .from('tutor_notas')
    .select('id,tutor_id,mensaje,estado')
    .eq('id', notaIdNum)
    .maybeSingle();
  if (currentError) throw currentError;
  if (!current) throw new Error('Nota no encontrada');
  if (Number(current.tutor_id) !== tutorIdNum) throw new Error('La nota no pertenece al tutor seleccionado');
  if (current.estado === 'eliminada') throw new Error('No se puede editar una nota eliminada');

  const { data: updated, error: updateError } = await notasDb
    .from('tutor_notas')
    .update({
      mensaje: mensajeClean,
      actualizado_por: actor?.userId ?? null,
      actualizado_por_nombre: actor?.name ?? actor?.email ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', notaIdNum)
    .select('id,tutor_id,mensaje,estado,creado_por,creado_por_nombre,actualizado_por,actualizado_por_nombre,eliminado_por,eliminado_por_nombre,hecha_en,eliminada_en,created_at,updated_at')
    .single();
  if (updateError) throw updateError;

  await registrarHistorialTutorNota({
    notaId: notaIdNum,
    tutorId: tutorIdNum,
    accion: 'editar',
    mensaje: updated.mensaje,
    estado: updated.estado,
    actor,
    meta: { before: current.mensaje, after: updated.mensaje },
  });

  await registrarActividadTutorNota({
    action: 'update',
    summary: `Actualizó nota interna #${notaIdNum} del tutor #${tutorIdNum}`,
    tutorId: tutorIdNum,
    noteId: notaIdNum,
    actor,
    meta: {
      before: current.mensaje,
      after: updated.mensaje,
    },
  });

  return updated;
}

export async function setTutorNotaEstado({ tutorId, notaId, estado, actor }) {
  const tutorIdNum = Number(tutorId);
  const notaIdNum = Number(notaId);
  const estadoFinal = String(estado || '').trim().toLowerCase();
  if (!Number.isFinite(tutorIdNum) || tutorIdNum <= 0) throw new Error('Tutor inválido');
  if (!Number.isFinite(notaIdNum) || notaIdNum <= 0) throw new Error('Nota inválida');
  if (!TUTOR_NOTA_STATES.has(estadoFinal)) throw new Error('Estado inválido');

  const { data: current, error: currentError } = await notasDb
    .from('tutor_notas')
    .select('id,tutor_id,mensaje,estado')
    .eq('id', notaIdNum)
    .maybeSingle();
  if (currentError) throw currentError;
  if (!current) throw new Error('Nota no encontrada');
  if (Number(current.tutor_id) !== tutorIdNum) throw new Error('La nota no pertenece al tutor seleccionado');
  if (current.estado === 'eliminada') throw new Error('No se puede actualizar una nota eliminada');

  const accion = estadoFinal === 'hecha' ? 'marcar_hecha' : 'reabrir';

  const { data: updated, error: updateError } = await notasDb
    .from('tutor_notas')
    .update({
      estado: estadoFinal,
      hecha_en: estadoFinal === 'hecha' ? new Date().toISOString() : null,
      actualizado_por: actor?.userId ?? null,
      actualizado_por_nombre: actor?.name ?? actor?.email ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', notaIdNum)
    .select('id,tutor_id,mensaje,estado,creado_por,creado_por_nombre,actualizado_por,actualizado_por_nombre,eliminado_por,eliminado_por_nombre,hecha_en,eliminada_en,created_at,updated_at')
    .single();
  if (updateError) throw updateError;

  await registrarHistorialTutorNota({
    notaId: notaIdNum,
    tutorId: tutorIdNum,
    accion,
    mensaje: updated.mensaje,
    estado: updated.estado,
    actor,
    meta: { before: current.estado, after: updated.estado },
  });

  await registrarActividadTutorNota({
    action: 'update',
    summary: estadoFinal === 'hecha'
      ? `Marcó como hecha la nota interna #${notaIdNum} (tutor #${tutorIdNum})`
      : `Reabrió la nota interna #${notaIdNum} (tutor #${tutorIdNum})`,
    tutorId: tutorIdNum,
    noteId: notaIdNum,
    actor,
    meta: {
      before: current.estado,
      after: updated.estado,
    },
  });

  return updated;
}

export async function deleteTutorNota({ tutorId, notaId, actor }) {
  const tutorIdNum = Number(tutorId);
  const notaIdNum = Number(notaId);
  if (!Number.isFinite(tutorIdNum) || tutorIdNum <= 0) throw new Error('Tutor inválido');
  if (!Number.isFinite(notaIdNum) || notaIdNum <= 0) throw new Error('Nota inválida');

  const { data: current, error: currentError } = await notasDb
    .from('tutor_notas')
    .select('id,tutor_id,mensaje,estado')
    .eq('id', notaIdNum)
    .maybeSingle();
  if (currentError) throw currentError;
  if (!current) throw new Error('Nota no encontrada');
  if (Number(current.tutor_id) !== tutorIdNum) throw new Error('La nota no pertenece al tutor seleccionado');

  if (current.estado !== 'eliminada') {
    const { error: updateError } = await notasDb
      .from('tutor_notas')
      .update({
        estado: 'eliminada',
        eliminada_en: new Date().toISOString(),
        eliminado_por: actor?.userId ?? null,
        eliminado_por_nombre: actor?.name ?? actor?.email ?? null,
        actualizado_por: actor?.userId ?? null,
        actualizado_por_nombre: actor?.name ?? actor?.email ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', notaIdNum);
    if (updateError) throw updateError;

    await registrarHistorialTutorNota({
      notaId: notaIdNum,
      tutorId: tutorIdNum,
      accion: 'eliminar',
      mensaje: current.mensaje,
      estado: 'eliminada',
      actor,
      meta: { before: current.estado, after: 'eliminada' },
    });

    await registrarActividadTutorNota({
      action: 'delete',
      summary: `Eliminó nota interna #${notaIdNum} del tutor #${tutorIdNum}`,
      tutorId: tutorIdNum,
      noteId: notaIdNum,
      actor,
      meta: { mensaje: current.mensaje },
    });
  }

  return { ok: true, nota_id: notaIdNum };
}

export async function getEstadisticasGeneral() {
  const [tutoresRes, estudiantesRes, cursosRes, matriculasRes, clasesRes] = await Promise.all([
    supabase.from('tutores').select('id', { count: 'exact', head: true }).eq('estado', true),
    supabase.from('estudiantes').select('id', { count: 'exact', head: true }).eq('estado', true),
    supabase.from('cursos').select('id', { count: 'exact', head: true }).eq('estado', true),
    supabase.from('matriculas').select('id', { count: 'exact', head: true }).eq('estado', true),
    supabase.from('clases').select('id', { count: 'exact', head: true }),
  ]);

  let dinero_ingresado_total = 0;
  try {
    const { data: ingresos, error: iErr } = await supabase
      .from('movimientos_dinero').select('tipo,monto,estado').like('tipo', 'ingreso_%');
    if (!iErr) {
      dinero_ingresado_total = (ingresos ?? []).reduce((sum, r) => {
        const est = String(r?.estado ?? 'completado');
        if (est !== 'completado' && est !== 'verificado') return sum;
        const tipo = String(r?.tipo || '');
        if (tipo === 'ingreso_estudiante') return sum;
        return sum + (Number(r?.monto) || 0);
      }, 0);
    }
  } catch { /* ignore */ }

  return {
    tutores: tutoresRes.count || 0,
    estudiantes: estudiantesRes.count || 0,
    cursos: cursosRes.count || 0,
    matriculas: matriculasRes.count || 0,
    clases_totales: clasesRes.count || 0,
    dinero_ingresado_total,
    ingresos_pendientes: dinero_ingresado_total,
  };
}
