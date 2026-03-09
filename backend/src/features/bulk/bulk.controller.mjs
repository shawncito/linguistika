/**
 * bulk.controller.mjs
 *
 * Thin controller: lee req, llama service, escribe res.
 * Todos los errores se delegan a next(err).
 */

import * as service from './bulk.service.mjs';

function getToken(req) { return req.accessToken; }
function getUserId(req) { return req.user?.id; }

/* ─── templates ─────────────────────────────────────────────────────────── */

export async function getTemplate(req, res, next) {
  try {
    const { tipo } = req.params;
    const { buffer, filename } = await service.getTemplate({ tipo, token: getToken(req) });
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Length', buffer.length);
    res.send(buffer);
  } catch (err) { next(err); }
}

/* ─── grupos ─────────────────────────────────────────────────────────────── */

export async function listGrupos(req, res, next) {
  try {
    const data = await service.listGrupos({ token: getToken(req) });
    res.json({ ok: true, data });
  } catch (err) { next(err); }
}

export async function getGrupo(req, res, next) {
  try {
    const data = await service.getGrupo({ id: req.params.id, token: getToken(req) });
    res.json({ ok: true, data });
  } catch (err) { next(err); }
}

export async function createGrupo(req, res, next) {
  try {
    const data = await service.createGrupo({ body: req.body, userId: getUserId(req), token: getToken(req) });
    res.status(201).json({ ok: true, data });
  } catch (err) { next(err); }
}

export async function updateGrupo(req, res, next) {
  try {
    const data = await service.updateGrupo({ id: req.params.id, body: req.body, userId: getUserId(req), token: getToken(req) });
    res.json({ ok: true, data });
  } catch (err) { next(err); }
}

export async function deleteGrupo(req, res, next) {
  try {
    const data = await service.deleteGrupo({ id: req.params.id, token: getToken(req) });
    res.json({ ok: true, data });
  } catch (err) { next(err); }
}

/* ─── estudiantes_bulk ──────────────────────────────────────────────────── */

export async function listEstudiantes(req, res, next) {
  try {
    const data = await service.listEstudiantes({ token: getToken(req) });
    res.json({ ok: true, data });
  } catch (err) { next(err); }
}

export async function createEstudiante(req, res, next) {
  try {
    const data = await service.createEstudiante({ body: req.body, userId: getUserId(req), token: getToken(req) });
    res.status(201).json({ ok: true, data });
  } catch (err) { next(err); }
}

export async function updateEstudiante(req, res, next) {
  try {
    const data = await service.updateEstudiante({ id: req.params.id, body: req.body, userId: getUserId(req), token: getToken(req) });
    res.json({ ok: true, data });
  } catch (err) { next(err); }
}

export async function deleteEstudiante(req, res, next) {
  try {
    const data = await service.deleteEstudiante({ id: req.params.id, token: getToken(req) });
    res.json({ ok: true, data });
  } catch (err) { next(err); }
}

/* ─── asignación ─────────────────────────────────────────────────────────── */

export async function assignToGroup(req, res, next) {
  try {
    const data = await service.assignToGroup({ gid: req.params.id, body: req.body, token: getToken(req) });
    res.json({ ok: true, data });
  } catch (err) { next(err); }
}

export async function unassignStudents(req, res, next) {
  try {
    const data = await service.unassignStudents({ body: req.body, token: getToken(req) });
    res.json({ ok: true, data });
  } catch (err) { next(err); }
}

/* ─── preview / upload ──────────────────────────────────────────────────── */

export async function preview(req, res, next) {
  try {
    if (!req.file) return res.status(400).json({ ok: false, error: 'No se subió ningún archivo.' });
    const result = await service.preview({ buffer: req.file.buffer, token: getToken(req) });
    if (result?.error) return res.status(422).json({ ok: false, ...result });
    if (result?.schemaError) return res.status(409).json({ ok: false, ...result });
    res.json({ ok: true, ...result });
  } catch (err) { next(err); }
}

export async function upload(req, res, next) {
  try {
    if (!req.file) return res.status(400).json({ ok: false, error: 'No se subió ningún archivo.' });
    const result = await service.upload({ buffer: req.file.buffer, userId: getUserId(req), token: getToken(req) });
    if (result?.error) return res.status(422).json({ ok: false, ...result });
    res.status(201).json({ ok: true, ...result });
  } catch (err) { next(err); }
}
