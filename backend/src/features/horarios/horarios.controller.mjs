import * as service from './horarios.service.mjs';

export async function getByTutor(req, res, next) {
  try { res.json(await service.getByTutor(req.params.tutor_id)); } catch (err) { next(err); }
}
export async function create(req, res, next) {
  try { res.status(201).json(await service.create(req.body, req.user?.id)); } catch (err) { next(err); }
}
export async function update(req, res, next) {
  try { res.json(await service.update(req.params.id, req.body, req.user?.id)); } catch (err) { next(err); }
}
export async function deactivate(req, res, next) {
  try { res.json(await service.deactivate(req.params.id, req.user?.id)); } catch (err) { next(err); }
}
export async function createClase(req, res, next) {
  try { res.status(201).json(await service.createClase(req.body, req.user?.id)); } catch (err) { next(err); }
}
export async function getAllClases(req, res, next) {
  try { res.json(await service.getAllClases()); } catch (err) { next(err); }
}
