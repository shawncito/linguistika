import { supabase } from '../../shared/config/supabaseClient.mjs';
import { schemaErrorPayload } from '../../shared/utils/schemaErrors.mjs';

const isValidISODate = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
const toIntOrNull = (v) => { if (v == null || v === '') return null; const n = Number.parseInt(String(v), 10); return Number.isFinite(n) ? n : null; };
const isMissingColumnError = (error, col) => {
  const msg = String(error?.message || '').toLowerCase();
  return msg.includes('column') && msg.includes(col.toLowerCase()) && msg.includes('not exist');
};

// ─────────── PAGOS CRUD ──────────────────────────────────────────────────────

export async function findAll() {
  const { data, error } = await supabase
    .from('pagos')
    .select('*, tutores:tutor_id(nombre)')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function findById(id) {
  const { data, error } = await supabase
    .from('pagos')
    .select('*, tutores:tutor_id(nombre)')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function createPago({ tutor_id, clase_id, cantidad_clases, monto, descripcion, estado, periodo_inicio, periodo_fin, userId }) {
  const baseInsert = { tutor_id, clase_id, cantidad_clases, monto, descripcion, created_by: userId, estado: estado || 'pendiente' };
  const withPeriodo = {
    ...baseInsert,
    ...(isValidISODate(periodo_inicio) ? { periodo_inicio } : {}),
    ...(isValidISODate(periodo_fin) ? { periodo_fin } : {}),
  };

  let { data, error } = await supabase.from('pagos').insert(withPeriodo).select('*, tutores:tutor_id(nombre)').single();
  if (error && (isMissingColumnError(error, 'periodo_inicio') || isMissingColumnError(error, 'periodo_fin'))) {
    const retry = await supabase.from('pagos').insert(baseInsert).select('*, tutores:tutor_id(nombre)').single();
    data = retry.data;
    error = retry.error;
  }
  if (error) throw error;
  return { ...data, tutor_nombre: data.tutores?.nombre };
}

export async function updatePago(id, fields) {
  const { data, error } = await supabase.from('pagos').update(fields).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

// ─────────── PENDIENTES ──────────────────────────────────────────────────────

export async function getPendientesResumen({ tutor_id, fecha_inicio, fecha_fin }) {
  const baseSelect = 'id,tutor_id,curso_id,matricula_id,fecha_pago,monto,estado,tipo';
  let query = supabase.from('movimientos_dinero')
    .select(`${baseSelect},pago_id`)
    .eq('tutor_id', String(tutor_id))
    .eq('tipo', 'pago_tutor_pendiente')
    .eq('estado', 'pendiente')
    .is('pago_id', null);

  if (fecha_inicio) query = query.gte('fecha_pago', fecha_inicio);
  if (fecha_fin) query = query.lte('fecha_pago', fecha_fin);

  let { data, error } = await query;

  if (error && isMissingColumnError(error, 'pago_id')) {
    let q2 = supabase.from('movimientos_dinero')
      .select(baseSelect)
      .eq('tutor_id', String(tutor_id))
      .eq('tipo', 'pago_tutor_pendiente')
      .eq('estado', 'pendiente');
    if (fecha_inicio) q2 = q2.gte('fecha_pago', fecha_inicio);
    if (fecha_fin) q2 = q2.lte('fecha_pago', fecha_fin);
    const res2 = await q2;
    data = res2.data;
    error = res2.error;
  }
  if (error) throw error;
  return data ?? [];
}

export async function getPendientesResumenTutores() {
  const { data: tutores, error: tErr } = await supabase.from('tutores').select('id, nombre').order('nombre');
  if (tErr) throw tErr;
  const { data: movs, error: mErr } = await supabase.from('movimientos_dinero')
    .select('tutor_id, monto').eq('tipo', 'pago_tutor_pendiente').eq('estado', 'pendiente');
  if (mErr) throw mErr;
  const totals = new Map();
  for (const m of movs ?? []) {
    const prev = totals.get(m.tutor_id) || 0;
    totals.set(m.tutor_id, prev + (Number(m.monto) || 0));
  }
  return (tutores ?? []).map(t => ({ tutor_id: t.id, tutor_nombre: t.nombre, total_pendiente: totals.get(t.id) || 0 }));
}

export async function getPendientesDetalleTutor({ tutor_id, fecha_inicio, fecha_fin }) {
  let query = supabase.from('movimientos_dinero')
    .select(`id,tutor_id,curso_id,matricula_id,sesion_id,fecha_pago,monto,estado,tipo,origen,periodo_inicio,periodo_fin,
             curso:curso_id(nombre),
             matricula:matricula_id(estudiante_id,estudiante:estudiante_id(nombre))`)
    .eq('tutor_id', String(tutor_id)).eq('tipo', 'pago_tutor_pendiente').eq('estado', 'pendiente');
  if (fecha_inicio) query = query.gte('fecha_pago', fecha_inicio);
  if (fecha_fin) query = query.lte('fecha_pago', fecha_fin);
  let { data, error } = await query;
  if (error) {
    let q2 = supabase.from('movimientos_dinero')
      .select('id,tutor_id,curso_id,matricula_id,sesion_id,fecha_pago,monto,estado,tipo')
      .eq('tutor_id', String(tutor_id)).eq('tipo', 'pago_tutor_pendiente').eq('estado', 'pendiente');
    if (fecha_inicio) q2 = q2.gte('fecha_pago', fecha_inicio);
    if (fecha_fin) q2 = q2.lte('fecha_pago', fecha_fin);
    const r2 = await q2;
    data = r2.data; error = r2.error;
  }
  if (error) throw error;
  return data ?? [];
}

// ─────────── LIBRO DIARIO ────────────────────────────────────────────────────

function isRealIngresoTipo(tipo) {
  return tipo === 'ingreso_estudiante' || tipo.startsWith('ingreso_');
}

function isRealEstado(estado) {
  return estado == null || estado === 'completado' || estado === 'verificado';
}

const parseNotesForComprobanteUrl = (notas) => {
  const m = String(notas || '').match(/COMPROBANTE_URL:([^\s]+)/);
  return m ? m[1] : null;
};

export async function getLibroDiario({ start, end, tutorId, incluirPendientes, onlyTotals }) {
  let q = supabase.from('movimientos_dinero')
    .select(onlyTotals ? 'tipo,monto,estado' : `id,tipo,monto,estado,fecha_pago,fecha_comprobante,factura_numero,notas,origen,periodo_inicio,periodo_fin,
       tutor_id,curso_id,matricula_id,sesion_id,created_at,
       tutor:tutor_id(nombre),curso:curso_id(nombre),
       matricula:matricula_id(id,estudiante:estudiante_id(nombre))`)
    .gte('fecha_pago', start).lte('fecha_pago', end);
  if (tutorId) q = q.eq('tutor_id', tutorId);
  if (!incluirPendientes) q = q.or('estado.is.null,estado.in.(completado,verificado)');
  if (!onlyTotals) q = q.order('fecha_pago', { ascending: true }).order('id', { ascending: true });
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map(m => {
    const tipo = String(m?.tipo || '');
    const monto = Number(m?.monto) || 0;
    const isIngreso = incluirPendientes ? (tipo === 'ingreso_estudiante' || tipo.startsWith('ingreso_')) : isRealIngresoTipo(tipo);
    const isEgreso = tipo === 'pago_tutor_pendiente' || tipo === 'pago_tutor' || tipo.startsWith('pago_') || tipo.startsWith('egreso_');
    if (!onlyTotals && !incluirPendientes && !isRealEstado(m?.estado)) return null;
    return { ...m, debe: isIngreso ? monto : 0, haber: isEgreso ? monto : 0, comprobante_url: onlyTotals ? undefined : parseNotesForComprobanteUrl(m?.notas) };
  }).filter(Boolean);
}

// ─────────── COMPROBANTES ─────────────────────────────────────────────────────

export async function getMovimientoDineroById(id) {
  const { data, error } = await supabase.from('movimientos_dinero').select('id,notas,curso_id').eq('id', id).maybeSingle();
  if (error) throw error;
  return data;
}

export async function updateMovimientoNotas(id, notas) {
  const { error } = await supabase.from('movimientos_dinero').update({ notas, updated_at: new Date().toISOString() }).eq('id', id);
  if (error) throw error;
}

export async function createComprobante(row) {
  const { data, error } = await supabase.from('comprobantes_ingresos').insert(row).select().single();
  if (error) throw error;
  return data;
}

export async function createMovimientoFinanciero(row) {
  const { data, error } = await supabase.from('movimientos_financieros').insert(row).select('id').single();
  if (error) return null;
  return data?.id ?? null;
}

// ─────────── MOVIMIENTO MANUAL ────────────────────────────────────────────────

export async function getMatriculaByEstudiante(estudianteId) {
  const { data, error } = await supabase.from('matriculas')
    .select('id,curso_id,tutor_id').eq('estudiante_id', String(estudianteId)).order('id', { ascending: false }).limit(1);
  if (error) throw error;
  return data?.[0] ?? null;
}

export async function getLatestCursoByTutor(tutorId) {
  const { data } = await supabase.from('cursos').select('id').eq('tutor_id', String(tutorId)).order('id', { ascending: false }).limit(1);
  return toIntOrNull(data?.[0]?.id ?? null);
}

export async function getLastCurso() {
  const { data } = await supabase.from('cursos').select('id').order('id', { ascending: false }).limit(1);
  return toIntOrNull(data?.[0]?.id ?? null);
}

export async function insertMovimientoDinero(row) {
  const { data, error } = await supabase.from('movimientos_dinero').insert(row)
    .select(`id,tipo,monto,estado,fecha_pago,fecha_comprobante,factura_numero,notas,origen,periodo_inicio,periodo_fin,
             tutor_id,curso_id,matricula_id,sesion_id,created_at,
             tutor:tutor_id(nombre),curso:curso_id(nombre),
             matricula:matricula_id(id,estudiante:estudiante_id(nombre))`)
    .single();
  if (error) throw error;
  return data;
}

// ─────────── BULK COMPROBANTE ─────────────────────────────────────────────────

export async function findMovimientosByIds(ids) {
  const { data, error } = await supabase.from('movimientos_dinero').select('id,notas').in('id', ids);
  if (error) throw error;
  return data ?? [];
}
