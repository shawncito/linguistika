import { supabase, supabaseAdmin } from '../../shared/config/supabaseClient.mjs';
import { AppError } from '../../shared/errors/AppError.mjs';

// DB stores estado as boolean; frontend expects 0/1
const normalizeCurso = (c) => c ? { ...c, estado: c.estado ? 1 : 0 } : c;

export async function findAll() {
  const { data, error } = await supabase
    .from('cursos')
    .select('*, tutores(nombre, color)')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(normalizeCurso);
}

export async function findById(id) {
  const { data, error } = await supabase
    .from('cursos')
    .select('*, tutores(nombre, color)')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new AppError('Curso no encontrado', 404);
  return normalizeCurso(data);
}

export async function findByName(nombre) {
  const { data } = await supabase
    .from('cursos')
    .select('id')
    .ilike('nombre', nombre)
    .limit(1);
  return data ?? [];
}

export async function findTutorById(tutorId) {
  const { data, error } = await supabase
    .from('tutores')
    .select('*')
    .eq('id', tutorId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function create(payload) {
  const row = {
    nombre: payload.nombre,
    descripcion: payload.descripcion || null,
    nivel: payload.nivel || null,
    tutor_id: payload.tutor_id,
    dias_horario: payload.dias_horario,
    hora_inicio: payload.hora_inicio,
    hora_fin: payload.hora_fin,
    capacidad_maxima: payload.capacidad_maxima || null,
    activo_para_matricula: payload.activo_para_matricula !== false,
    estado: true,
    created_by: payload.userId,
  };

  const { data, error } = await supabase.from('cursos').insert(row).select().single();
  if (error) throw error;
  return normalizeCurso(data);
}

export async function update(id, payload) {
  const updateData = { updated_by: payload.userId };
  const fields = ['nombre', 'descripcion', 'nivel', 'tutor_id', 'dias_horario', 'hora_inicio', 'hora_fin', 'capacidad_maxima', 'activo_para_matricula'];
  for (const f of fields) {
    if (payload[f] !== undefined) updateData[f] = payload[f];
  }
  if (payload.estado !== undefined) updateData.estado = payload.estado === 1 || payload.estado === true;

  const { data, error } = await supabase
    .from('cursos')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return normalizeCurso(data);
}

// Verificadores para DELETE
export async function countMatriculas(cursoId) {
  const { count } = await supabase
    .from('matriculas')
    .select('*', { count: 'exact', head: true })
    .eq('curso_id', cursoId);
  return count ?? 0;
}

export async function countClases(cursoId) {
  const { count } = await supabase
    .from('clases')
    .select('*', { count: 'exact', head: true })
    .eq('curso_id', cursoId);
  return count ?? 0;
}

export async function countMovimientos(cursoId) {
  const admin = supabaseAdmin ?? supabase;
  const { count } = await admin
    .from('movimientos')
    .select('*', { count: 'exact', head: true })
    .eq('curso_id', cursoId);
  return count ?? 0;
}

export async function remove(id) {
  const { error } = await supabase.from('cursos').delete().eq('id', id);
  if (error) throw error;
  return { message: 'Curso eliminado correctamente' };
}

export async function cascadeDeleteCurso(cursoId) {
  const admin = supabaseAdmin ?? supabase;
  await admin.from('matriculas').delete().eq('curso_id', cursoId);
  await admin.from('clases').delete().eq('curso_id', cursoId);
  await admin.from('cursos').delete().eq('id', cursoId);
}

export async function getAllCursosForTutor(tutorId, excludeId = null) {
  let q = supabase
    .from('cursos')
    .select('id, nombre, dias_horario, hora_inicio, hora_fin')
    .eq('tutor_id', tutorId);
  if (excludeId) q = q.neq('id', excludeId);
  const { data } = await q;
  return data ?? [];
}
