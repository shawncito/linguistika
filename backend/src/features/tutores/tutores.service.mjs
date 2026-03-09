import * as repo from './tutores.repository.mjs';
import { AppError } from '../../shared/errors/AppError.mjs';
import { PHONE_REGEX, COLOR_REGEX } from './tutores.schemas.mjs';

export function getAll() {
  return repo.findAll();
}

export function getById(id) {
  return repo.findById(id);
}

export function create(body, userId) {
  const nombre = String(body.nombre ?? '').trim();
  if (!nombre) throw new AppError('Campo requerido: nombre', 400);

  if (body.telefono && !PHONE_REGEX.test(body.telefono.trim())) {
    throw new AppError('Formato de teléfono inválido. Usa: +XXX XXXXXXXX', 400);
  }
  if (body.color && !COLOR_REGEX.test(body.color)) {
    throw new AppError('Formato de color inválido. Usa #RRGGBB', 400);
  }

  return repo.create({ ...body, nombre, userId });
}

export function update(id, body, userId) {
  if (body.telefono && !PHONE_REGEX.test(body.telefono.trim())) {
    throw new AppError('Formato de teléfono inválido. Usa: +XXX XXXXXXXX', 400);
  }
  if (body.color && !COLOR_REGEX.test(body.color)) {
    throw new AppError('Formato de color inválido. Usa #RRGGBB', 400);
  }

  return repo.update(id, { ...body, userId });
}

export function remove(id) {
  return repo.remove(id);
}
