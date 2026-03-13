function normalizeDiaKey(value) {
  if (value == null) return '';
  return String(value).trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

const DIA_CANON_BY_NORM = {
  lunes: 'Lunes',
  martes: 'Martes',
  miercoles: 'Miércoles',
  jueves: 'Jueves',
  viernes: 'Viernes',
  sabado: 'Sábado',
  domingo: 'Domingo',
};

function parseScheduleSource(rawSchedule) {
  if (rawSchedule == null) return null;
  if (typeof rawSchedule === 'string') {
    try {
      return JSON.parse(rawSchedule);
    } catch {
      return null;
    }
  }
  return rawSchedule;
}

function normalizeCursoSchedule(rawSchedule) {
  const source = parseScheduleSource(rawSchedule);
  if (!source || typeof source !== 'object' || Array.isArray(source)) {
    return { schedule: null, hadEntries: false };
  }

  const entries = Object.entries(source);
  const normalized = {};
  for (const [diaRaw, slot] of entries) {
    const diaNorm = normalizeDiaKey(diaRaw);
    const diaCanon = DIA_CANON_BY_NORM[diaNorm];
    if (!diaCanon || !slot || typeof slot !== 'object') continue;
    normalized[diaCanon] = slot;
  }

  return {
    schedule: normalized,
    hadEntries: entries.length > 0,
  };
}

function timeToMinutes(time) {
  const [h, m] = String(time).split(':').map(Number);
  return h * 60 + m;
}

export function validateTutorCourseSchedule(tutor, curso) {
  const issues = [];
  let compatible = true;

  if (!tutor || !curso) {
    return { compatible: false, issues: ['❌ Datos de tutor o curso no encontrados'] };
  }

  if (!tutor.dias_horarios || Object.keys(tutor.dias_horarios).length === 0) {
    return { compatible: false, issues: ['❌ El tutor no tiene horarios definidos'] };
  }

  const { schedule: cursoSchedule, hadEntries } = normalizeCursoSchedule(curso.dias_schedule);
  if (!cursoSchedule || Object.keys(cursoSchedule).length === 0) {
    if (hadEntries) {
      return {
        compatible: false,
        issues: ['❌ El formato de horario del curso es inválido. Vuelve a guardar el horario por día.'],
      };
    }
    return { compatible: false, issues: ['❌ El curso no tiene horarios definidos'] };
  }

  const diasCurso = Object.keys(cursoSchedule);
  const diasTutor = Object.keys(tutor.dias_horarios);

  const tutorKeyByNorm = {};
  for (const k of diasTutor) {
    const nk = normalizeDiaKey(k);
    if (nk && !tutorKeyByNorm[nk]) tutorKeyByNorm[nk] = k;
  }

  for (const dia of diasCurso) {
    const diaNorm = normalizeDiaKey(dia);
    const diaTutorKey = tutorKeyByNorm[diaNorm];

    if (!diaTutorKey) {
      compatible = false;
      issues.push(`❌ El tutor NO está disponible el ${dia}`);
      continue;
    }

    const tutorHorario = tutor.dias_horarios[diaTutorKey];
    const cursoHorario = cursoSchedule[dia];

    if (!tutorHorario || !cursoHorario) {
      compatible = false;
      issues.push(`❌ Horarios incompletos para ${dia}`);
      continue;
    }

    const tutorInicio = timeToMinutes(tutorHorario.hora_inicio);
    const tutorFin = timeToMinutes(tutorHorario.hora_fin);
    const cursoInicio = timeToMinutes(cursoHorario.hora_inicio);
    const cursoFin = timeToMinutes(cursoHorario.hora_fin);

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
  }

  if (compatible && issues.length === 0) {
    issues.push('✅ Horarios compatibles: El tutor puede enseñar este curso');
  }

  return { compatible, issues };
}

export function canAssignTutorToCourse(tutor, curso, options = {}) {
  const { throwError = false } = options;
  const validation = validateTutorCourseSchedule(tutor, curso);

  if (!validation.compatible) {
    const reason = validation.issues.filter((i) => i.startsWith('❌')).join('; ');
    if (throwError) {
      const error = new Error('Incompatible schedule: ' + reason);
      error.details = validation;
      throw error;
    }
    return { valid: false, reason };
  }

  return { valid: true };
}
