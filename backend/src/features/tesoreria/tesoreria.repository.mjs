/**
 * tesoreria.repository.mjs
 *
 * Acceso a BD de tesorería: vistas, consultas, pagos, exportaciones ExcelJS.
 */

import path from 'path';
import { fileURLToPath } from 'url';
import ExcelJS from 'exceljs';
import { createClient } from '@supabase/supabase-js';
import { supabase, supabaseAdmin } from '../../shared/config/supabaseClient.mjs';
import { registrarPagoEncargadoV1, registrarPagoTutorV1, updatePagoEvidenciaYEstado } from '../../shared/utils/tesoreria/registrarMovimiento.mjs';
import { AppError } from '../../shared/errors/AppError.mjs';
import { TESORERIA_DEFAULT_LIMIT, TESORERIA_MAX_LIMIT } from './tesoreria.schemas.mjs';

/* ─── helpers ────────────────────────────────────────────────────────────── */

export function isValidISODate(v) {
  if (!v || typeof v !== 'string') return false;
  return /^\d{4}-\d{2}-\d{2}$/.test(v.trim());
}

export function isValidISOMonth(v) {
  if (!v || typeof v !== 'string') return false;
  return /^\d{4}-\d{2}$/.test(v.trim());
}

function isMissingRelationError(err) {
  if (!err) return false;
  const msg = String(err?.message ?? '').toLowerCase();
  return msg.includes('does not exist') || msg.includes('relation') || msg.includes('schema');
}

function getLastDayOfMonthISO(mesYYYYMM) {
  const [y, m] = String(mesYYYYMM).split('-').map(Number);
  const d = new Date(y, m, 0); // day 0 of next month = last day of this month
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${mm}-${dd}`;
}

// Crea un cliente anon fresco para verificar contraseñas (sin persistir sesión)
function createAuthClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key) throw new AppError('Configuración de Supabase incompleta.', 503);
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function verifyUserPassword(email, password) {
  const client = createAuthClient();
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error || !data?.user) {
    const msg = String(error?.message ?? '').toLowerCase();
    if (msg.includes('invalid') || msg.includes('credentials') || msg.includes('email')) throw new AppError('Contraseña o email incorrectos.', 401);
    throw new AppError(`Error al verificar contraseña: ${error?.message ?? 'desconocido'}`, 500);
  }
  try { await client.auth.signOut(); } catch { /* ignorar */ }
  return data.user;
}

/* ─── constructor de consulta al libro diario ────────────────────────────── */

function buildLibroQuery({ singleDate, mesParam, start, end, includePendientes, encargadoIdNum, tutorIdNum, cuentaIdNum, ascending = false, limitNum = TESORERIA_DEFAULT_LIMIT }) {
  const db = supabaseAdmin ?? supabase;
  let query = db.from('tesoreria_libro_diario_v1').select('*', { count: 'exact' });
  if (cuentaIdNum) {
    query = query.eq('cuenta_id', cuentaIdNum);
  } else if (encargadoIdNum) {
    query = query.eq('encargado_id', encargadoIdNum);
  } else if (tutorIdNum) {
    query = query.eq('tutor_id', tutorIdNum);
  }
  if (singleDate) {
    query = query.eq('fecha', singleDate);
  } else if (mesParam) {
    const mesStart = `${mesParam}-01`;
    const mesEnd = getLastDayOfMonthISO(mesParam);
    query = query.gte('fecha', mesStart).lte('fecha', mesEnd);
  } else {
    if (start) query = query.gte('fecha', start);
    if (end) query = query.lte('fecha', end);
  }
  if (!includePendientes) {
    query = query.not('estado', 'eq', 'pendiente');
  }
  query = query.order('fecha', { ascending }).order('created_at', { ascending }).limit(limitNum);
  return query;
}

/* ─── escritura Excel ───────────────────────────────────────────────────── */

export async function writeXlsx({ res, filename, sheetName, columns, rows }) {
  const workbook = new ExcelJS.Workbook();
  workbook.created = new Date(); workbook.modified = new Date();
  const ws = workbook.addWorksheet(sheetName || 'Datos');
  ws.columns = columns.map((c) => ({ header: c.label || c.key, key: c.key, width: c.width || 20 }));
  const headerRow = ws.getRow(1);
  headerRow.font = { bold: true }; headerRow.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }; headerRow.height = 20;
  ws.views = [{ state: 'frozen', ySplit: 1 }];
  for (const row of rows) { ws.addRow(row); }
  const buffer = await workbook.xlsx.writeBuffer();
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Length', buffer.byteLength);
  res.send(Buffer.from(buffer));
}

/* ─── Resumen encargados ─────────────────────────────────────────────────── */

export async function getResumenEncargados() {
  const db = supabaseAdmin ?? supabase;

  // 1. Encargados con saldos en tesorería (tienen cuenta corriente)
  const { data: saldos, error: sErr } = await db
    .from('tesoreria_saldos_encargados_v1')
    .select('*, encargados(id, nombre, email, telefono)');
  if (sErr) throw sErr;

  // 2. Todos los encargados que tienen al menos un estudiante vinculado
  const { data: allEnc, error: aErr } = await db
    .from('encargados')
    .select('id, nombre, email, telefono');
  if (aErr) throw aErr;

  // Merge: saldos indexados por encargado_id
  const saldoMap = new Map();
  for (const row of saldos ?? []) {
    saldoMap.set(row.encargado_id, row);
  }

  // Agregar encargados que no están en saldos
  for (const enc of allEnc ?? []) {
    if (!saldoMap.has(enc.id)) {
      saldoMap.set(enc.id, {
        encargado_id: enc.id,
        cuenta_id: null,
        deuda_pendiente: 0,
        saldo_a_favor: 0,
        encargados: { id: enc.id, nombre: enc.nombre, email: enc.email, telefono: enc.telefono },
      });
    }
  }

  return [...saldoMap.values()].map(row => ({
    cuenta_id: row.cuenta_id,
    encargado_id: row.encargado_id,
    deuda_pendiente: Number(row.deuda_pendiente) || 0,
    saldo_a_favor: Number(row.saldo_a_favor) || 0,
    balance_neto: (Number(row.deuda_pendiente) || 0) - (Number(row.saldo_a_favor) || 0),
    estado: (Number(row.deuda_pendiente) || 0) > 0 ? 'deuda' : (Number(row.saldo_a_favor) || 0) > 0 ? 'saldo_favor' : 'al_dia',
    encargados: row.encargados,
  }));
}

/* ─── Resumen tutores ────────────────────────────────────────────────────── */

export async function getResumenTutores() {
  const db = supabaseAdmin ?? supabase;
  const { data, error } = await db.from('tesoreria_saldos_tutores_v1').select('*');
  if (error) throw error;
  return data ?? [];
}

/* ─── Libro diario ───────────────────────────────────────────────────────── */

export async function getDiario({ singleDate, mes, start, end, includePendientes, encargadoId, tutorId, cuentaId, ascending, limit }) {
  const limitNum = Math.min(parseInt(String(limit ?? TESORERIA_DEFAULT_LIMIT), 10) || TESORERIA_DEFAULT_LIMIT, TESORERIA_MAX_LIMIT);
  const encargadoIdNum = encargadoId ? parseInt(String(encargadoId), 10) : null;
  const tutorIdNum = tutorId ? parseInt(String(tutorId), 10) : null;
  const cuentaIdNum = cuentaId ? parseInt(String(cuentaId), 10) : null;
  const { data, error, count } = await buildLibroQuery({ singleDate, mesParam: mes, start, end, includePendientes: includePendientes !== false, encargadoIdNum, tutorIdNum, cuentaIdNum, ascending: ascending === true || ascending === '1' || ascending === 'true', limitNum });
  if (error) { if (isMissingRelationError(error)) return { items: [], count: 0, limit: limitNum, error: error.message }; throw error; }
  return { items: data ?? [], count: count ?? 0, limit: limitNum };
}

/* ─── Movimientos por encargado/tutor/cuenta ─────────────────────────────── */

export async function getMovimientosEncargado({ encargadoId, ...rest }) {
  const db = supabaseAdmin ?? supabase;
  const encargadoIdNum = parseInt(String(encargadoId), 10);
  const { data: cuenta, error: cErr } = await db.from('tesoreria_cuentas_corrientes').select('id').eq('encargado_id', encargadoIdNum).maybeSingle();
  if (cErr) throw cErr;
  if (!cuenta) throw new AppError('No se encontró cuenta de tesorería para este encargado.', 404);
  return getDiario({ ...rest, cuentaId: cuenta.id });
}

export async function getMovimientosTutor({ tutorId, ...rest }) {
  const db = supabaseAdmin ?? supabase;
  const tutorIdNum = parseInt(String(tutorId), 10);
  const { data: cuenta, error: cErr } = await db.from('tesoreria_cuentas_corrientes').select('id').eq('tutor_id', tutorIdNum).maybeSingle();
  if (cErr) throw cErr;
  if (!cuenta) throw new AppError('No se encontró cuenta de tesorería para este tutor.', 404);
  return getDiario({ ...rest, cuentaId: cuenta.id });
}

/* ─── Exportar Excel ─────────────────────────────────────────────────────── */

const LIBRO_COLUMNS = [
  { key: 'fecha', label: 'Fecha', width: 14 },
  { key: 'tipo_movimiento', label: 'Tipo', width: 16 },
  { key: 'descripcion', label: 'Descripción', width: 40 },
  { key: 'debe', label: 'Debe', width: 14 },
  { key: 'haber', label: 'Haber', width: 14 },
  { key: 'saldo_resultante', label: 'Saldo', width: 14 },
  { key: 'estado', label: 'Estado', width: 14 },
  { key: 'referencia', label: 'Referencia', width: 20 },
  { key: 'responsable_nombre', label: 'Responsable', width: 22 },
];

export async function exportDiario({ res, ...params }) {
  const diario = await getDiario({ ...params, limit: TESORERIA_MAX_LIMIT });
  const rows = (diario.items || []).map((item) => LIBRO_COLUMNS.reduce((obj, col) => { obj[col.key] = item[col.key] ?? ''; return obj; }, {}));
  await writeXlsx({ res, filename: 'libro_diario.xlsx', sheetName: 'Libro Diario', columns: LIBRO_COLUMNS, rows });
}

export async function exportCuenta({ res, cuentaId, ...params }) {
  const diario = await getDiario({ ...params, cuentaId, limit: TESORERIA_MAX_LIMIT });
  const rows = (diario.items || []).map((item) => LIBRO_COLUMNS.reduce((obj, col) => { obj[col.key] = item[col.key] ?? ''; return obj; }, {}));
  await writeXlsx({ res, filename: `cuenta_${cuentaId}.xlsx`, sheetName: 'Movimientos', columns: LIBRO_COLUMNS, rows });
}

/* ─── Aplicaciones de pago ───────────────────────────────────────────────── */

export async function getPagoAplicaciones(pagoId) {
  const db = supabaseAdmin ?? supabase;
  const { data: pago, error: pErr } = await db.from('tesoreria_pagos').select('*').eq('id', pagoId).maybeSingle();
  if (pErr) throw pErr;
  if (!pago) throw new AppError('Pago no encontrado.', 404);
  const { data: aplicaciones, error: aErr } = await db.from('tesoreria_aplicaciones').select('*, tesoreria_obligaciones(id, detalle, monto, fecha_devengo)').eq('pago_id', pagoId).order('created_at', { ascending: false });
  if (aErr) throw aErr;
  return { pago, aplicaciones: aplicaciones ?? [] };
}

/* ─── Resumen general ────────────────────────────────────────────────────── */

export async function getResumen() {
  const db = supabaseAdmin ?? supabase;
  const [encRes, tutRes, cgRes] = await Promise.all([
    db.from('tesoreria_saldos_encargados_v1').select('deuda_pendiente, saldo_a_favor'),
    db.from('tesoreria_saldos_tutores_v1').select('por_pagar'),
    db.from('movimientos_dinero').select('monto').eq('estado', 'pendiente').eq('tipo', 'ingreso').eq('origen', 'cobro_grupal'),
  ]);
  if (encRes.error) throw encRes.error;
  if (tutRes.error) throw tutRes.error;
  if (cgRes.error) throw cgRes.error;
  const deudaPendiente = (encRes.data ?? []).reduce((acc, x) => acc + (Number(x?.deuda_pendiente) || 0), 0);
  const deudaCobroGrupal = (cgRes.data ?? []).reduce((acc, x) => acc + (Number(x?.monto) || 0), 0);
  const saldoAFavor = (encRes.data ?? []).reduce((acc, x) => acc + (Number(x?.saldo_a_favor) || 0), 0);
  const porPagarTutores = (tutRes.data ?? []).reduce((acc, x) => acc + (Number(x?.por_pagar) || 0), 0);
  return { deudaPendiente: deudaPendiente + deudaCobroGrupal, saldoAFavor, porPagarTutores };
}

/* ─── Bolsa ──────────────────────────────────────────────────────────────── */

export async function getBolsa() {
  const db = supabaseAdmin ?? supabase;
  const { data: pagos, error } = await db.from('tesoreria_pagos')
    .select('direccion, monto, estado')
    .in('estado', ['completado', 'verificado']);
  if (error) throw error;
  let debe_real = 0;
  let haber_real = 0;
  for (const p of pagos ?? []) {
    const monto = Number(p.monto) || 0;
    if (p.direccion === 'entrada') haber_real += monto;
    else if (p.direccion === 'salida') debe_real += monto;
  }
  const bolsa_real = haber_real - debe_real;
  return { debe_real, haber_real, bolsa_real, movimientos_count: pagos?.length || 0 };
}

/* ─── Porcentaje encargados ──────────────────────────────────────────────── */

export async function getPorcentajeEncargados() {
  const db = supabaseAdmin ?? supabase;
  let { data, error } = await db.from('tesoreria_porcentaje_encargados_v2').select('*');
  if (error) {
    if (isMissingRelationError(error)) {
      const fallback = await db.from('tesoreria_porcentaje_encargados_v1').select('*');
      if (fallback.error) throw fallback.error;
      data = fallback.data;
    } else { throw error; }
  }
  return data ?? [];
}

/* ─── Esperado diario ────────────────────────────────────────────────────── */

export async function getEsperadoDiario() {
  const db = supabaseAdmin ?? supabase;
  const { data, error } = await db.from('tesoreria_esperado_diario_v1').select('*');
  if (error) throw error;
  return data ?? [];
}

/* ─── Obligaciones ───────────────────────────────────────────────────────── */

export async function getObligacionesEncargado(encargadoId) {
  const db = supabaseAdmin ?? supabase;
  const { data: cuenta, error: cErr } = await db.from('tesoreria_cuentas_corrientes').select('id').eq('encargado_id', parseInt(String(encargadoId), 10)).maybeSingle();
  if (cErr) throw cErr;
  if (!cuenta) throw new AppError('No se encontró cuenta de tesorería para este encargado.', 404);
  const { data, error } = await db.from('tesoreria_obligaciones').select('*').eq('cuenta_id', cuenta.id).order('fecha_devengo', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function getObligacionesTutor(tutorId) {
  const db = supabaseAdmin ?? supabase;
  const { data: cuenta, error: cErr } = await db.from('tesoreria_cuentas_corrientes').select('id').eq('tutor_id', parseInt(String(tutorId), 10)).maybeSingle();
  if (cErr) throw cErr;
  if (!cuenta) throw new AppError('No se encontró cuenta de tesorería para este tutor.', 404);
  const { data, error } = await db.from('tesoreria_obligaciones').select('*').eq('cuenta_id', cuenta.id).order('fecha_devengo', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

/* ─── Pagos ──────────────────────────────────────────────────────────────── */

export async function registrarPagoEncargado({ encargadoId, body, userId }) {
  return registrarPagoEncargadoV1({ encargadoId, ...body, registradoPor: userId });
}

export async function registrarPagoTutor({ tutorId, body, userId }) {
  return registrarPagoTutorV1({ tutorId, ...body, registradoPor: userId });
}

export async function actualizarPagoComprobante({ pagoId, file, body, userId }) {
  return updatePagoEvidenciaYEstado({ pagoId, file, ...body, userId });
}

/* ─── Cobro grupal ───────────────────────────────────────────────────────── */

export async function registrarCobroGrupal({ grupoId, body, userId }) {
  const db = supabaseAdmin ?? supabase;
  const { fecha, descripcion, monto } = body;
  if (!fecha || !monto) throw new AppError('fecha y monto son requeridos.', 422);
  const montoNum = parseFloat(String(monto));
  if (!Number.isFinite(montoNum) || montoNum <= 0) throw new AppError('monto debe ser positivo.', 422);
  const { data: grupo, error: gErr } = await db.from('matriculas_grupo').select('id, curso_id, tutor_id, nombre_grupo').eq('id', grupoId).maybeSingle();
  if (gErr) throw gErr;
  if (!grupo) throw new AppError('Grupo no encontrado.', 404);
  const { data: links, error: lErr } = await db.from('estudiantes_en_grupo').select('estudiante_bulk_id').eq('matricula_grupo_id', grupoId);
  if (lErr) throw lErr;
  const estudiantesBulkIds = (links ?? []).map((l) => l.estudiante_bulk_id);
  let estudiantesIds = [];
  const { data: normales, error: nErr } = await db.from('estudiantes').select('id').eq('matricula_grupo_id', parseInt(String(grupoId), 10));
  if (nErr && !(String(nErr?.message ?? '').toLowerCase().includes('column') && String(nErr?.message ?? '').toLowerCase().includes('does not exist'))) throw nErr;
  estudiantesIds = (normales ?? []).map((e) => e.id);
  const totalEstudiantes = estudiantesBulkIds.length + estudiantesIds.length;
  if (totalEstudiantes === 0) throw new AppError('El grupo no tiene estudiantes asignados.', 422);
  const movimientos = [];
  for (const eid of estudiantesBulkIds) {
    const { data: est, error: eErr } = await db.from('estudiantes_bulk').select('id, nombre').eq('id', eid).maybeSingle();
    if (eErr || !est) continue;
    const { error: mErr } = await db.from('movimientos_dinero').insert({ tipo: 'cobro', monto: montoNum, fecha, descripcion: descripcion ?? `Cobro grupo ${grupo.nombre_grupo}`, referencia_tabla: 'estudiantes_bulk', referencia_id: est.id, grupo_id: grupoId, created_by: userId });
    if (!mErr) movimientos.push({ tipo: 'bulk', id: est.id, nombre: est.nombre });
  }
  let tutorRegistro = null;
  if (grupo.tutor_id && movimientos.length > 0) {
    const { data: rpcResult, error: rpcErr } = await db.rpc('tesoreria_registrar_pago_tutor_v1', { p_tutor_id: grupo.tutor_id, p_monto: montoNum * movimientos.length, p_fecha: fecha, p_descripcion: descripcion ?? `Cobro grupal ${grupo.nombre_grupo}`, p_registrado_por: userId });
    if (!rpcErr) tutorRegistro = rpcResult;
  }
  return { ok: true, grupo_id: grupoId, total_estudiantes: totalEstudiantes, movimientos_registrados: movimientos.length, movimientos, tutor_pago_registrado: !!tutorRegistro };
}

export { supabase };
