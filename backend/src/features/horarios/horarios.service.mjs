import * as repo from './horarios.repository.mjs';
import { AppError } from '../../shared/errors/AppError.mjs';

export function getByTutor(tutorId) { return repo.findByTutor(tutorId); }

export function create(body, userId) {
  const { tutor_id, dia_semana, hora_inicio, hora_fin } = body;
  if (!tutor_id || !dia_semana || !hora_inicio || !hora_fin) throw new AppError('Campos requeridos: tutor_id, dia_semana, hora_inicio, hora_fin', 400);
  return repo.create({ tutor_id, dia_semana, hora_inicio, hora_fin, userId });
}

export function update(id, body, userId) { return repo.update(id, { ...body, userId }); }
export function deactivate(id, userId) { return repo.deactivate(id, userId); }

export function createClase(body, userId) {
  const { matricula_id, fecha, hora_inicio, hora_fin } = body;
  if (!matricula_id || !fecha || !hora_inicio || !hora_fin) throw new AppError('Campos requeridos: matricula_id, fecha, hora_inicio, hora_fin', 400);
  return repo.createClase({ ...body, userId });
}

export function getAllClases() { return repo.findAllClases(); }
