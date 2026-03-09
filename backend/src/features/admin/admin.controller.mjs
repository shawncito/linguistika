import * as svc from './admin.service.mjs';

export async function crearEmpleado(req, res, next) {
  try {
    res.status(201).json(await svc.createEmployee(req.body));
  } catch (err) { next(err); }
}

export async function listarEmpleados(req, res, next) {
  try {
    res.json(await svc.listEmployees());
  } catch (err) { next(err); }
}

export async function actualizarEmpleado(req, res, next) {
  try {
    res.json(await svc.updateEmployee(req.params.id, req.body));
  } catch (err) { next(err); }
}

export async function eliminarEmpleado(req, res, next) {
  try {
    res.json(await svc.deleteEmployee(req.params.id));
  } catch (err) { next(err); }
}
