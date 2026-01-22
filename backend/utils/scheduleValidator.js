/**
 * Utilidades para validar compatibilidad de horarios entre tutor y curso
 */

/**
 * Verifica si un tutor es compatible con un curso
 * @param {Object} tutor - Objeto tutor con dias_horarios
 * @param {Object} curso - Objeto curso con dias_schedule o dias_turno
 * @returns {Object} { compatible: boolean, issues: string[] }
 */
export function validateTutorCourseSchedule(tutor, curso) {
  const issues = [];
  let compatible = true;

  // Si no hay información de horarios, asumimos compatibilidad
  if (!tutor || !curso) {
    return { compatible: false, issues: ['Datos de tutor o curso no encontrados'] };
  }

  // Si el tutor no tiene dias_horarios definido, es compatible por defecto
  if (!tutor.dias_horarios || Object.keys(tutor.dias_horarios).length === 0) {
    return { compatible: true, issues: [] };
  }

  // Determinar qué horario del curso usar (preferir dias_schedule)
  const cursoSchedule = curso.dias_schedule || curso.dias_turno;
  if (!cursoSchedule || Object.keys(cursoSchedule).length === 0) {
    return { compatible: true, issues: [] };
  }

  // Verificar que el tutor tenga disponibilidad en cada día del curso
  const diasCurso = Object.keys(cursoSchedule);
  const diasTutor = Object.keys(tutor.dias_horarios);

  for (const dia of diasCurso) {
    if (!diasTutor.includes(dia)) {
      compatible = false;
      issues.push(`❌ Tutor no disponible el ${dia}`);
      continue;
    }

    // Verificar horarios detallados si existen
    if (curso.dias_schedule && curso.dias_schedule[dia]) {
      const cursoHora = curso.dias_schedule[dia];
      const tutorSlots = tutor.dias_horarios[dia];

      if (Array.isArray(tutorSlots) && tutorSlots.length > 0) {
        const hasMatch = tutorSlots.some(slot => {
          // Comparar horarios (simplificado: verificar que se solapan)
          const tutorStart = timeToMinutes(slot.hora_inicio);
          const tutorEnd = timeToMinutes(slot.hora_fin);
          const cursoStart = timeToMinutes(cursoHora.hora_inicio);
          const cursoEnd = timeToMinutes(cursoHora.hora_fin);

          return !(tutorEnd <= cursoStart || tutorStart >= cursoEnd);
        });

        if (!hasMatch) {
          compatible = false;
          issues.push(`❌ Horario del tutor no disponible el ${dia} a las ${cursoHora.hora_inicio}`);
        }
      }
    }
  }

  if (compatible && issues.length === 0) {
    issues.push('✅ Tutor compatible con el curso');
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
