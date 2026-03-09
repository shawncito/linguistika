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
