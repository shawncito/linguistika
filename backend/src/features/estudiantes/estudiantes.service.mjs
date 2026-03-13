import * as repo from './estudiantes.repository.mjs';
import { AppError } from '../../shared/errors/AppError.mjs';
import { getOrCreateEncargadoId } from '../../shared/utils/encargados.mjs';

function normalizeText(value) {
  const text = String(value ?? '').trim();
  return text || null;
}

function extractEncargadoFields(body) {
  return {
    nombre: normalizeText(body.encargado_nombre ?? body.nombre_encargado),
    email: normalizeText(body.encargado_email ?? body.email_encargado),
    telefono: normalizeText(body.encargado_telefono ?? body.telefono_encargado),
  };
}

export function getAll() {
  return repo.findAll();
}

export function getById(id) {
  return repo.findById(id);
}

export async function create(body, userId) {
  const nombre = String(body.nombre ?? '').trim();
  if (!nombre) throw new AppError('Campo requerido: nombre', 400);

  const grado = body.grado ?? body.nivel ?? null;
  const encargadoFields = extractEncargadoFields(body);

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
  if (!encargado_id && (encargadoFields.nombre || encargadoFields.email || encargadoFields.telefono)) {
    encargado_id = await getOrCreateEncargadoId({
      nombre: encargadoFields.nombre,
      email: encargadoFields.email,
      telefono: encargadoFields.telefono,
    });
  }

  return repo.create({
    ...body,
    nombre,
    grado,
    nivel: grado,
    nombre_encargado: body.nombre_encargado ?? encargadoFields.nombre,
    email_encargado: body.email_encargado ?? encargadoFields.email,
    telefono_encargado: body.telefono_encargado ?? encargadoFields.telefono,
    encargado_nombre: encargadoFields.nombre,
    encargado_email: encargadoFields.email,
    encargado_telefono: encargadoFields.telefono,
    encargado_id,
    userId,
  });
}

export async function update(id, body, userId) {
  const payload = { ...body, userId };
  const encargadoFields = extractEncargadoFields(body);

  const hasEncargadoId = Object.prototype.hasOwnProperty.call(body, 'encargado_id');
  let encargadoId = hasEncargadoId ? body.encargado_id : undefined;

  // Si vienen campos de encargado y no hay encargado_id explícito, resolverlo automáticamente
  if ((encargadoId === undefined || encargadoId === null || encargadoId === '')
      && (encargadoFields.nombre || encargadoFields.email || encargadoFields.telefono)) {
    encargadoId = await getOrCreateEncargadoId({
      nombre: encargadoFields.nombre,
      email: encargadoFields.email,
      telefono: encargadoFields.telefono,
    });
  }

  if (encargadoId !== undefined) {
    payload.encargado_id = encargadoId || null;
  }

  if (body.grado !== undefined || body.nivel !== undefined) {
    const grado = body.grado ?? body.nivel ?? null;
    payload.grado = grado;
    payload.nivel = grado;
  }

  if (body.nombre_encargado !== undefined || body.encargado_nombre !== undefined) {
    payload.nombre_encargado = body.nombre_encargado ?? encargadoFields.nombre;
    payload.encargado_nombre = encargadoFields.nombre;
  }

  if (body.email_encargado !== undefined || body.encargado_email !== undefined) {
    payload.email_encargado = body.email_encargado ?? encargadoFields.email;
    payload.encargado_email = encargadoFields.email;
  }

  if (body.telefono_encargado !== undefined || body.encargado_telefono !== undefined) {
    payload.telefono_encargado = body.telefono_encargado ?? encargadoFields.telefono;
    payload.encargado_telefono = encargadoFields.telefono;
  }

  return repo.update(id, payload);
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
