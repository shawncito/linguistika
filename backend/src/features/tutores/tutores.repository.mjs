import { supabase } from '../../shared/config/supabaseClient.mjs';
import { AppError } from '../../shared/errors/AppError.mjs';

function normalizeName(value) {
  return String(value ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function escapeLike(value) {
  return String(value ?? '').replace(/[%_]/g, '\\$&');
}

export async function findAll() {
  const { data, error } = await supabase
    .from('tutores')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((t) => ({ ...t, estado: t.estado ? 1 : 0 }));
}

export async function findById(id) {
  const { data, error } = await supabase
    .from('tutores')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new AppError('Tutor no encontrado', 404);
  return { ...data, estado: data.estado ? 1 : 0 };
}

export async function create(payload) {
  const { nombre, email, telefono, especialidad, color, dias_turno, dias_horarios, es_especializado, niveles_apto, tarifa_por_hora, userId } = payload;
  const tarifa = Number(tarifa_por_hora);
  const tarifaSafe = Number.isFinite(tarifa) ? tarifa : 0;

  const nombreKey = normalizeName(nombre);
  const like = escapeLike(nombreKey);

  const { data: existing } = await supabase
    .from('tutores')
    .select('id')
    .ilike('nombre', like)
    .limit(1);

  if ((existing ?? []).length > 0) throw new AppError('Ya existe un tutor con ese nombre', 409);

  // Intentar con columna color (migration 023 la añadió)
  const withColor = {
    nombre: String(nombre ?? '').trim(),
    email: email || null,
    telefono: telefono || null,
    especialidad: especialidad || null,
    color: color || null,
    dias_turno: dias_turno ? JSON.stringify(dias_turno) : null,
    dias_horarios: dias_horarios ? JSON.stringify(dias_horarios) : null,
    es_especializado: !!es_especializado,
    niveles_apto: niveles_apto || [],
    tarifa_por_hora: tarifaSafe,
    created_by: userId,
    estado: true,
  };

  let { data, error } = await supabase.from('tutores').insert(withColor).select().single();

  if (error && (String(error?.code) === '42703' || String(error?.message || '').includes('color'))) {
    const { color: _c, ...withoutColor } = withColor;
    const retry = await supabase.from('tutores').insert(withoutColor).select().single();
    data = retry.data;
    error = retry.error;
  }

  if (error) throw error;
  return data;
}

export async function update(id, payload) {
  const { userId, ...fields } = payload;
  const updateData = { updated_by: userId, updated_at: new Date().toISOString() };

  if (fields.nombre !== undefined) updateData.nombre = fields.nombre;
  if (fields.email !== undefined) updateData.email = fields.email || null;
  if (fields.telefono !== undefined) updateData.telefono = fields.telefono || null;
  if (fields.especialidad !== undefined) updateData.especialidad = fields.especialidad || null;
  if (fields.color !== undefined) updateData.color = fields.color || null;
  if (fields.dias_turno !== undefined) updateData.dias_turno = fields.dias_turno ? JSON.stringify(fields.dias_turno) : null;
  if (fields.dias_horarios !== undefined) updateData.dias_horarios = fields.dias_horarios ? JSON.stringify(fields.dias_horarios) : null;
  if (fields.es_especializado !== undefined) updateData.es_especializado = !!fields.es_especializado;
  if (fields.niveles_apto !== undefined) updateData.niveles_apto = fields.niveles_apto || [];
  if (fields.tarifa_por_hora !== undefined) {
    const tarifa = Number(fields.tarifa_por_hora);
    updateData.tarifa_por_hora = Number.isFinite(tarifa) ? tarifa : 0;
  }
  if (fields.estado !== undefined) updateData.estado = fields.estado === 1 || fields.estado === true;

  const { data, error } = await supabase
    .from('tutores')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return { ...data, estado: data.estado ? 1 : 0 };
}

export async function remove(id) {
  const { error } = await supabase.from('tutores').delete().eq('id', id);
  if (error) throw error;
  return { message: 'Tutor eliminado correctamente' };
}
