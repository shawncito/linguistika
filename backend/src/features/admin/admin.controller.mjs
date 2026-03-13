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

export async function listarPaginas(req, res, next) {
  try {
    res.json(await svc.listarPaginas());
  } catch (err) { next(err); }
}

export async function togglePagina(req, res, next) {
  try {
    const { activa, mensaje } = req.body ?? {};
    if (typeof activa !== 'boolean') {
      return res.status(400).json({ error: 'El campo `activa` debe ser boolean' });
    }
    const result = await svc.togglePagina(req.params.slug, {
      activa,
      desactivada_por: req.user?.id ?? null,
      desactivada_por_nombre: req.userName ?? null,
      mensaje: mensaje ?? null,
    });
    res.json(result);
  } catch (err) { next(err); }
}
