import * as repo from './estudiantes.repository.mjs';
import { AppError } from '../../shared/errors/AppError.mjs';
import { getOrCreateEncargadoId } from '../../shared/utils/encargados.mjs';

export function getAll() {
  return repo.findAll();
}

export function getById(id) {
  return repo.findById(id);
}

export async function create(body, userId) {
  const nombre = String(body.nombre ?? '').trim();
  if (!nombre) throw new AppError('Campo requerido: nombre', 400);

  // Verificar duplicados en estudiantes y bulk
  const [existingEst, existingBulk] = await Promise.all([
    repo.findByName(nombre),
    repo.findByNameInBulk(nombre),
  ]);
  if (existingEst.length > 0 || existingBulk.length > 0) {
    throw new AppError(`Ya existe un estudiante con el nombre "${nombre}"`, 409);
  }

  // Resolver encargado_id
  let encargado_id = body.encargado_id || null;
  if (!encargado_id && (body.encargado_nombre || body.encargado_email)) {
    encargado_id = await getOrCreateEncargadoId({
      nombre: body.encargado_nombre,
      email: body.encargado_email,
      telefono: body.encargado_telefono,
    });
  }

  return repo.create({ ...body, nombre, encargado_id, userId });
}

export async function update(id, body, userId) {
  // Si vienen campos de encargado → resolver encargado_id
  if (!body.encargado_id && (body.encargado_nombre || body.encargado_email)) {
    body.encargado_id = await getOrCreateEncargadoId({
      nombre: body.encargado_nombre,
      email: body.encargado_email,
      telefono: body.encargado_telefono,
    });
  }
  return repo.update(id, { ...body, userId });
}

export async function remove(id) {
  const student = await repo.findById(id);
  const result = await repo.remove(id);

  // Si tenía encargado, verificar si hay que eliminar su cuenta
  if (student.encargado_id) {
    const count = await repo.countEstudiantesByEncargado(student.encargado_id);
    if (count === 0) {
      await repo.deleteEncargadoAccount(student.encargado_id);
    }
  }

  return result;
}
