/**
 * tesoreria.controller.mjs
 */

import * as service from './tesoreria.service.mjs';
import { isValidISODate, isValidISOMonth } from './tesoreria.repository.mjs';
import { AppError } from '../../shared/errors/AppError.mjs';

function getUserId(req) { return req.user?.id; }

function parseLibroParams(query) {
  const { fecha, mes, fecha_inicio, fecha_fin, include_pendientes, ascending, limit, encargado_id, tutor_id, cuenta_id } = query;
  return {
    singleDate: fecha && isValidISODate(fecha) ? fecha : null,
    mes: mes && isValidISOMonth(mes) ? mes : null,
    start: fecha_inicio && isValidISODate(fecha_inicio) ? fecha_inicio : null,
    end: fecha_fin && isValidISODate(fecha_fin) ? fecha_fin : null,
    includePendientes: include_pendientes === '1' || include_pendientes === 'true',
    ascending: ascending === '1' || ascending === 'true',
    limit,
    encargadoId: encargado_id || null,
    tutorId: tutor_id || null,
    cuentaId: cuenta_id || null,
  };
}

/* ─── Resúmenes ──────────────────────────────────────────────────────────── */

export async function getResumenEncargados(req, res, next) {
  try {
    const data = await service.getResumenEncargados();
    res.json({ ok: true, data });
  } catch (err) { next(err); }
}

export async function getResumenTutores(req, res, next) {
  try {
    const data = await service.getResumenTutores();
    res.json({ ok: true, data });
  } catch (err) { next(err); }
}

export async function getResumen(req, res, next) {
  try {
    const data = await service.getResumen();
    res.json({ ok: true, data });
  } catch (err) { next(err); }
}

export async function getBolsa(req, res, next) {
  try {
    const data = await service.getBolsa();
    res.json({ ok: true, data });
  } catch (err) { next(err); }
}

export async function getPorcentajeEncargados(req, res, next) {
  try {
    const data = await service.getPorcentajeEncargados();
    res.json({ ok: true, data });
  } catch (err) { next(err); }
}

export async function getEsperadoDiario(req, res, next) {
  try {
    const data = await service.getEsperadoDiario();
    res.json({ ok: true, data });
  } catch (err) { next(err); }
}

/* ─── Libro diario / movimientos ─────────────────────────────────────────── */

export async function getDiario(req, res, next) {
  try {
    const result = await service.getDiario(parseLibroParams(req.query));
    res.json({ ok: true, ...result });
  } catch (err) { next(err); }
}

export async function getMovimientosEncargado(req, res, next) {
  try {
    const result = await service.getMovimientosEncargado({ encargadoId: req.params.id, ...parseLibroParams(req.query) });
    res.json({ ok: true, ...result });
  } catch (err) { next(err); }
}

export async function getMovimientosTutor(req, res, next) {
  try {
    const result = await service.getMovimientosTutor({ tutorId: req.params.id, ...parseLibroParams(req.query) });
    res.json({ ok: true, ...result });
  } catch (err) { next(err); }
}

/* ─── Exportaciones Excel ────────────────────────────────────────────────── */

export async function exportDiario(req, res, next) {
  try {
    await service.exportDiario({ res, ...parseLibroParams(req.query) });
  } catch (err) { next(err); }
}

export async function exportCuenta(req, res, next) {
  try {
    await service.exportCuenta({ res, cuentaId: req.params.cuentaId, ...parseLibroParams(req.query) });
  } catch (err) { next(err); }
}

/* ─── Aplicaciones de pago ───────────────────────────────────────────────── */

export async function getPagoAplicaciones(req, res, next) {
  try {
    const data = await service.getPagoAplicaciones(req.params.pagoId);
    res.json({ ok: true, data });
  } catch (err) { next(err); }
}

/* ─── Obligaciones ───────────────────────────────────────────────────────── */

export async function getObligacionesEncargado(req, res, next) {
  try {
    const data = await service.getObligacionesEncargado(req.params.id);
    res.json({ ok: true, data });
  } catch (err) { next(err); }
}

export async function getObligacionesTutor(req, res, next) {
  try {
    const data = await service.getObligacionesTutor(req.params.id);
    res.json({ ok: true, data });
  } catch (err) { next(err); }
}

/* ─── Pagos ──────────────────────────────────────────────────────────────── */

export async function registrarPagoEncargado(req, res, next) {
  try {
    const data = await service.registrarPagoEncargado({ encargadoId: req.params.id, body: req.body, userId: getUserId(req) });
    res.status(201).json({ ok: true, data });
  } catch (err) { next(err); }
}

export async function registrarPagoTutor(req, res, next) {
  try {
    const data = await service.registrarPagoTutor({ tutorId: req.params.id, body: req.body, userId: getUserId(req) });
    res.status(201).json({ ok: true, data });
  } catch (err) { next(err); }
}

export async function actualizarPago(req, res, next) {
  try {
    const data = await service.actualizarPagoComprobante({ pagoId: req.params.pagoId, file: req.file ?? null, body: req.body, userId: getUserId(req) });
    res.json({ ok: true, data });
  } catch (err) { next(err); }
}

/* ─── Cobro grupal ───────────────────────────────────────────────────────── */

export async function registrarCobroGrupal(req, res, next) {
  try {
    const data = await service.registrarCobroGrupal({ grupoId: req.params.grupoId, body: req.body, userId: getUserId(req) });
    res.status(201).json({ ok: true, data });
  } catch (err) { next(err); }
}

/* ─── Verificar contraseña (endpoint especial) ───────────────────────────── */

export async function verificarPassword(req, res, next) {
  try {
    const { email, password } = req.body;
    if (!email || !password) throw new AppError('email y password son requeridos.', 422);
    await service.verifyUserPassword(email, password);
    res.json({ ok: true, verified: true });
  } catch (err) { next(err); }
}
