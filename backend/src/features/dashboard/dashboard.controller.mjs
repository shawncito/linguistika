import * as service from './dashboard.service.mjs';

export async function getTutorias(req, res, next) {
  try { res.json(await service.getTutoriasFecha(req.params.fecha)); } catch (err) { next(err); }
}

export async function getResumenTutores(req, res, next) {
  try { res.json(await service.getResumenTutores(req.params.fecha)); } catch (err) { next(err); }
}

export async function getResumenTutoresEstudiantes(req, res, next) {
  try { res.json(await service.getResumenTutoresEstudiantes(req.query)); } catch (err) { next(err); }
}

export async function getResumenCursosGrupos(req, res, next) {
  try { res.json(await service.getResumenCursosGrupos(req.query)); } catch (err) { next(err); }
}

export async function getDebugMatriculasCursos(_req, res, next) {
  try { res.json(await service.getDebugMatriculasCursos()); } catch (err) { next(err); }
}

export async function getEstadisticasGeneral(req, res, next) {
  try { res.json(await service.getEstadisticasGeneral(req.query)); } catch (err) { next(err); }
}

export async function obtenerEstadosClasesRango(req, res, next) {
  try { res.json(await service.getEstadosClasesRango(req.query)); } catch (err) { next(err); }
}

export async function getMetricas(req, res, next) {
  try { res.json(await service.getMetricas(req.query)); } catch (err) { next(err); }
}

export async function completarSesion(req, res, next) {
  try { res.json(await service.completarSesion(req.params.matriculaId, req.params.fecha)); } catch (err) { next(err); }
}

export async function cancelarSesionDia(req, res, next) {
  try {
    const { motivo_cancelacion } = req.body ?? {};
    res.json(await service.cancelarSesionDia(req.params.matriculaId, req.params.fecha, motivo_cancelacion));
  } catch (err) { next(err); }
}

export async function actualizarEstadoSesion(req, res, next) {
  try { res.json(await service.actualizarEstadoSesion(req.params.matriculaId, req.params.fecha, req.body ?? {})); } catch (err) { next(err); }
}
