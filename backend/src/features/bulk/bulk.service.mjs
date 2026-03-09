/**
 * bulk.service.mjs
 *
 * Thin delegation layer — passes token + userId from auth context to repository.
 */

import * as repo from './bulk.repository.mjs';
import { AppError } from '../../shared/errors/AppError.mjs';
import { BULK_TYPES } from './bulk.schemas.mjs';

/* ─── templates ─────────────────────────────────────────────────────────── */

export async function getTemplate({ tipo, token }) {
  const result = await repo.getTemplate(tipo, token);
  if (!result) throw new AppError(`Tipo de template no soportado: ${tipo}. Usa: ${BULK_TYPES.join(', ')}`, 400);
  return result;
}

/* ─── grupos ─────────────────────────────────────────────────────────────── */

export async function listGrupos({ token }) {
  return repo.getGrupos(token);
}

export async function getGrupo({ id, token }) {
  const result = await repo.getGrupoById(id, token);
  if (!result) throw new AppError('Grupo no encontrado.', 404);
  return result;
}

export async function createGrupo({ body, userId, token }) {
  return repo.createGrupo({ ...body, userId, token });
}

export async function updateGrupo({ id, body, userId, token }) {
  return repo.updateGrupo(id, { ...body, userId }, token);
}

export async function deleteGrupo({ id, token }) {
  return repo.deleteGrupo(id, token);
}

/* ─── estudiantes_bulk ──────────────────────────────────────────────────── */

export async function listEstudiantes({ token }) {
  return repo.getEstudiantes(token);
}

export async function createEstudiante({ body, userId, token }) {
  return repo.createEstudianteBulk({ ...body, userId, token });
}

export async function updateEstudiante({ id, body, userId, token }) {
  return repo.updateEstudianteBulk(id, { ...body, userId }, token);
}

export async function deleteEstudiante({ id, token }) {
  return repo.deleteEstudianteBulk(id, token);
}

/* ─── asignación ─────────────────────────────────────────────────────────── */

export async function assignToGroup({ gid, body, token }) {
  const { estudianteBulkIds = [], estudianteIds = [] } = body;
  const bulkIds = repo.normalizeNumericIds(estudianteBulkIds);
  const normalIds = repo.normalizeNumericIds(estudianteIds);
  if (bulkIds.length === 0 && normalIds.length === 0) {
    throw new AppError('Se requiere al menos un id en estudianteBulkIds o estudianteIds.', 400);
  }
  return repo.assignEstudiantesAGrupo({ gid, estudianteBulkIds: bulkIds, estudianteIds: normalIds, token });
}

export async function unassignStudents({ body, token }) {
  const { estudianteBulkIds = [], estudianteIds = [] } = body;
  const bulkIds = repo.normalizeNumericIds(estudianteBulkIds);
  const normalIds = repo.normalizeNumericIds(estudianteIds);
  if (bulkIds.length === 0 && normalIds.length === 0) {
    throw new AppError('Se requiere al menos un id en estudianteBulkIds o estudianteIds.', 400);
  }
  return repo.unassignEstudiantes({ estudianteBulkIds: bulkIds, estudianteIds: normalIds, token });
}

/* ─── preview / upload ──────────────────────────────────────────────────── */

export async function preview({ buffer, token }) {
  if (!buffer || buffer.length === 0) throw new AppError('El archivo está vacío.', 400);
  return repo.preview(buffer, token);
}

export async function upload({ buffer, userId, token }) {
  if (!buffer || buffer.length === 0) throw new AppError('El archivo está vacío.', 400);
  return repo.upload(buffer, { token, userId });
}
