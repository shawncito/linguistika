/**
 * finanzas.controller.mjs
 */

import * as service from './finanzas.service.mjs';

function getUserId(req) { return req.user?.id; }

export async function listMovimientos(req, res, next) {
  try {
    const { tipo, estado, referencia_tabla, referencia_id, curso_id, matricula_grupo_id, fecha_inicio, fecha_fin } = req.query;
    const data = await service.listMovimientos({ tipo, estado, referencia_tabla, referencia_id, curso_id, matricula_grupo_id, fecha_inicio, fecha_fin });
    res.json({ ok: true, data });
  } catch (err) { next(err); }
}

export async function createComprobante(req, res, next) {
  try {
    const data = await service.createComprobante({ body: req.body, userId: getUserId(req) });
    res.status(201).json({ ok: true, data });
  } catch (err) { next(err); }
}

export async function listComprobantes(req, res, next) {
  try {
    const data = await service.listComprobantes();
    res.json({ ok: true, data });
  } catch (err) { next(err); }
}

export async function updateComprobante(req, res, next) {
  try {
    const data = await service.updateComprobanteEstado(req.params.id, { body: req.body, userId: getUserId(req) });
    res.json({ ok: true, data });
  } catch (err) { next(err); }
}
