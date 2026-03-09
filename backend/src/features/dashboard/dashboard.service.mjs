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
