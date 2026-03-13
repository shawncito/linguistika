import { supabase, supabaseAdmin } from '../../shared/config/supabaseClient.mjs';
import { AppError } from '../../shared/errors/AppError.mjs';

function parseJsonField(value) {
  if (!value) return null;
  if (typeof value === 'object') return value;
  try { return JSON.parse(value); } catch { return null; }
}

function normalizeStudent(s) {
  return {
    ...s,
    estado: s.estado ? 1 : 0,
    dias: parseJsonField(s.dias),
    dias_turno: parseJsonField(s.dias_turno),
    // compatibilidad matricula_grupo_id
    matricula_grupo_id: s.matricula_grupo_id || s.grupo_id || null,
  };
}

function isMissingEdadColumnError(error) {
  const msg = String(error?.message || '').toLowerCase();
  return String(error?.code || '') === '42703'
    || (msg.includes('could not find the') && msg.includes('edad') && msg.includes('column'))
    || (msg.includes('column') && msg.includes('edad') && msg.includes('does not exist'));
}

export async function findAll() {
  const { data, error } = await supabase
    .from('estudiantes')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(normalizeStudent);
}

export async function findById(id) {
  const { data, error } = await supabase
    .from('estudiantes')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new AppError('Estudiante no encontrado', 404);
  return normalizeStudent(data);
}

export async function findByName(nombre) {
  const { data } = await supabase
    .from('estudiantes')
    .select('id')
    .ilike('nombre', nombre)
    .limit(1);
  return data ?? [];
}

export async function findByNameInBulk(nombre) {
  const { data } = await supabase
    .from('estudiantes_bulk')
    .select('id')
    .ilike('nombre', nombre)
    .limit(1);
  return data ?? [];
}

export async function create(payload) {
  const baseRow = {
    nombre: payload.nombre,
    nivel: payload.nivel || null,
    telefono: payload.telefono || null,
    dias: payload.dias ? JSON.stringify(payload.dias) : null,
    dias_turno: payload.dias_turno ? JSON.stringify(payload.dias_turno) : null,
    notas: payload.notas || null,
    estado: true,
    encargado_id: payload.encargado_id || null,
    created_by: payload.userId,
  };

  const withEdad = {
    ...baseRow,
    edad: payload.edad || null,
  };

  let { data, error } = await supabase.from('estudiantes').insert(withEdad).select().single();

  if (error && isMissingEdadColumnError(error)) {
    const retry = await supabase.from('estudiantes').insert(baseRow).select().single();
    data = retry.data;
    error = retry.error;
  }

  if (error) throw error;
  return normalizeStudent(data);
}

export async function update(id, payload) {
  const updateData = {};
  if (payload.nombre !== undefined) updateData.nombre = payload.nombre;
  if (payload.edad !== undefined) updateData.edad = payload.edad;
  if (payload.nivel !== undefined) updateData.nivel = payload.nivel;
  if (payload.telefono !== undefined) updateData.telefono = payload.telefono || null;
  if (payload.dias !== undefined) updateData.dias = payload.dias ? JSON.stringify(payload.dias) : null;
  if (payload.dias_turno !== undefined) updateData.dias_turno = payload.dias_turno ? JSON.stringify(payload.dias_turno) : null;
  if (payload.notas !== undefined) updateData.notas = payload.notas;
  if (payload.estado !== undefined) updateData.estado = payload.estado === 1 || payload.estado === true;
  if (payload.encargado_id !== undefined) updateData.encargado_id = payload.encargado_id;
  updateData.updated_by = payload.userId;

  let { data, error } = await supabase
    .from('estudiantes')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error && payload.edad !== undefined && isMissingEdadColumnError(error)) {
    const { edad: _omitEdad, ...fallbackData } = updateData;
    const retry = await supabase
      .from('estudiantes')
      .update(fallbackData)
      .eq('id', id)
      .select()
      .single();
    data = retry.data;
    error = retry.error;
  }

  if (error) throw error;
  return normalizeStudent(data);
}

export async function findEncargadoById(encargadoId) {
  const { data } = await supabase
    .from('encargados')
    .select('id')
    .eq('id', encargadoId)
    .maybeSingle();
  return data;
}

export async function countEstudiantesByEncargado(encargadoId) {
  const { count } = await supabase
    .from('estudiantes')
    .select('*', { count: 'exact', head: true })
    .eq('encargado_id', encargadoId);
  return count ?? 1;
}

export async function deleteEncargadoAccount(encargadoId) {
  const admin = supabaseAdmin;
  if (!admin) return;
  // Eliminar cuentas tesorería del encargado
  await admin.from('tesoreria_cuentas_corrientes').delete().eq('encargado_id', encargadoId);
  await admin.from('encargados').delete().eq('id', encargadoId);
}

export async function remove(id) {
  const { error } = await supabase.from('estudiantes').delete().eq('id', id);
  if (error) throw error;
  return { message: 'Estudiante eliminado correctamente' };
}
