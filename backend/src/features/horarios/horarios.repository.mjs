import { supabase } from '../../shared/config/supabaseClient.mjs';
import { AppError } from '../../shared/errors/AppError.mjs';

function timeToMinutes(time) {
  if (!time) return null;
  const [h, m] = String(time).split(':').map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  return h * 60 + m;
}

function normalizeDia(value) {
  return String(value ?? '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function getDiaFromISODate(fecha) {
  const d = new Date(`${fecha}T12:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  return ['domingo','lunes','martes','miercoles','jueves','viernes','sabado'][d.getDay()] ?? null;
}

export async function findByTutor(tutorId) {
  const { data, error } = await supabase
    .from('horarios_tutores')
    .select('*')
    .eq('tutor_id', tutorId)
    .eq('estado', true);
  if (error) throw error;
  return data ?? [];
}

export async function create({ tutor_id, dia_semana, hora_inicio, hora_fin, userId }) {
  const { data: tutor, error: tErr } = await supabase.from('tutores').select('id').eq('id', tutor_id).single();
  if (tErr || !tutor) throw new AppError('Tutor no existe', 400);

  const { data, error } = await supabase.from('horarios_tutores')
    .insert({ tutor_id, dia_semana, hora_inicio, hora_fin, created_by: userId, estado: true })
    .select().single();
  if (error) throw error;
  return data;
}

export async function update(id, { dia_semana, hora_inicio, hora_fin, estado, userId }) {
  const { data, error } = await supabase.from('horarios_tutores')
    .update({ dia_semana, hora_inicio, hora_fin, estado, updated_by: userId, updated_at: new Date().toISOString() })
    .eq('id', id).select().single();
  if (error) throw error;
  return data;
}

export async function deactivate(id, userId) {
  const { error } = await supabase.from('horarios_tutores')
    .update({ estado: false, updated_by: userId, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
  return { message: 'Horario desactivado correctamente' };
}

export async function getHorariosByTutorAndDia(tutorId, dia) {
  const { data, error } = await supabase.from('horarios_tutores')
    .select('id,dia_semana,hora_inicio,hora_fin,estado')
    .eq('tutor_id', tutorId).eq('estado', true);
  if (error) throw error;
  const normalized = normalizeDia(dia);
  return (data ?? []).filter((h) => {
    const v = normalizeDia(h.dia_semana);
    return v === normalized;
  });
}

export async function getMatriculaTutor(matriculaId) {
  const { data, error } = await supabase.from('matriculas').select('id,tutor_id').eq('id', matriculaId).maybeSingle();
  if (error) throw error;
  return data;
}

export async function createClase({ matricula_id, fecha, hora_inicio, hora_fin, notas, userId }) {
  const t = timeToMinutes;
  const dia = getDiaFromISODate(String(fecha));
  if (!dia) throw new AppError('fecha inválida (esperado YYYY-MM-DD)', 400);

  const hi = t(hora_inicio), hf = t(hora_fin);
  if (hi == null || hf == null || hf <= hi) throw new AppError('hora_inicio/hora_fin inválidas o rango incorrecto', 400);

  const mat = await getMatriculaTutor(matricula_id);
  if (!mat?.tutor_id) throw new AppError('No se pudo determinar el tutor de la matrícula', 400);

  const horariosDia = await getHorariosByTutorAndDia(mat.tutor_id, dia);
  const allowedRanges = horariosDia.map(h => ({ si: t(h.hora_inicio), sf: t(h.hora_fin) })).filter(r => r.si != null && r.sf != null);

  if (allowedRanges.length > 0) {
    const inside = allowedRanges.some(r => hi >= r.si && hf <= r.sf);
    if (!inside) throw new AppError(`Horario fuera del rango permitido para el tutor (${dia}).`, 409);
  }

  const { data, error } = await supabase.from('clases')
    .insert({ matricula_id, fecha, hora_inicio, hora_fin, notas, created_by: userId, estado: 'programada' })
    .select().single();
  if (error) throw error;
  return data;
}

export async function findAllClases() {
  const { data, error } = await supabase.from('clases')
    .select(`*, matriculas!inner(estudiante_id, tutor_id, estudiantes(nombre), tutores(nombre))`);
  if (error) throw error;
  return data ?? [];
}
