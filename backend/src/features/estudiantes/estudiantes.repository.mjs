import { supabase, supabaseAdmin } from '../../shared/config/supabaseClient.mjs';
import { AppError } from '../../shared/errors/AppError.mjs';

function parseJsonField(value) {
  if (!value) return null;
  if (typeof value === 'object') return value;
  try { return JSON.parse(value); } catch { return null; }
}

function normalizeStudent(s) {
  const grado = s.grado ?? s.nivel ?? null;
  const nombreEncargado = s.nombre_encargado ?? s.encargado_nombre ?? null;
  const emailEncargado = s.email_encargado ?? s.encargado_email ?? null;
  const telefonoEncargado = s.telefono_encargado ?? s.encargado_telefono ?? null;

  return {
    ...s,
    grado,
    nivel: s.nivel ?? grado,
    nombre_encargado: nombreEncargado,
    email_encargado: emailEncargado,
    telefono_encargado: telefonoEncargado,
    estado: s.estado ? 1 : 0,
    dias: parseJsonField(s.dias),
    dias_turno: parseJsonField(s.dias_turno),
    // compatibilidad matricula_grupo_id
    matricula_grupo_id: s.matricula_grupo_id || s.grupo_id || null,
  };
}

function getMissingColumnName(error) {
  const message = String(error?.message || '');
  const schemaCacheMatch = message.match(/Could not find the '([^']+)' column of '([^']+)'/i);
  if (schemaCacheMatch?.[1]) return schemaCacheMatch[1];

  const columnOnlyMatch = message.match(/column\s+"?([a-zA-Z0-9_]+)"?\s+does not exist/i);
  if (columnOnlyMatch?.[1]) return columnOnlyMatch[1];

  return null;
}

async function insertWithMissingColumnFallback(table, row, maxRetries = 10) {
  const workingRow = { ...row };
  for (let i = 0; i < maxRetries; i += 1) {
    const result = await supabase.from(table).insert(workingRow).select().single();
    if (!result.error) return result;

    const missingColumn = getMissingColumnName(result.error);
    if (!missingColumn || !Object.prototype.hasOwnProperty.call(workingRow, missingColumn)) {
      return result;
    }

    delete workingRow[missingColumn];
  }

  return supabase.from(table).insert(workingRow).select().single();
}

async function updateWithMissingColumnFallback(table, id, row, maxRetries = 10) {
  const workingRow = { ...row };
  for (let i = 0; i < maxRetries; i += 1) {
    const result = await supabase
      .from(table)
      .update(workingRow)
      .eq('id', id)
      .select()
      .single();

    if (!result.error) return result;

    const missingColumn = getMissingColumnName(result.error);
    if (!missingColumn || !Object.prototype.hasOwnProperty.call(workingRow, missingColumn)) {
      return result;
    }

    delete workingRow[missingColumn];
  }

  return supabase
    .from(table)
    .update(workingRow)
    .eq('id', id)
    .select()
    .single();
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
  const grado = payload.grado ?? payload.nivel ?? null;
  const nombreEncargado = payload.nombre_encargado ?? payload.encargado_nombre ?? null;
  const emailEncargado = payload.email_encargado ?? payload.encargado_email ?? null;
  const telefonoEncargado = payload.telefono_encargado ?? payload.encargado_telefono ?? null;

  const row = {
    nombre: payload.nombre,
    grado,
    nivel: grado,
    nombre_encargado: nombreEncargado,
    email_encargado: emailEncargado,
    telefono_encargado: telefonoEncargado,
    encargado_nombre: nombreEncargado,
    encargado_email: emailEncargado,
    encargado_telefono: telefonoEncargado,
    telefono: payload.telefono || null,
    dias: payload.dias ? JSON.stringify(payload.dias) : null,
    dias_turno: payload.dias_turno ? JSON.stringify(payload.dias_turno) : null,
    notas: payload.notas || null,
    estado: true,
    encargado_id: payload.encargado_id || null,
    created_by: payload.userId,
  };

  if (payload.edad !== undefined) {
    row.edad = payload.edad || null;
  }

  const { data, error } = await insertWithMissingColumnFallback('estudiantes', row);

  if (error) throw error;
  return normalizeStudent(data);
}

export async function update(id, payload) {
  const updateData = {};
  if (payload.nombre !== undefined) updateData.nombre = payload.nombre;

  if (payload.edad !== undefined) updateData.edad = payload.edad;

  if (payload.grado !== undefined || payload.nivel !== undefined) {
    const grado = payload.grado ?? payload.nivel ?? null;
    updateData.grado = grado;
    updateData.nivel = grado;
  }

  if (payload.nombre_encargado !== undefined || payload.encargado_nombre !== undefined) {
    const value = payload.nombre_encargado ?? payload.encargado_nombre ?? null;
    updateData.nombre_encargado = value;
    updateData.encargado_nombre = value;
  }

  if (payload.email_encargado !== undefined || payload.encargado_email !== undefined) {
    const value = payload.email_encargado ?? payload.encargado_email ?? null;
    updateData.email_encargado = value;
    updateData.encargado_email = value;
  }

  if (payload.telefono_encargado !== undefined || payload.encargado_telefono !== undefined) {
    const value = payload.telefono_encargado ?? payload.encargado_telefono ?? null;
    updateData.telefono_encargado = value;
    updateData.encargado_telefono = value;
  }

  if (payload.telefono !== undefined) updateData.telefono = payload.telefono || null;
  if (payload.dias !== undefined) updateData.dias = payload.dias ? JSON.stringify(payload.dias) : null;
  if (payload.dias_turno !== undefined) updateData.dias_turno = payload.dias_turno ? JSON.stringify(payload.dias_turno) : null;
  if (payload.notas !== undefined) updateData.notas = payload.notas;
  if (payload.estado !== undefined) updateData.estado = payload.estado === 1 || payload.estado === true;
  if (payload.encargado_id !== undefined) updateData.encargado_id = payload.encargado_id;
  updateData.updated_by = payload.userId;

  const { data, error } = await updateWithMissingColumnFallback('estudiantes', id, updateData);

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
