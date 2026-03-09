import * as svc from './horasTrabajo.service.mjs';

export async function list(req, res, next) {
  try {
    const { fecha, tutor_id, estado } = req.query;
    res.json(await svc.list({ fecha, tutor_id, estado }));
  } catch (err) { next(err); }
}

export async function getById(req, res, next) {
  try {
    res.json(await svc.getById(req.params.id));
  } catch (err) { next(err); }
}

export async function create(req, res, next) {
  try {
    const { tutor_id, clase_id, fecha, horas, tarifa_por_hora, notas } = req.body;
    const row = await svc.create({
      tutor_id, clase_id, fecha, horas, tarifa_por_hora, notas,
      userId: req.user?.id,
    });
    res.status(201).json(row);
  } catch (err) { next(err); }
}

export async function update(req, res, next) {
  try {
    res.json(await svc.update(req.params.id, req.body));
  } catch (err) { next(err); }
}

export async function aprobar(req, res, next) {
  try {
    res.json(await svc.aprobar(req.params.id, req.user?.id));
  } catch (err) { next(err); }
}
