/**
 * Utilidades para validar compatibilidad de horarios entre tutor y curso
 */

/**
 * Verifica si un tutor es compatible con un curso
 * Valida que CADA día del curso esté en la disponibilidad del tutor
 * Y que el rango de horas del curso esté COMPLETAMENTE dentro del rango del tutor
 * @param {Object} tutor - Objeto tutor con dias_horarios
 * @param {Object} curso - Objeto curso con dias_schedule
 * @returns {Object} { compatible: boolean, issues: string[] }
 */
export function validateTutorCourseSchedule(tutor, curso) {
  const issues = [];
  let compatible = true;

  // Validación básica
  if (!tutor || !curso) {
    return { compatible: false, issues: ['❌ Datos de tutor o curso no encontrados'] };
  }

  // Si el tutor no tiene dias_horarios definido, NO es compatible
  if (!tutor.dias_horarios || Object.keys(tutor.dias_horarios).length === 0) {
    return { compatible: false, issues: ['❌ El tutor no tiene horarios definidos'] };
  }

  // Obtener el horario del curso (debe ser dias_schedule)
  const cursoSchedule = curso.dias_schedule;
  if (!cursoSchedule || Object.keys(cursoSchedule).length === 0) {
    return { compatible: false, issues: ['❌ El curso no tiene horarios definidos'] };
  }

  // Validar CADA día y horario del curso
  const diasCurso = Object.keys(cursoSchedule);
  const diasTutor = Object.keys(tutor.dias_horarios);

  for (const dia of diasCurso) {
    // ✅ VALIDACIÓN 1: ¿Existe el día en la disponibilidad del tutor?
    if (!diasTutor.includes(dia)) {
      compatible = false;
      issues.push(`❌ El tutor NO está disponible el ${dia}`);
      continue;
    }

    // ✅ VALIDACIÓN 2: ¿El rango de horas del curso está dentro del rango del tutor?
    const tutorHorario = tutor.dias_horarios[dia];
    const cursoHorario = cursoSchedule[dia];

    if (!tutorHorario || !cursoHorario) {
      compatible = false;
      issues.push(`❌ Horarios incompletos para ${dia}`);
      continue;
    }

    // Convertir a minutos para comparación
    const tutorInicio = timeToMinutes(tutorHorario.hora_inicio);
    const tutorFin = timeToMinutes(tutorHorario.hora_fin);
    const cursoInicio = timeToMinutes(cursoHorario.hora_inicio);
    const cursoFin = timeToMinutes(cursoHorario.hora_fin);

    // Validación lógica empresarial:
    // El curso DEBE estar COMPLETAMENTE dentro del rango del tutor
    if (cursoInicio < tutorInicio) {
      compatible = false;
      issues.push(`❌ ${dia}: Curso comienza a las ${cursoHorario.hora_inicio}, pero tutor disponible desde ${tutorHorario.hora_inicio}`);
      continue;
    }

    if (cursoFin > tutorFin) {
      compatible = false;
      issues.push(`❌ ${dia}: Curso termina a las ${cursoHorario.hora_fin}, pero tutor disponible hasta ${tutorHorario.hora_fin}`);
      continue;
    }

    // Validación adicional: no puede ser justo a la frontera (necesita 5 minutos de buffer)
    if (cursoInicio === tutorInicio || cursoFin === tutorFin) {
      // Esta es una advertencia, no un error bloqueador
      // Comentado por ahora, pero podría usarse para validación más estricta
      // issues.push(`⚠️ ${dia}: El curso no tiene margen de tiempo`);
    }
  }

  if (compatible && issues.length === 0) {
    issues.push('✅ Horarios compatibles: El tutor puede enseñar este curso');
  }

  return { compatible, issues };
}

/**
 * Convierte un horario (HH:MM) a minutos desde medianoche
 */
function timeToMinutes(time) {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

/**
 * Valida si un tutor puede ser asignado a un curso
 * @param {Object} tutor - Objeto tutor
 * @param {Object} curso - Objeto curso
 * @param {Object} options - Opciones adicionales
 * @returns {Object} { valid: boolean, reason?: string }
 */
export function canAssignTutorToCourse(tutor, curso, options = {}) {
  const { throwError = false } = options;

  const validation = validateTutorCourseSchedule(tutor, curso);

  if (!validation.compatible) {
    const reason = validation.issues.filter(i => i.startsWith('❌')).join('; ');
    if (throwError) {
      const error = new Error('Incompatible schedule: ' + reason);
      error.details = validation;
      throw error;
    }
    return { valid: false, reason };
  }

  return { valid: true };
}

export default {
  validateTutorCourseSchedule,
  canAssignTutorToCourse,
  timeToMinutes
};
