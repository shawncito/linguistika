import { supabase } from '../../shared/config/supabaseClient.mjs';
import AppError from '../../shared/errors/AppError.mjs';

export async function findAll({ fecha, tutor_id, estado } = {}) {
  let query = supabase
    .from('horas_trabajo')
    .select('*, tutores:tutor_id (nombre)')
    .order('fecha', { ascending: false })
    .order('created_at', { ascending: false });

  if (fecha) query = query.eq('fecha', fecha);
  if (tutor_id) query = query.eq('tutor_id', tutor_id);
  if (estado) query = query.eq('estado', estado);

  const { data, error } = await query;
  if (error) throw error;

  return (data || []).map((r) => ({ ...r, tutor_nombre: r.tutores?.nombre }));
}

export async function findById(id) {
  const { data, error } = await supabase
    .from('horas_trabajo')
    .select('*')
    .eq('id', id)
    .single();

  if (error) throw error;
  if (!data) throw new AppError('Registro no encontrado', 404);
  return data;
}

export async function fetchTarifaTutor(tutor_id) {
  const { data, error } = await supabase
    .from('tutores')
    .select('tarifa_por_hora')
    .eq('id', tutor_id)
    .single();

  if (error || !data) throw new AppError('Tutor inválido', 400);
  return Number(data.tarifa_por_hora);
}

export async function create({ tutor_id, clase_id = null, fecha, horas, tarifa_por_hora, notas = null, userId }) {
  const horasNum = Number(horas);
  const tarifa = Number(tarifa_por_hora);
  const monto = Math.round(horasNum * tarifa * 100) / 100;

  const { data, error } = await supabase
    .from('horas_trabajo')
    .insert({
      tutor_id,
      clase_id,
      fecha,
      horas: horasNum,
      tarifa_por_hora: tarifa,
      monto,
      estado: 'pendiente',
      notas,
      created_by: userId,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function update(id, { horas, tarifa_por_hora, notas }, existing) {
  const horasNum = horas === undefined ? Number(existing.horas) : Number(horas);
  const tarifa = tarifa_por_hora === undefined ? Number(existing.tarifa_por_hora) : Number(tarifa_por_hora);
  const monto = Math.round(horasNum * tarifa * 100) / 100;

  const { data, error } = await supabase
    .from('horas_trabajo')
    .update({
      horas: horasNum,
      tarifa_por_hora: tarifa,
      monto,
      notas: notas ?? existing.notas,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function aprobar(id, approverId) {
  const { data: updated, error: updateError } = await supabase
    .from('horas_trabajo')
    .update({
      estado: 'aprobado',
      approved_by: approverId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();

  if (updateError) throw updateError;
  return updated;
}

export async function crearPagoDesdeHoras(horasRow, approverId) {
  const descripcion = `Horas trabajadas (${horasRow.fecha})`;
  const { error } = await supabase
    .from('pagos')
    .insert({
      tutor_id: horasRow.tutor_id,
      clase_id: horasRow.clase_id,
      monto: horasRow.monto,
      estado: 'pendiente',
      descripcion,
      created_by: approverId,
    });

  if (error) throw error;
}
