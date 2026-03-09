import * as service from './estudiantes.service.mjs';

export async function getAll(req, res, next) {
  try { res.json(await service.getAll()); } catch (err) { next(err); }
}

export async function getById(req, res, next) {
  try { res.json(await service.getById(req.params.id)); } catch (err) { next(err); }
}

export async function create(req, res, next) {
  try {
    const data = await service.create(req.body, req.user?.id);
    res.status(201).json(data);
  } catch (err) { next(err); }
}

export async function update(req, res, next) {
  try { res.json(await service.update(req.params.id, req.body, req.user?.id)); } catch (err) { next(err); }
}

export async function remove(req, res, next) {
  try { res.json(await service.remove(req.params.id)); } catch (err) { next(err); }
}
