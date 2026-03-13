import * as repo from './dashboard.repository.mjs';

const cache = new Map();
const shouldBypass = (query) => ['1', 'true', 'yes'].includes(String(query?.no_cache ?? '').toLowerCase());

async function cached(key, ttlMs, bypass, compute) {
  const now = Date.now();
  if (!bypass) {
    const c = cache.get(key);
    if (c && c.expiresAt > now) return c.value;
  }
  const value = await compute();
  cache.set(key, { value, expiresAt: now + ttlMs });
  return value;
}

export async function getTutoriasFecha(fecha) {
  const bloqueadasSet = await repo.getSesionesBloqueadas(fecha);
  return repo.buildTutoriasMerged(fecha, bloqueadasSet);
}

export function getResumenTutores(fecha) {
  return repo.getResumenTutores(fecha);
}

export function getResumenTutoresEstudiantes(query) {
  return cached('dashboard:resumen-tutores-estudiantes', 30_000, shouldBypass(query), () => repo.getResumenTutoresEstudiantes());
}

export function getResumenCursosGrupos(query) {
  return cached('dashboard:resumen-cursos-grupos', 30_000, shouldBypass(query), () => repo.getResumenCursosGrupos());
}

export function getDebugMatriculasCursos() {
  return repo.getDebugMatriculasCursos();
}

export function getEstadisticasGeneral(query) {
  return cached('dashboard:estadisticas-general', 20_000, shouldBypass(query), () => repo.getEstadisticasGeneral());
}

export function getEstadosClasesRango({ fecha_inicio, fecha_fin }) {
  if (!fecha_inicio || !fecha_fin) throw new Error('Se requieren fecha_inicio y fecha_fin');
  return repo.getEstadosClasesRango({ fecha_inicio, fecha_fin });
}

export function getMetricas({ mes, tutor_id } = {}) {
  if (!mes) throw new Error('Se requiere mes en formato YYYY-MM');
  return repo.getMetricas({ mes, tutor_id: tutor_id || null });
}

export function completarSesion(matricula_id, fecha) {
  return repo.completarSesion(matricula_id, fecha);
}

export function cancelarSesionDia(matricula_id, fecha, motivo) {
  return repo.cancelarSesionDia(matricula_id, fecha, motivo);
}

export function actualizarEstadoSesion(matricula_id, fecha, datos) {
  return repo.actualizarEstadoSesion(matricula_id, fecha, datos);
}

export function listTutorNotas(tutorId, query = {}) {
  return repo.listTutorNotas(tutorId, { historyLimit: query?.history_limit });
}

export function createTutorNota({ tutorId, mensaje, actor }) {
  return repo.createTutorNota({ tutorId, mensaje, actor });
}

export function updateTutorNotaTexto({ tutorId, notaId, mensaje, actor }) {
  return repo.updateTutorNotaTexto({ tutorId, notaId, mensaje, actor });
}

export function setTutorNotaEstado({ tutorId, notaId, estado, actor }) {
  return repo.setTutorNotaEstado({ tutorId, notaId, estado, actor });
}

export function deleteTutorNota({ tutorId, notaId, actor }) {
  return repo.deleteTutorNota({ tutorId, notaId, actor });
}

export function listCalendarNotasSummary({ fecha_inicio, fecha_fin }) {
  return repo.listCalendarNotasSummary({ fechaInicio: fecha_inicio, fechaFin: fecha_fin });
}

export function listCalendarNotas(fecha, query = {}) {
  return repo.listCalendarNotas(fecha, { historyLimit: query?.history_limit });
}

export function createCalendarNota({ fecha, mensaje, actor }) {
  return repo.createCalendarNota({ fecha, mensaje, actor });
}

export function updateCalendarNotaTexto({ fecha, notaId, mensaje, actor }) {
  return repo.updateCalendarNotaTexto({ fecha, notaId, mensaje, actor });
}

export function setCalendarNotaEstado({ fecha, notaId, estado, actor }) {
  return repo.setCalendarNotaEstado({ fecha, notaId, estado, actor });
}

export function deleteCalendarNota({ fecha, notaId, actor }) {
  return repo.deleteCalendarNota({ fecha, notaId, actor });
}
