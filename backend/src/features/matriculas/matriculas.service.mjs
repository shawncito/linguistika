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
  const { estudiante_id, curso_id, tutor_id, estado, es_grupo, grupo_id, grupo_nombre } = body;
  return repo.update(id, { estudiante_id, curso_id, tutor_id, estado, es_grupo: !!es_grupo, grupo_id: grupo_id || undefined, grupo_nombre: grupo_nombre || null }, userId, token);
}

export function deactivate(id, userId) { return repo.deactivate(id, userId); }

export function fromBulkGrupo(body, userId, token) {
  const { matricula_grupo_id, grupo_nombre } = body ?? {};
  return repo.fromBulkGrupo(matricula_grupo_id, grupo_nombre, userId, token);
}
