import * as service from './matriculas.service.mjs';

export async function getAll(req, res, next) {
  try { res.json(await service.getAll(req.accessToken)); } catch (err) { next(err); }
}

export async function getById(req, res, next) {
  try { res.json(await service.getById(req.params.id, req.accessToken)); } catch (err) { next(err); }
}

export async function create(req, res, next) {
  try { res.status(201).json(await service.create(req.body, req.user?.id, req.accessToken)); } catch (err) { next(err); }
}

export async function update(req, res, next) {
  try { res.json(await service.update(req.params.id, req.body, req.user?.id, req.accessToken)); } catch (err) { next(err); }
}

export async function deactivate(req, res, next) {
  try { res.json(await service.deactivate(req.params.id, req.user?.id)); } catch (err) { next(err); }
}

export async function fromBulkGrupo(req, res, next) {
  try { res.status(201).json(await service.fromBulkGrupo(req.body, req.user?.id, req.accessToken)); } catch (err) { next(err); }
}
