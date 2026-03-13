import * as repo from './cursos.repository.mjs';
import { AppError } from '../../shared/errors/AppError.mjs';
import {
  canAssignTutorToCourse,
} from '../../shared/utils/scheduleValidator.mjs';

function normalizeTutorId(rawTutorId) {
  if (rawTutorId === undefined || rawTutorId === null || rawTutorId === '') return null;
  const parsed = Number(rawTutorId);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed;
}

function scheduleOverlaps(a, b) {
  // a y b: { dias_horario: string[], hora_inicio: string, hora_fin: string }
  const diasA = Array.isArray(a.dias_horario) ? a.dias_horario : [];
  const diasB = Array.isArray(b.dias_horario) ? b.dias_horario : [];
  const sharedDays = diasA.some((d) => diasB.includes(d));
  if (!sharedDays) return false;
  const toMin = (t) => {
    const [h, m] = String(t ?? '').split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
  };
  const s1 = toMin(a.hora_inicio);
  const e1 = toMin(a.hora_fin);
  const s2 = toMin(b.hora_inicio);
  const e2 = toMin(b.hora_fin);
  return s1 < e2 && s2 < e1;
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
  const tutorId = normalizeTutorId(body.tutor_id);

  // Duplicado de nombre
  const existing = await repo.findByName(nombre);
  if (existing.length > 0) throw new AppError('Ya existe un curso con ese nombre', 409);

  if (tutorId) {
    // Validar tutor
    const tutor = await repo.findTutorById(tutorId);
    if (!tutor) throw new AppError('Tutor no encontrado', 404);

    // Aptitud del tutor
    const aptResult = canAssignTutorToCourse(tutor, body, { throwError: false });
    if (!aptResult.valid) throw new AppError(aptResult.reason, 400);

    // Conflictos de horario del tutor
    const otrosCursos = await repo.getAllCursosForTutor(tutorId);
    for (const otro of otrosCursos) {
      if (scheduleOverlaps(body, otro)) {
        throw new AppError(
          `El tutor ya tiene el curso "${otro.nombre}" en ese horario`,
          409
        );
      }
    }
  }

  return repo.create({ ...body, nombre, tutor_id: tutorId, userId });
}

export async function update(id, body, userId) {
  const curso = await repo.findById(id);
  const hasTutorInBody = Object.prototype.hasOwnProperty.call(body, 'tutor_id');
  const tutorId = hasTutorInBody ? normalizeTutorId(body.tutor_id) : normalizeTutorId(curso.tutor_id);
  const shouldValidateTutor = !!tutorId;
  const hasScheduleUpdate = !!(body.dias_horario || body.hora_inicio || body.hora_fin);
  const hasTutorOrLevelUpdate = hasTutorInBody || body.nivel !== undefined;

  if (shouldValidateTutor && (hasTutorInBody || hasScheduleUpdate || body.nivel !== undefined)) {
    const tutor = await repo.findTutorById(tutorId);
    if (!tutor) throw new AppError('Tutor no encontrado', 404);

    const cursoActualizado = {
      ...curso,
      ...body,
      tutor_id: tutorId,
    };

    if (hasTutorOrLevelUpdate) {
      const aptResult = canAssignTutorToCourse(tutor, cursoActualizado, { throwError: false });
      if (!aptResult.valid) throw new AppError(aptResult.reason, 400);
    }

    if (hasScheduleUpdate || hasTutorInBody) {
      const otrosCursos = await repo.getAllCursosForTutor(tutorId, id);
      for (const otro of otrosCursos) {
        if (scheduleOverlaps(cursoActualizado, otro)) {
          throw new AppError(
            `El tutor ya tiene el curso "${otro.nombre}" en ese horario`,
            409
          );
        }
      }
    }
  }

  const payload = { ...body, userId };
  if (hasTutorInBody) {
    payload.tutor_id = tutorId;
  }

  return repo.update(id, payload);
}

export async function remove(id, force = false) {
  const [nMat, nCla, nMov] = await Promise.all([
    repo.countMatriculas(id),
    repo.countClases(id),
    repo.countMovimientos(id),
  ]);

  const blockers = [];
  if (nMat > 0) blockers.push(`${nMat} matrículas`);
  if (nMov > 0) blockers.push(`${nMov} movimientos financieros`);

  if (blockers.length > 0 && !force) {
    throw new AppError(
      `No se puede eliminar el curso: tiene ${blockers.join(' y ')}. Use force=true para eliminar en cascada.`,
      409
    );
  }

  if (force) {
    await repo.cascadeDeleteCurso(id);
    return { message: 'Curso eliminado en cascada' };
  }

  return repo.remove(id);
}
