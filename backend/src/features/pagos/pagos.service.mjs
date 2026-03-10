import * as repo from './pagos.repository.mjs';
import { AppError } from '../../shared/errors/AppError.mjs';

const isValidISODate = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
const toIntOrNull = (v) => { if (v == null || v === '') return null; const n = Number.parseInt(String(v), 10); return Number.isFinite(n) ? n : null; };

const appendComprobanteUrl = (notas, url) => {
  const base = String(notas || '').trim().replace(/COMPROBANTE_URL:[^\s]+/g, '').trim();
  const line = `COMPROBANTE_URL:${String(url || '').trim()}`;
  return base ? `${base}\n${line}` : line;
};

export function getAll() { return repo.findAll(); }
export function getById(id) { return repo.findById(id); }

export async function create(body, userId) {
  const { tutor_id, monto } = body;
  if (!tutor_id || !monto) throw new AppError('Campos requeridos: tutor_id, monto', 400);
  return repo.createPago({ ...body, userId });
}

export async function update(id, fields, userId) {
  return repo.updatePago(id, { ...fields, updated_by: userId, updated_at: new Date().toISOString() });
}

export async function getPendientesResumen({ tutor_id, fecha_inicio, fecha_fin }) {
  if (!tutor_id) throw new AppError('Query param requerido: tutor_id', 400);
  if (fecha_inicio && !isValidISODate(String(fecha_inicio))) throw new AppError('fecha_inicio debe ser YYYY-MM-DD', 400);
  if (fecha_fin && !isValidISODate(String(fecha_fin))) throw new AppError('fecha_fin debe ser YYYY-MM-DD', 400);
  const movimientos = await repo.getPendientesResumen({ tutor_id, fecha_inicio, fecha_fin });
  return {
    tutor_id: String(tutor_id),
    fecha_inicio: fecha_inicio || null,
    fecha_fin: fecha_fin || null,
    cantidad_movimientos: movimientos.length,
    total_monto: movimientos.reduce((a, m) => a + (Number(m.monto) || 0), 0),
    movimientos,
  };
}

export async function getPendientesResumenTutores() {
  const tutores = await repo.getPendientesResumenTutores();
  return { tutores };
}

export async function getPendientesResumenEstudiantes() {
  return repo.getPendientesResumenEstudiantes();
}

export async function getPendientesDetalleTutor({ tutor_id, fecha_inicio, fecha_fin }) {
  if (!tutor_id) throw new AppError('Query param requerido: tutor_id', 400);
  if (fecha_inicio && !isValidISODate(String(fecha_inicio))) throw new AppError('fecha_inicio debe ser YYYY-MM-DD', 400);
  if (fecha_fin && !isValidISODate(String(fecha_fin))) throw new AppError('fecha_fin debe ser YYYY-MM-DD', 400);
  const movimientos = await repo.getPendientesDetalleTutor({ tutor_id, fecha_inicio, fecha_fin });
  return {
    tutor_id: String(tutor_id),
    fecha_inicio: fecha_inicio || null,
    fecha_fin: fecha_fin || null,
    cantidad_movimientos: movimientos.length,
    total_monto: movimientos.reduce((a, m) => a + (Number(m.monto) || 0), 0),
    movimientos,
  };
}

export async function getLibroDiario({ fecha, fecha_inicio, fecha_fin, only_totals, tutor_id, incluir_pendientes }) {
  const single = fecha ? String(fecha) : null;
  const start = fecha_inicio ? String(fecha_inicio) : single;
  const end = fecha_fin ? String(fecha_fin) : single;

  if (!start || !end) throw new AppError('Debe enviar fecha o (fecha_inicio y fecha_fin) en formato YYYY-MM-DD', 400);
  if (!isValidISODate(start) || !isValidISODate(end)) throw new AppError('fecha debe ser YYYY-MM-DD', 400);

  const tutorId = tutor_id ? toIntOrNull(tutor_id) : null;
  if (tutor_id && (!tutorId || tutorId <= 0)) throw new AppError('tutor_id debe ser un entero válido', 400);

  const onlyTotals = ['1', 'true', 'yes'].includes(String(only_totals || '').trim().toLowerCase());
  const incluirPendientes = ['1', 'true', 'yes'].includes(String(incluir_pendientes || '').trim().toLowerCase());

  const rows = await repo.getLibroDiario({ start, end, tutorId, incluirPendientes, onlyTotals });

  if (onlyTotals) {
    let totalDebe = 0, totalHaber = 0;
    for (const r of rows) { totalDebe += r.debe || 0; totalHaber += r.haber || 0; }
    return { fecha_inicio: start, fecha_fin: end, cantidad_movimientos: rows.length, total_debe: totalDebe, total_haber: totalHaber, neto: totalDebe - totalHaber };
  }

  const totalDebe = rows.reduce((a, r) => a + (Number(r.debe) || 0), 0);
  const totalHaber = rows.reduce((a, r) => a + (Number(r.haber) || 0), 0);
  return { fecha_inicio: start, fecha_fin: end, total_debe: totalDebe, total_haber: totalHaber, neto: totalDebe - totalHaber, incluir_pendientes: incluirPendientes, movimientos: rows };
}

export async function createComprobanteIngreso(body, userId) {
  const { numero_comprobante, monto, fecha_comprobante, pagador_nombre, pagador_contacto, detalle, movimiento_dinero_id, foto_url } = body;
  if (!numero_comprobante || !monto || !fecha_comprobante || !pagador_nombre) throw new AppError('Campos requeridos: numero_comprobante, monto, fecha_comprobante, pagador_nombre', 400);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha_comprobante)) throw new AppError('fecha_comprobante debe ser YYYY-MM-DD', 400);
  const montoNum = Number(monto);
  if (!Number.isFinite(montoNum) || montoNum <= 0) throw new AppError('monto debe ser número > 0', 400);

  const movDineroId = movimiento_dinero_id ? toIntOrNull(movimiento_dinero_id) : null;
  let movimientoFinancieroId = null;
  if (movDineroId) {
    try {
      const movDinero = await repo.getMovimientoDineroById(movDineroId);
      const inferredCursoId = movDinero?.curso_id ? toIntOrNull(movDinero.curso_id) : null;
      movimientoFinancieroId = await repo.createMovimientoFinanciero({
        tipo: 'debe', referencia_tabla: 'movimientos_dinero', referencia_id: movDineroId,
        monto: montoNum, concepto: `Ingreso (comprobante ${String(numero_comprobante).trim()}) - ${String(pagador_nombre).trim()}`,
        curso_id: inferredCursoId, estado: 'pagado',
        fecha_movimiento: new Date(`${fecha_comprobante}T12:00:00.000Z`).toISOString(),
        fecha_pago: new Date(`${fecha_comprobante}T12:00:00.000Z`).toISOString(),
        created_by: userId,
      });
    } catch { /* tabla inexistente, continuar */ }
  }

  const comprobante = await repo.createComprobante({
    numero_comprobante: String(numero_comprobante).trim(),
    monto: montoNum,
    fecha_comprobante,
    pagador_nombre: String(pagador_nombre).trim(),
    pagador_contacto: pagador_contacto ? String(pagador_contacto).trim() : null,
    detalle: detalle ? String(detalle).trim() : null,
    movimiento_dinero_id: movDineroId,
    movimiento_financiero_id: movimientoFinancieroId,
    foto_url: foto_url ? String(foto_url).trim() : null,
    created_by: userId,
  });

  if (movDineroId && foto_url) {
    const mov = await repo.getMovimientoDineroById(movDineroId);
    if (mov) await repo.updateMovimientoNotas(movDineroId, appendComprobanteUrl(mov.notas, foto_url));
  }
  return comprobante;
}

export async function registrarMovimientoManual(body, userId) {
  const direccion = String(body.direccion || '').trim().toLowerCase();
  if (!['entrada', 'salida'].includes(direccion)) throw new AppError("direccion debe ser 'entrada' o 'salida'", 400);
  const monto = Number(body.monto);
  if (!Number.isFinite(monto) || monto <= 0) throw new AppError('monto debe ser un número > 0', 400);
  const fecha = String(body.fecha || '').trim();
  if (!isValidISODate(fecha)) throw new AppError('fecha debe ser YYYY-MM-DD', 400);

  let tutor_id = toIntOrNull(body.tutor_id);
  const estudiante_id = toIntOrNull(body.estudiante_id);
  let curso_id = toIntOrNull(body.curso_id);
  const sesion_id = toIntOrNull(body.sesion_id);
  let matricula_id = null;

  if (estudiante_id) {
    const m = await repo.getMatriculaByEstudiante(estudiante_id);
    matricula_id = m?.id ?? null;
    if (!curso_id && m?.curso_id) curso_id = toIntOrNull(m.curso_id);
    if (!tutor_id && m?.tutor_id) tutor_id = toIntOrNull(m.tutor_id);
  }
  if (!curso_id && tutor_id) curso_id = await repo.getLatestCursoByTutor(tutor_id);
  let autoCurso = false;
  if (!curso_id) { const id = await repo.getLastCurso(); if (id) { curso_id = id; autoCurso = true; } }

  const tipo = direccion === 'entrada' ? 'ingreso_manual' : 'egreso_manual';
  const notasParts = [
    'MANUAL',
    autoCurso ? 'AUTO_CURSO:1' : null,
    body.a_nombre_de ? `A_NOMBRE_DE:${String(body.a_nombre_de).trim()}` : null,
    body.categoria ? `CATEGORIA:${String(body.categoria).trim()}` : null,
    body.metodo ? `METODO:${String(body.metodo).trim().toLowerCase()}` : null,
    body.detalle ? `DETALLE:${String(body.detalle).trim()}` : null,
    sesion_id ? `SESION_ID:${sesion_id}` : null,
    estudiante_id ? `ESTUDIANTE_ID:${estudiante_id}` : null,
    tutor_id ? `TUTOR_ID:${tutor_id}` : null,
  ].filter(Boolean);

  const data = await repo.insertMovimientoDinero({
    tipo, monto, estado: 'completado',
    fecha_pago: fecha, fecha_comprobante: fecha,
    factura_numero: body.referencia ? String(body.referencia).trim() : null,
    notas: notasParts.join(' | '), origen: 'manual',
    periodo_inicio: null, periodo_fin: null,
    tutor_id: tutor_id ? String(tutor_id) : null,
    curso_id: curso_id ? String(curso_id) : null,
    matricula_id: matricula_id ? String(matricula_id) : null,
    sesion_id: sesion_id ? String(sesion_id) : null,
  });

  const tipoNorm = String(data?.tipo || '');
  const montoNorm = Number(data?.monto) || 0;
  const comprobante_url = String(data?.notas || '').match(/COMPROBANTE_URL:([^\s]+)/)?.[1] ?? null;
  return {
    ...data,
    debe: tipoNorm.startsWith('ingreso') ? montoNorm : 0,
    haber: tipoNorm.startsWith('pago') || tipoNorm.startsWith('egreso') ? montoNorm : 0,
    comprobante_url,
  };
}

export async function uploadMovimientoComprobante(id, publicUrl) {
  const mov = await repo.getMovimientoDineroById(id);
  if (!mov) throw new AppError('Movimiento no encontrado', 404);
  const patchedNotes = appendComprobanteUrl(mov.notas, publicUrl);
  await repo.updateMovimientoNotas(id, patchedNotes);
  return { id, comprobante_url: publicUrl };
}

// ─────────── PENDIENTES SESIONES ──────────────────────────────────────────────

export async function getPendientesSesiones({ q, tutor_id, estudiante_id, fecha_inicio, fecha_fin, limit }) {
  if (fecha_inicio && !isValidISODate(String(fecha_inicio))) throw new AppError('fecha_inicio debe ser YYYY-MM-DD', 400);
  if (fecha_fin && !isValidISODate(String(fecha_fin))) throw new AppError('fecha_fin debe ser YYYY-MM-DD', 400);

  const rows = await repo.getPendientesSesiones({
    q: q ? String(q).trim() : null,
    tutor_id: toIntOrNull(tutor_id),
    estudiante_id: toIntOrNull(estudiante_id),
    fecha_inicio: fecha_inicio || null,
    fecha_fin: fecha_fin || null,
    limit: toIntOrNull(limit) || 200,
  });

  return {
    items: rows.map(r => ({
      movimiento_id: r.id,
      sesion_id: r.sesion_id,
      tutor_id: r.tutor_id,
      curso_id: r.curso_id,
      curso_nombre: r.curso?.nombre || null,
      tutor_nombre: r.tutor?.nombre || null,
      estudiante_id: r.matricula?.estudiante_id || null,
      estudiante_nombre: r.matricula?.estudiante?.nombre || null,
      fecha_sesion: r.sesion?.fecha || null,
      fecha_pago: r.fecha_pago,
      hora_inicio: r.sesion?.hora_inicio || null,
      hora_fin: r.sesion?.hora_fin || null,
      monto: Number(r.monto) || 0,
    })),
  };
}

// ─────────── DETALLE ESTUDIANTE ──────────────────────────────────────────────

export async function getPendientesDetalleEstudiante({ estudiante_id, estudiante_bulk_id, fecha_inicio, fecha_fin }) {
  const estId = toIntOrNull(estudiante_id);
  const bulkId = toIntOrNull(estudiante_bulk_id);
  if (!estId && !bulkId) throw new AppError('Se requiere estudiante_id o estudiante_bulk_id', 400);
  if (fecha_inicio && !isValidISODate(String(fecha_inicio))) throw new AppError('fecha_inicio debe ser YYYY-MM-DD', 400);
  if (fecha_fin && !isValidISODate(String(fecha_fin))) throw new AppError('fecha_fin debe ser YYYY-MM-DD', 400);

  const movimientos = await repo.getPendientesDetalleEstudiante({
    estudiante_id: estId,
    estudiante_bulk_id: bulkId,
    fecha_inicio: fecha_inicio || null,
    fecha_fin: fecha_fin || null,
  });

  return {
    estudiante_id: estId || null,
    estudiante_bulk_id: bulkId || null,
    cantidad_movimientos: movimientos.length,
    total_monto: movimientos.reduce((a, m) => a + (Number(m.monto) || 0), 0),
    movimientos,
  };
}

// ─────────── LIQUIDAR PENDIENTES TUTOR ───────────────────────────────────────

export async function liquidarPendientes({ tutor_id, fecha_inicio, fecha_fin, descripcion, estado }) {
  const tid = toIntOrNull(tutor_id);
  if (!tid) throw new AppError('tutor_id requerido', 400);
  if (fecha_inicio && !isValidISODate(String(fecha_inicio))) throw new AppError('fecha_inicio debe ser YYYY-MM-DD', 400);
  if (fecha_fin && !isValidISODate(String(fecha_fin))) throw new AppError('fecha_fin debe ser YYYY-MM-DD', 400);

  // Create a pago record first
  const pago = await repo.createPago({
    tutor_id: tid,
    monto: 0, // will be updated
    descripcion: descripcion || 'Liquidación de pendientes',
    estado: estado || 'pagado',
    periodo_inicio: fecha_inicio || null,
    periodo_fin: fecha_fin || null,
  });

  // Mark all matching pending movimientos as completed
  const result = await repo.liquidarPendientesTutor({
    tutor_id: tid,
    fecha_inicio: fecha_inicio || null,
    fecha_fin: fecha_fin || null,
    pago_id: pago.id,
  });

  return { pago_id: pago.id, movimientos_actualizados: result.updated, movimiento_ids: result.ids };
}

// ─────────── LIQUIDAR INGRESO SESION ─────────────────────────────────────────

export async function liquidarIngresoSesion({ sesion_id, metodo, referencia, fecha_comprobante }) {
  const sid = toIntOrNull(sesion_id);
  if (!sid) throw new AppError('sesion_id requerido', 400);

  const result = await repo.liquidarIngresoSesion({
    sesion_id: sid,
    metodo: metodo ? String(metodo).trim() : null,
    referencia: referencia ? String(referencia).trim() : null,
    fecha_comprobante: fecha_comprobante && isValidISODate(String(fecha_comprobante)) ? fecha_comprobante : null,
  });

  if (result.updated === 0) throw new AppError('No se encontraron movimientos pendientes para esta sesión', 404);
  return result;
}

// ─────────── LIQUIDAR INGRESO ESTUDIANTE ─────────────────────────────────────

export async function liquidarIngresoEstudiante({ estudiante_id, movimiento_ids, fecha_inicio, fecha_fin, metodo, referencia, fecha_comprobante }) {
  const estId = toIntOrNull(estudiante_id);
  if (!estId) throw new AppError('estudiante_id requerido', 400);
  if (!metodo) throw new AppError('metodo requerido', 400);
  if (!movimiento_ids || !Array.isArray(movimiento_ids) || movimiento_ids.length === 0) {
    throw new AppError('movimiento_ids requerido (array no vacío)', 400);
  }

  const ids = movimiento_ids.map(v => toIntOrNull(v)).filter(n => Number.isFinite(n) && n > 0);
  if (ids.length === 0) throw new AppError('movimiento_ids debe contener IDs válidos', 400);

  const result = await repo.liquidarIngresoEstudiante({
    movimiento_ids: ids,
    metodo: String(metodo).trim(),
    referencia: referencia ? String(referencia).trim() : null,
    fecha_comprobante: fecha_comprobante && isValidISODate(String(fecha_comprobante)) ? fecha_comprobante : null,
  });

  return { movimiento_ids: result.ids, total_monto: result.total_monto, updated: result.updated };
}

export async function bulkComprobante(ids, comprobanteUrl) {
  if (!comprobanteUrl) throw new AppError('comprobante_url requerido', 400);
  if (!ids || ids.length === 0) throw new AppError('ids requerido (array)', 400);
  const uniqIds = Array.from(new Set(ids.map(v => toIntOrNull(v)).filter(n => Number.isFinite(n) && n > 0)));
  if (uniqIds.length === 0) throw new AppError('ids debe contener enteros válidos', 400);
  if (uniqIds.length > 200) throw new AppError('ids demasiado grande (máximo 200)', 400);

  const rows = await repo.findMovimientosByIds(uniqIds);
  const byId = new Map(rows.map(r => [Number(r.id), r]));
  const missing = uniqIds.filter(id => !byId.has(id));
  if (missing.length > 0) throw new AppError(`Algunos movimientos no existen: ${missing.join(',')}`, 404);

  for (const id of uniqIds) {
    const cur = byId.get(id);
    await repo.updateMovimientoNotas(id, appendComprobanteUrl(cur?.notas, comprobanteUrl));
  }
  return { updated: uniqIds.length, comprobante_url: comprobanteUrl, ids: uniqIds };
}
