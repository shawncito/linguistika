import * as repo from './matriculas.repository.mjs';
import { AppError } from '../../shared/errors/AppError.mjs';

export function getAll(token) { return repo.findAll(token); }
export function getById(id, token) { return repo.findById(id, token); }

export function create(body, userId, token) {
  const { estudiante_id, estudiante_ids, curso_id, tutor_id, es_grupo, grupo_id, grupo_nombre } = body;
  let lista = [];
  if (Array.isArray(estudiante_ids) && estudiante_ids.length > 0) lista = estudiante_ids.map(x => parseInt(x)).filter(Boolean);
  else if (estudiante_id) lista = [parseInt(estudiante_id)];
  if (!lista.length) throw new AppError('Campos requeridos: estudiante_id o estudiante_ids', 400);
  if (!curso_id || !tutor_id) throw new AppError('Campos requeridos: curso_id, tutor_id', 400);
  return repo.create({ listaEstudiantes: lista, curso_id, tutor_id, es_grupo, grupo_id, grupo_nombre, userId, token });
}

export function update(id, body, userId, token) {
  const payload = {};

  if (body.estudiante_id !== undefined) {
    payload.estudiante_id = body.estudiante_id ? parseInt(body.estudiante_id, 10) : null;
  }

  if (body.estudiante_ids !== undefined) {
    payload.estudiante_ids = Array.isArray(body.estudiante_ids)
      ? body.estudiante_ids.map((x) => parseInt(x, 10)).filter(Boolean)
      : null;
  }

  if (body.curso_id !== undefined) {
    payload.curso_id = body.curso_id ? parseInt(body.curso_id, 10) : null;
  }

  if (body.tutor_id !== undefined) {
    payload.tutor_id = body.tutor_id ? parseInt(body.tutor_id, 10) : null;
  }

  if (body.estado !== undefined) {
    payload.estado = body.estado;
  }

  if (body.es_grupo !== undefined) {
    payload.es_grupo = !!body.es_grupo;
  }

  if (body.grupo_id !== undefined) {
    payload.grupo_id = body.grupo_id || null;
  }

  if (body.grupo_nombre !== undefined) {
    payload.grupo_nombre = body.grupo_nombre || null;
  }

  return repo.update(id, payload, userId, token);
}

export function deactivate(id, userId) { return repo.deactivate(id, userId); }

export function fromBulkGrupo(body, userId, token) {
  const { matricula_grupo_id, grupo_nombre } = body ?? {};
  return repo.fromBulkGrupo(matricula_grupo_id, grupo_nombre, userId, token);
}
