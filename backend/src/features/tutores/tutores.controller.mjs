import * as service from './tutores.service.mjs';

export async function getAll(req, res, next) {
  try {
    const data = await service.getAll();
    res.json(data);
  } catch (err) { next(err); }
}

export async function getById(req, res, next) {
  try {
    const data = await service.getById(req.params.id);
    res.json(data);
  } catch (err) { next(err); }
}

export async function create(req, res, next) {
  try {
    const data = await service.create(req.body, req.user?.id);
    res.status(201).json(data);
  } catch (err) { next(err); }
}

export async function update(req, res, next) {
  try {
    const data = await service.update(req.params.id, req.body, req.user?.id);
    res.json(data);
  } catch (err) { next(err); }
}

export async function remove(req, res, next) {
  try {
    const data = await service.remove(req.params.id);
    res.json(data);
  } catch (err) { next(err); }
}
