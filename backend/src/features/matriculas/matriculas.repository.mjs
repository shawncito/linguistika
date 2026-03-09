import { randomUUID } from 'crypto';
import { supabase, supabaseAdmin, supabaseForToken } from '../../shared/config/supabaseClient.mjs';
import { AppError } from '../../shared/errors/AppError.mjs';

const SELECT = `
  *,
  estudiantes:estudiante_id(nombre),
  cursos:curso_id(nombre,metodo,dias_turno,dias_schedule,tipo_clase,tipo_pago,max_estudiantes,grado_activo,grado_nombre,grado_color,costo_curso,pago_tutor),
  tutores:tutor_id(nombre,tarifa_por_hora)
`;

function getDb(token) {
  return supabaseAdmin ?? (token ? supabaseForToken(token) : supabase);
}

function formatMatricula(m) {
  if (!m) return m;
  return {
    ...m,
    estudiante_nombre: m.estudiantes?.nombre,
    curso_nombre: m.cursos?.nombre,
    tutor_nombre: m.tutores?.nombre,
    tarifa_por_hora: m.tutores?.tarifa_por_hora,
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
    curso_pago_tutor: m.cursos?.pago_tutor || null,
    es_grupo: m.es_grupo, grupo_id: m.grupo_id, grupo_nombre: m.grupo_nombre,
  };
}

export async function findAll(token) {
  const db = getDb(token);
  const { data, error } = await db.from('matriculas').select(SELECT).eq('estado', true).order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(formatMatricula);
}

export async function findById(id, token) {
  const db = getDb(token);
  const { data, error } = await db.from('matriculas').select(SELECT).eq('id', id).maybeSingle();
  if (error) throw error;
  if (!data) throw new AppError('Matrícula no encontrada', 404);
  return formatMatricula(data);
}

export async function verifyCursoTutor(db, curso_id, tutor_id) {
  const [cursoRes, tutorRes] = await Promise.all([
    db.from('cursos').select('id,estado,activo_para_matricula').eq('id', curso_id).maybeSingle(),
    db.from('tutores').select('id,estado').eq('id', tutor_id).maybeSingle(),
  ]);
  if (cursoRes.error || !cursoRes.data) throw new AppError('Curso no existe', 404);
  if (tutorRes.error || !tutorRes.data) throw new AppError('Tutor no existe', 404);
  if (cursoRes.data.estado === false) throw new AppError('El curso está inactivo', 409);
  if (cursoRes.data.activo_para_matricula === false) throw new AppError('El curso no está activo para matrícula', 409);
  if (tutorRes.data.estado === false) throw new AppError('El tutor está inactivo', 409);
}

export async function create({ listaEstudiantes, curso_id, tutor_id, es_grupo, grupo_id, grupo_nombre, userId, token }) {
  const db = getDb(token);
  await verifyCursoTutor(db, curso_id, tutor_id);

  const { data: estRows, error: estErr } = await db.from('estudiantes').select('id').in('id', listaEstudiantes);
  if (estErr) throw estErr;
  const existentes = new Set((estRows ?? []).map(r => r.id));
  const faltantes = listaEstudiantes.filter(id => !existentes.has(id));
  if (faltantes.length > 0) throw new AppError(`Estudiantes no encontrados: ${faltantes.join(', ')}`, 400);

  const esGrupo = !!es_grupo || listaEstudiantes.length > 1;

  if (esGrupo) {
    const registro = { estudiante_id: null, estudiante_ids: listaEstudiantes, curso_id, tutor_id, es_grupo: true, grupo_id: grupo_id || randomUUID(), grupo_nombre: grupo_nombre || null, created_by: userId, estado: true };
    const { data: nueva, error } = await db.from('matriculas').insert([registro]).select('*, cursos:curso_id(nombre), tutores:tutor_id(nombre)');
    if (error) throw error;
    const m = nueva[0];
    const { data: estDets } = await db.from('estudiantes').select('id,nombre').in('id', listaEstudiantes);
    return { ...m, curso_nombre: m.cursos?.nombre, tutor_nombre: m.tutores?.nombre, es_grupo: true, grupo_id: m.grupo_id, grupo_nombre: m.grupo_nombre, estudiante_ids: m.estudiante_ids, estudiantes_detalle: estDets || [] };
  } else {
    const registro = { estudiante_id: listaEstudiantes[0], estudiante_ids: null, curso_id, tutor_id, es_grupo: false, grupo_id: null, grupo_nombre: null, created_by: userId, estado: true };
    const { data: nueva, error } = await db.from('matriculas').insert([registro]).select('*, estudiantes:estudiante_id(nombre), cursos:curso_id(nombre), tutores:tutor_id(nombre)');
    if (error) throw error;
    const m = nueva[0];
    return { ...m, estudiante_nombre: m.estudiantes?.nombre, curso_nombre: m.cursos?.nombre, tutor_nombre: m.tutores?.nombre, es_grupo: false };
  }
}

export async function update(id, fields, userId, token) {
  const db = getDb(token);
  const { data, error } = await db.from('matriculas').update({ ...fields, updated_by: userId, updated_at: new Date().toISOString() }).eq('id', id).select('*, estudiantes:estudiante_id(nombre), cursos:curso_id(nombre), tutores:tutor_id(nombre)').single();
  if (error) throw error;
  return { ...data, estudiante_nombre: data.estudiantes?.nombre, curso_nombre: data.cursos?.nombre, tutor_nombre: data.tutores?.nombre, es_grupo: data.es_grupo, grupo_id: data.grupo_id, grupo_nombre: data.grupo_nombre };
}

export async function deactivate(id, userId) {
  const { error } = await supabase.from('matriculas').update({ estado: false, updated_by: userId, updated_at: new Date().toISOString() }).eq('id', id);
  if (error) throw error;
  return { message: 'Matrícula desactivada correctamente' };
}

export async function fromBulkGrupo(matricula_grupo_id, grupo_nombre, userId, token) {
  const db = getDb(token);
  const gid = String(matricula_grupo_id ?? '').trim();
  if (!gid) throw new AppError('matricula_grupo_id requerido', 400);

  const { data: grupo, error: gErr } = await db.from('matriculas_grupo').select('id,curso_id,tutor_id,nombre_grupo,estado').eq('id', gid).maybeSingle();
  if (gErr) throw gErr;
  if (!grupo) throw new AppError('Grupo no encontrado', 404);

  const [{ data: links, error: lErr }, normalRes] = await Promise.all([
    db.from('estudiantes_en_grupo').select('estudiante_bulk_id').eq('matricula_grupo_id', gid),
    db.from('estudiantes').select('id').eq('matricula_grupo_id', Number(gid)),
  ]);
  if (lErr) throw lErr;

  const normalIds = (!normalRes.error ? normalRes.data ?? [] : []).map(s => s.id);
  const bulkIds = (links ?? []).map(x => x.estudiante_bulk_id).filter(Boolean);

  const { data: bulkStudents, error: bErr } = bulkIds.length
    ? await db.from('estudiantes_bulk').select('id,nombre,correo,telefono').in('id', bulkIds)
    : { data: [], error: null };
  if (bErr) throw bErr;

  if (!bulkIds.length && !normalIds.length) throw new AppError('Este grupo no tiene estudiantes adjuntos.', 400);

  const emails = [...new Set((bulkStudents ?? []).map(s => String(s.correo ?? '').trim()).filter(Boolean))];
  const phones = [...new Set((bulkStudents ?? []).map(s => String(s.telefono ?? '').trim()).filter(Boolean))];
  const [emailRes, phoneRes] = await Promise.all([
    emails.length ? db.from('estudiantes').select('id,email').in('email', emails) : Promise.resolve({ data: [] }),
    phones.length ? db.from('estudiantes').select('id,telefono').in('telefono', phones) : Promise.resolve({ data: [] }),
  ]);
  const emailToId = new Map((emailRes.data ?? []).map(r => [String(r.email ?? '').trim().toLowerCase(), r.id]));
  const phoneToId = new Map((phoneRes.data ?? []).map(r => [String(r.telefono ?? '').trim(), r.id]));

  const createdStudentIds = [...normalIds];
  for (const s of bulkStudents ?? []) {
    const email = String(s.correo ?? '').trim();
    const phone = String(s.telefono ?? '').trim();
    const emailKey = email?.toLowerCase();
    let estudianteId = emailKey && emailToId.has(emailKey) ? emailToId.get(emailKey) : null;
    if (!estudianteId && phone && phoneToId.has(phone)) estudianteId = phoneToId.get(phone);
    if (!estudianteId) {
      const { data: created, error: cErr } = await db.from('estudiantes')
        .insert({ nombre: String(s.nombre ?? '').trim(), email: email || null, telefono: phone || null, grado: null, dias: null, turno: null, dias_turno: null, created_by: userId, estado: true })
        .select('id,email,telefono').single();
      if (cErr) throw cErr;
      estudianteId = created.id;
      if (created.email) emailToId.set(String(created.email).trim().toLowerCase(), created.id);
      if (created.telefono) phoneToId.set(String(created.telefono).trim(), created.id);
    }
    if (estudianteId) createdStudentIds.push(estudianteId);
  }

  const uniqueIds = Array.from(new Set(createdStudentIds.filter(Boolean)));
  if (!uniqueIds.length) throw new AppError('No se pudieron convertir estudiantes del grupo.', 400);

  const registro = { estudiante_id: null, estudiante_ids: uniqueIds, curso_id: grupo.curso_id, tutor_id: grupo.tutor_id, es_grupo: true, grupo_id: randomUUID(), grupo_nombre: (grupo_nombre ?? grupo.nombre_grupo) ? String(grupo_nombre ?? grupo.nombre_grupo).trim() : null, created_by: userId, estado: true };
  const { data: nueva, error: mErr } = await db.from('matriculas').insert([registro]).select('*, cursos:curso_id(nombre), tutores:tutor_id(nombre)');
  if (mErr) throw mErr;
  const m = (nueva ?? [])[0];
  const { data: estRows } = await db.from('estudiantes').select('id,nombre').in('id', uniqueIds);
  return { ...m, curso_nombre: m.cursos?.nombre, tutor_nombre: m.tutores?.nombre, es_grupo: true, grupo_id: m.grupo_id, grupo_nombre: m.grupo_nombre, estudiante_ids: m.estudiante_ids, estudiantes_detalle: estRows || [], source_bulk_grupo_id: gid };
}
