import * as service from './dashboard.service.mjs';

const TUTOR_NOTA_STATES = new Set(['pendiente', 'hecha']);

function toPositiveInt(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.trunc(n);
}

function getActorFromRequest(req) {
  return {
    userId: req.user?.id ?? req.user?.sub ?? null,
    email: req.user?.email ?? null,
    role: req.userRole ?? req.user?.role ?? null,
    name: req.userName ?? req.user?.nombre ?? req.user?.name ?? req.user?.email ?? null,
  };
}

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

export async function listTutorNotas(req, res, next) {
  const tutorId = toPositiveInt(req.params.tutorId);
  if (!tutorId) return res.status(400).json({ error: 'Tutor inválido' });
  try { res.json(await service.listTutorNotas(tutorId, req.query)); } catch (err) { next(err); }
}

export async function createTutorNota(req, res, next) {
  const tutorId = toPositiveInt(req.params.tutorId);
  if (!tutorId) return res.status(400).json({ error: 'Tutor inválido' });

  const mensaje = String(req.body?.mensaje ?? '').trim();
  if (!mensaje) return res.status(400).json({ error: 'El mensaje es requerido' });

  try {
    const nota = await service.createTutorNota({
      tutorId,
      mensaje,
      actor: getActorFromRequest(req),
    });
    return res.status(201).json(nota);
  } catch (err) {
    return next(err);
  }
}

export async function updateTutorNotaTexto(req, res, next) {
  const tutorId = toPositiveInt(req.params.tutorId);
  const notaId = toPositiveInt(req.params.notaId);
  if (!tutorId) return res.status(400).json({ error: 'Tutor inválido' });
  if (!notaId) return res.status(400).json({ error: 'Nota inválida' });

  const mensaje = String(req.body?.mensaje ?? '').trim();
  if (!mensaje) return res.status(400).json({ error: 'El mensaje es requerido' });

  try {
    const nota = await service.updateTutorNotaTexto({
      tutorId,
      notaId,
      mensaje,
      actor: getActorFromRequest(req),
    });
    return res.json(nota);
  } catch (err) {
    return next(err);
  }
}

export async function setTutorNotaEstado(req, res, next) {
  const tutorId = toPositiveInt(req.params.tutorId);
  const notaId = toPositiveInt(req.params.notaId);
  if (!tutorId) return res.status(400).json({ error: 'Tutor inválido' });
  if (!notaId) return res.status(400).json({ error: 'Nota inválida' });

  const estado = String(req.body?.estado ?? '').trim().toLowerCase();
  if (!TUTOR_NOTA_STATES.has(estado)) {
    return res.status(400).json({ error: 'Estado inválido. Use pendiente o hecha' });
  }

  try {
    const nota = await service.setTutorNotaEstado({
      tutorId,
      notaId,
      estado,
      actor: getActorFromRequest(req),
    });
    return res.json(nota);
  } catch (err) {
    return next(err);
  }
}

export async function deleteTutorNota(req, res, next) {
  const tutorId = toPositiveInt(req.params.tutorId);
  const notaId = toPositiveInt(req.params.notaId);
  if (!tutorId) return res.status(400).json({ error: 'Tutor inválido' });
  if (!notaId) return res.status(400).json({ error: 'Nota inválida' });

  try {
    const result = await service.deleteTutorNota({
      tutorId,
      notaId,
      actor: getActorFromRequest(req),
    });
    return res.json(result);
  } catch (err) {
    return next(err);
  }
}
