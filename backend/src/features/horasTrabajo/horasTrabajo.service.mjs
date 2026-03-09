import AppError from '../../shared/errors/AppError.mjs';
import * as repo from './horasTrabajo.repository.mjs';

export async function list(filters) {
  return repo.findAll(filters);
}

export async function getById(id) {
  return repo.findById(id);
}

export async function create({ tutor_id, clase_id, fecha, horas, tarifa_por_hora, notas, userId }) {
  if (!tutor_id || !fecha || !horas) {
    throw new AppError('Campos requeridos: tutor_id, fecha, horas', 400);
  }

  let tarifa = Number(tarifa_por_hora);
  if (!tarifa || Number.isNaN(tarifa)) {
    tarifa = await repo.fetchTarifaTutor(tutor_id);
  }

  return repo.create({ tutor_id, clase_id, fecha, horas, tarifa_por_hora: tarifa, notas, userId });
}

export async function update(id, body) {
  const existing = await repo.findById(id);
  if (existing.estado !== 'pendiente') {
    throw new AppError('Solo se puede editar si está pendiente', 400);
  }
  return repo.update(id, body, existing);
}

export async function aprobar(id, approverId) {
  const existing = await repo.findById(id);
  if (existing.estado !== 'pendiente') {
    throw new AppError('El registro ya fue procesado', 400);
  }

  const updated = await repo.aprobar(id, approverId);
  await repo.crearPagoDesdeHoras(existing, approverId);
  return { horas_trabajo: updated, pago_creado: true };
}
