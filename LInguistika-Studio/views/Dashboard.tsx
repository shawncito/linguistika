// Dashboard con calendario interactivo mejorado
import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';
import { Matricula, Curso, Tutor, Estudiante, ResumenTutorEstudiantes, ResumenCursoGrupos } from '../types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, Badge, Input, Button, Dialog } from '../components/UI';
import { formatCRC } from '../lib/format';
import { 
  Users, BookOpen, GraduationCap, 
  ClipboardList, Clock, CreditCard,
  User as UserIcon, Calendar as CalendarIcon,
  TrendingUp, Award, ChevronRight, Activity, Star
} from 'lucide-react';

interface Stats {
  tutores_activos: number;
  estudiantes_activos: number;
  cursos_activos: number;
  matriculas_activas: number;
  total_clases: number;
  ingresos_pendientes: number;
}

interface SesionDelDia {
  matricula_id: number;
  curso_nombre: string;
  estudiante_nombre: string;
  tutor_nombre: string;
  hora_inicio: string;
  hora_fin: string;
  duracion_horas: number;
  turno: string;
  tutor_id?: number;
  estudiante_id?: number;
  curso_id?: number;
  avisado?: boolean;
  confirmado?: boolean;
  fecha?: string;
}

interface MetricasFinancieras {
  mes: string;
  fecha_inicio: string;
  fecha_fin: string;
  ingresos: number;
  pagos_tutores: number;
  neto: number;
  movimientos: number;
  tutor_id?: number | null;
  series?: Array<{ mes: string; ingresos: number; egresos: number; neto: number }>;
  top_tutores?: Array<{ tutor_id: number; tutor_nombre: string; total: number }>;
  fuente?: string;
}

const Dashboard: React.FC = () => {
  const [stats, setStats] = useState<Stats | null>(null);
  // Fecha de hoy usando zona horaria de Costa Rica
  const crToday = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Costa_Rica' });
  const [hoy, setHoy] = useState<string>(crToday);
  const [selectedDate, setSelectedDate] = useState<string>(crToday);
  const [sesionesDelDia, setSesionesDelDia] = useState<SesionDelDia[]>([]);
  const [sesionesHoy, setSesionesHoy] = useState<SesionDelDia[]>([]);
  const [matriculasLista, setMatriculasLista] = useState<any[]>([]);
  const [tutoresMapa, setTutoresMapa] = useState<Record<number, Tutor>>({});
  const [estudiantesMapa, setEstudiantesMapa] = useState<Record<number, Estudiante>>({});
  const [loading, setLoading] = useState(true);
  const [resumenTutores, setResumenTutores] = useState<ResumenTutorEstudiantes[]>([]);
  const [resumenCursos, setResumenCursos] = useState<ResumenCursoGrupos[]>([]);
  const [sesionesDelMes, setSesionesDelMes] = useState<Record<string, SesionDelDia[]>>({});
  const [showDayDetail, setShowDayDetail] = useState(false);
  const [detalleMatricula, setDetalleMatricula] = useState<any | null>(null);
  const [tutorSeleccionado, setTutorSeleccionado] = useState<{ id: number; nombre: string } | null>(null);
  const [alumnosTutor, setAlumnosTutor] = useState<{ id: number; nombre: string }[]>([]);
  const [programacionSesion, setProgramacionSesion] = useState<{ sesion: SesionDelDia; modo: 'info' | 'programar' } | null>(null);
  const [mensajeWA, setMensajeWA] = useState('');
  const [completandoKeys, setCompletandoKeys] = useState<Record<string, boolean>>({});

  const [uiNotice, setUiNotice] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
  const [confirmMarcarDada, setConfirmMarcarDada] = useState<{ sesion: SesionDelDia; sesionKey: string } | null>(null);
  const [confirmCancelarHoy, setConfirmCancelarHoy] = useState<{ sesion: SesionDelDia; sesionKey: string; motivo: string } | null>(null);

  const [metricMes, setMetricMes] = useState<string>(crToday.slice(0, 7));
  const [metricas, setMetricas] = useState<MetricasFinancieras | null>(null);
  const [metricasDenied, setMetricasDenied] = useState(false);

  const getSesionKey = useCallback((s: SesionDelDia) => {
    return `${s.matricula_id}:${s.hora_inicio}:${s.hora_fin}:${s.curso_nombre}`;
  }, []);

  // Función para obtener el día de la semana en español
  const getDiaSemana = (fecha: string): string => {
    const dias = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    const date = new Date(fecha + 'T00:00:00');
    return dias[date.getDay()];
  };

  // Utilidades para resumen
  const parseMaybeJSON = (value: any) => {
    if (typeof value === 'string') {
      try {
        return JSON.parse(value);
      } catch (e) {
        return value;
      }
    }
    return value;
  };

  const getDiaVariants = (diaSemana: string): string[] => {
    const base = String(diaSemana || '').trim();
    const lower = base.toLowerCase();
    const noAccent = lower
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .trim();
    const short = base.slice(0, 3);
    const shortLower = short.toLowerCase();
    const shortNoAccent = shortLower
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .trim();

    const variants = new Set<string>([
      base,
      lower,
      noAccent,
      short,
      shortLower,
      shortNoAccent,
      base.toUpperCase(),
      short.toUpperCase(),
    ]);

    // Alias comunes por día (por si en BD guardaron abreviado o sin acento)
    const aliasMap: Record<string, string[]> = {
      lunes: ['lun', 'lunes'],
      martes: ['mar', 'martes'],
      miercoles: ['mie', 'mié', 'miercoles', 'miércoles'],
      jueves: ['jue', 'jueves'],
      viernes: ['vie', 'viernes'],
      sabado: ['sab', 'sáb', 'sabado', 'sábado'],
      domingo: ['dom', 'domingo'],
    };
    const key = Object.keys(aliasMap).find((k) => noAccent === k);
    if (key) {
      for (const a of aliasMap[key]) {
        variants.add(a);
        variants.add(a.toUpperCase());
      }
    }

    return Array.from(variants);
  };

  const pickDiaKey = (obj: any, diaSemana: string): string | null => {
    if (!obj || typeof obj !== 'object') return null;
    const variants = getDiaVariants(diaSemana);
    for (const v of variants) {
      if (Object.prototype.hasOwnProperty.call(obj, v)) return v;
    }
    // Fallback: búsqueda por normalización (por si hay espacios/acentos raros)
    const entries = Object.keys(obj);
    const target = String(diaSemana)
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '');
    const targetShort = target.slice(0, 3);
    for (const k of entries) {
      const nk = String(k)
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '');
      if (nk === target || nk === targetShort) return k;
    }
    return null;
  };

  const getCursoScheduleForDay = (curso: any, diaSemana: string) => {
    const scheduleRaw = parseMaybeJSON(curso?.dias_schedule);
    const turnosRaw = parseMaybeJSON(curso?.dias_turno);

    // 1) dias_schedule como objeto por día
    if (scheduleRaw && typeof scheduleRaw === 'object' && !Array.isArray(scheduleRaw)) {
      const key = pickDiaKey(scheduleRaw, diaSemana);
      if (key) return { kind: 'schedule', value: scheduleRaw[key] } as const;
    }

    // 2) dias_schedule como lista de sesiones
    if (Array.isArray(scheduleRaw)) {
      const variants = new Set(getDiaVariants(diaSemana).map((x) => String(x).toLowerCase()));
      const match = scheduleRaw.find((s: any) => {
        const d = String(s?.dia ?? s?.dia_semana ?? s?.day ?? '').trim();
        if (!d) return false;
        return variants.has(d.toLowerCase());
      });
      if (match) return { kind: 'schedule', value: match } as const;
    }

    // 3) fallback a dias_turno
    if (turnosRaw && typeof turnosRaw === 'object' && !Array.isArray(turnosRaw)) {
      const key = pickDiaKey(turnosRaw, diaSemana);
      if (key) return { kind: 'turno', value: turnosRaw[key] } as const;
    }

    return null;
  };

  const renderHorarioBadges = (m: any) => {
    const scheduleRaw = parseMaybeJSON(m.curso_dias_schedule as any);
    const turnosRaw = parseMaybeJSON(m.curso_dias_turno as any);
    const items: { dia: string; label: string }[] = [];

    if (scheduleRaw && typeof scheduleRaw === 'object' && !Array.isArray(scheduleRaw)) {
      Object.entries(scheduleRaw).forEach(([dia, info]: any) => {
        if (!info) return;
        const hi = info.hora_inicio || info.horaInicio || info.start;
        const hf = info.hora_fin || info.horaFin || info.end;
        const turno = info.turno;
        if (hi || hf || turno) {
          items.push({ dia, label: `${hi || ''}${hi && hf ? ' - ' : ''}${hf || ''}${turno ? ` • ${turno}` : ''}`.trim() });
        }
      });
    }

    if (!items.length && Array.isArray(scheduleRaw)) {
      scheduleRaw.forEach((sesion: any, idx: number) => {
        const dia = sesion?.dia || sesion?.dia_semana || sesion?.day || `Sesión ${idx + 1}`;
        const hi = sesion?.hora_inicio || sesion?.start;
        const hf = sesion?.hora_fin || sesion?.end;
        if (hi || hf) {
          items.push({ dia, label: `${hi}${hi && hf ? ' - ' : ''}${hf || ''}` });
        }
      });
    }

    if (!items.length && turnosRaw && typeof turnosRaw === 'object') {
      Object.entries(turnosRaw).forEach(([dia, turno]: any) => {
        items.push({ dia, label: `${turno}` });
      });
    }

    if (!items.length) {
      return <div className="text-xs text-slate-400 mt-3">Sin horario asignado</div>;
    }

    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3">
        {items.map(({ dia, label }) => {
          const diaTexto = String(dia || '').trim();
          return (
            <div key={diaTexto || label} className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-[12px] font-semibold text-slate-200">
              <span className="uppercase tracking-wide">{diaTexto ? diaTexto.slice(0, 3) : 'Día'}</span>
              <span className="text-white">{label}</span>
            </div>
          );
        })}
      </div>
    );
  };

  const estadoSesionLabel = (s: SesionDelDia) => {
    if (s.confirmado) return 'Confirmada';
    if (s.avisado) return 'En espera de confirmación';
    return 'Programada';
  };

  const telefonoTutor = (s: SesionDelDia) => {
    const t = s.tutor_id ? tutoresMapa[s.tutor_id] : undefined;
    return t?.telefono || '';
  };

  const telefonoEncargado = (s: SesionDelDia) => {
    const e = s.estudiante_id ? estudiantesMapa[s.estudiante_id] : undefined;
    return e?.telefono_encargado || e?.telefono || '';
  };

  const buildWaUrl = (numero: string, mensaje: string) => numero ? `https://wa.me/${numero.replace(/\D/g, '')}?text=${encodeURIComponent(mensaje)}` : '';

  const abrirProgramacion = (sesion: SesionDelDia, modo: 'info' | 'programar') => {
    setProgramacionSesion({ sesion, modo });
    const fechaLabel = hoy ? new Date(hoy + 'T00:00:00').toLocaleDateString('es-CR') : '';
    const msg = `Hola, confirmamos la sesión de ${sesion.curso_nombre} con ${sesion.estudiante_nombre} el ${fechaLabel} de ${sesion.hora_inicio} a ${sesion.hora_fin}. ¿Puedes confirmar asistencia?`;
    setMensajeWA(msg);
  };

  const cerrarProgramacion = () => setProgramacionSesion(null);

  const cambiarEstadoSesion = async (sesion: SesionDelDia, avisado?: boolean, confirmado?: boolean) => {
    try {
      const fecha = sesion.fecha || new Date().toISOString().split('T')[0];
      await api.dashboard.actualizarEstadoSesion(sesion.matricula_id, fecha, { avisado, confirmado });
      await fetchData();
      alert('Estado actualizado');
    } catch (e) {
      console.error('Error al actualizar estado:', e);
      alert('Error al actualizar estado');
    }
  };

  const cargarDetalleMatricula = async (matriculaId: number) => {
    try {
      const all = await api.matriculas.getAll();
      const m = all.find((x) => x.id === matriculaId);
      if (!m) {
        setDetalleMatricula(null);
        return;
      }
      let students: { id: number; nombre: string }[] = [];
      if (m.es_grupo && m.grupo_nombre) {
        const miembros = all.filter((x) => x.curso_id === m.curso_id && x.grupo_nombre === m.grupo_nombre);
        const uniq = new Map<number, string>();
        miembros.forEach((x) => {
          if (x.estudiante_id) uniq.set(x.estudiante_id, x.estudiante_nombre || `Alumno ${x.estudiante_id}`);
        });
        students = Array.from(uniq.entries()).map(([id, nombre]) => ({ id, nombre }));
      } else if (m.estudiante_id) {
        students = [{ id: m.estudiante_id, nombre: m.estudiante_nombre || `Alumno ${m.estudiante_id}` }];
      }
      setDetalleMatricula({ ...m, students });
    } catch (e) {
      console.error('Error cargando detalle de matrícula', e);
      setDetalleMatricula(null);
    }
  };

  const cargarAlumnosTutor = async (tutorId: number, nombre: string) => {
    try {
      const all = await api.matriculas.getAll();
      const filtradas = all.filter((m) => m.tutor_id === tutorId && m.estado !== 0);
      const uniq = new Map<number, string>();
      filtradas.forEach((m) => {
        if (m.estudiante_id) uniq.set(m.estudiante_id, m.estudiante_nombre || `Alumno ${m.estudiante_id}`);
      });
      setTutorSeleccionado({ id: tutorId, nombre });
      setAlumnosTutor(Array.from(uniq.entries()).map(([id, nombre]) => ({ id, nombre })));
    } catch (e) {
      console.error('Error cargando alumnos del tutor', e);
      setTutorSeleccionado({ id: tutorId, nombre });
      setAlumnosTutor([]);
    }
  };

  // Función para calcular sesiones del día: primero intenta backend, luego fallback local
  // IMPORTANTE: Las sesiones SOLO salen de MATRÍCULAS ACTIVAS (estado=true)
  // Si un curso existe pero no tiene matrículas, NO aparecerá en la agenda
  const calcularSesionesDelDia = async (fecha: string, setSesiones: (sesiones: SesionDelDia[]) => void) => {
    try {
      // 1) Intentar obtener agenda desde backend (incluye fallback del servidor)
      // IMPORTANTE: una lista vacía es un resultado válido (significa "no hay sesiones")
      // El fallback local debe usarse solo si el backend falla.
      let desdeServidor: any[] | null = null;
      try {
        desdeServidor = await api.dashboard.getAgenda(fecha);
      } catch (e) {
        desdeServidor = null;
      }

      if (desdeServidor !== null) {
        const sesiones = (desdeServidor || []).map((c: any) => ({
          matricula_id: c.matricula_id ?? 0,
          curso_nombre: c.curso_nombre ?? 'Curso',
          estudiante_nombre: c.estudiante_nombre ?? 'Estudiante',
          tutor_nombre: c.tutor_nombre ?? 'Tutor',
          hora_inicio: c.hora_inicio ?? '—',
          hora_fin: c.hora_fin ?? '—',
          duracion_horas: c.duracion_horas ?? 0,
          turno: c.turno ?? '—',
          tutor_id: c.tutor_id,
          estudiante_id: c.estudiante_id,
          curso_id: c.curso_id,
          avisado: Boolean(c.avisado),
          confirmado: Boolean(c.confirmado),
          fecha: c.fecha ?? fecha,
        })) as SesionDelDia[];
        sesiones.sort((a, b) => String(a.hora_inicio).localeCompare(String(b.hora_inicio)));
        setSesiones(sesiones);
        return;
      }

      // 2) Fallback local desde matrículas y cursos
      // Calcular el día de la semana para la fecha seleccionada
      const diaSemana = getDiaSemana(fecha);
      // Obtener SOLO matrículas activas (estado = true). Soporta grupos (estudiante_id puede ser null).
      const matriculas = (await api.matriculas.getAll()).filter((m: any) => {
        const isActiva = !!m?.estado;
        const hasCursoTutor = m?.curso_id != null && m?.tutor_id != null;
        const isIndividual = m?.estudiante_id != null;
        const isGrupo = !!m?.es_grupo && Array.isArray(m?.estudiante_ids) && m.estudiante_ids.length > 0;
        return isActiva && hasCursoTutor && (isIndividual || isGrupo);
      });
      setMatriculasLista(matriculas);
      const cursosPromises = matriculas.map(m => api.cursos.getById(m.curso_id));
      const tutoresPromises = matriculas.map(m => api.tutores.getById(m.tutor_id));
      const estudiantesPromises = matriculas.map((m: any) => (m?.estudiante_id != null ? api.estudiantes.getById(m.estudiante_id) : Promise.resolve(undefined)));
      const [cursos, tutores, estudiantes] = await Promise.all([
        Promise.all(cursosPromises),
        Promise.all(tutoresPromises),
        Promise.all(estudiantesPromises)
      ]);

      const sesiones: SesionDelDia[] = [];
      // Para cada matrícula activa, verificar si el curso tiene clase en el día solicitado
      matriculas.forEach((matricula, index) => {
        const curso = cursos[index];
        const tutor = tutores[index];
        const estudiante = estudiantes[index];
        const isGrupo = Boolean((matricula as any)?.es_grupo);
        const grupoNombre = String((matricula as any)?.grupo_nombre || '').trim();
        const grupoCount = Array.isArray((matricula as any)?.estudiante_ids) ? (matricula as any).estudiante_ids.length : 0;
        const estudianteNombre = !isGrupo
          ? (estudiante?.nombre || (matricula as any)?.estudiante_nombre || `Alumno ${(matricula as any)?.estudiante_id}`)
          : `Grupo: ${grupoNombre || 'Sin nombre'}${grupoCount ? ` (${grupoCount})` : ''}`;
        const sched = getCursoScheduleForDay(curso, diaSemana);
        // Verificar si el curso tiene horario definido (dias_schedule) para este día de la semana
        if (sched?.kind === 'schedule' && sched.value) {
          const schedule = sched.value as any;
          sesiones.push({
            matricula_id: matricula.id,
            curso_nombre: curso.nombre,
            estudiante_nombre: estudianteNombre,
            tutor_nombre: tutor.nombre,
            hora_inicio: schedule.hora_inicio || schedule.horaInicio || schedule.start || '—',
            hora_fin: schedule.hora_fin || schedule.horaFin || schedule.end || '—',
            duracion_horas: schedule.duracion_horas || 0,
            turno: schedule.turno,
            tutor_id: tutor.id,
            estudiante_id: !isGrupo ? (estudiante?.id ?? (matricula as any)?.estudiante_id) : undefined,
            curso_id: curso.id,
            avisado: false,
            confirmado: false,
            fecha
          });
        } else if (sched?.kind === 'turno' && sched.value) {
          const turno = sched.value as any;
          sesiones.push({
            matricula_id: matricula.id,
            curso_nombre: curso.nombre,
            estudiante_nombre: estudianteNombre,
            tutor_nombre: tutor.nombre,
            hora_inicio: '—',
            hora_fin: '—',
            duracion_horas: 0,
            turno: turno,
            tutor_id: tutor.id,
            estudiante_id: !isGrupo ? (estudiante?.id ?? (matricula as any)?.estudiante_id) : undefined,
            curso_id: curso.id,
            avisado: false,
            confirmado: false,
            fecha
          });
        }
      });
      sesiones.sort((a, b) => String(a.hora_inicio).localeCompare(String(b.hora_inicio)));
      setSesiones(sesiones);
    } catch (error) {
      console.error('Error al calcular sesiones:', error);
      setSesiones([]);
    }
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [tutoresAll, estudiantesAll] = await Promise.all([
        api.tutores.getAll().catch(() => []),
        api.estudiantes.getAll().catch(() => []),
      ]);
      const tMap: Record<number, Tutor> = {};
      const eMap: Record<number, Estudiante> = {};
      tutoresAll.forEach((t) => { if (t?.id) tMap[t.id] = t; });
      estudiantesAll.forEach((e) => { if (e?.id) eMap[e.id] = e; });
      setTutoresMapa(tMap);
      setEstudiantesMapa(eMap);

      const statsData = await api.dashboard.getStats().catch(() => ({
        tutores_activos: 0,
        estudiantes_activos: 0,
        cursos_activos: 0,
        matriculas_activas: 0,
        total_clases: 0,
        ingresos_pendientes: 0
      }));
      setStats(statsData);

      // Métricas financieras (solo admin/contador)
      try {
        const m = await api.dashboard.getMetricas({ mes: metricMes });
        setMetricas(m as any);
        setMetricasDenied(false);
      } catch (e: any) {
        const status = e?.response?.status;
        if (status === 403) {
          setMetricasDenied(true);
        }
        setMetricas(null);
      }
      
      // Calcular sesiones de HOY (usando fecha Costa Rica)
      if (hoy) {
        await calcularSesionesDelDia(hoy, setSesionesHoy);
      }
      
      // Calcular sesiones del mes completo - OPTIMIZADO
      const today = new Date(hoy + 'T00:00:00');
      const year = today.getFullYear();
      const month = today.getMonth();
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      
      // Obtener todas las matrículas activas una sola vez
      // Incluir grupos: estudiante_id puede ser null pero estudiante_ids debe tener elementos
      const matriculas = (await api.matriculas.getAll()).filter((m: any) => {
        const isActiva = !!m?.estado;
        const hasCursoTutor = m?.curso_id != null && m?.tutor_id != null;
        const isIndividual = m?.estudiante_id != null;
        const isGrupo = !!m?.es_grupo && Array.isArray(m?.estudiante_ids) && m.estudiante_ids.length > 0;
        return isActiva && hasCursoTutor && (isIndividual || isGrupo);
      });
      const cursosPromises = matriculas.map(m => api.cursos.getById(m.curso_id));
      const tutoresPromises = matriculas.map(m => api.tutores.getById(m.tutor_id));
      const estudiantesPromises = matriculas.map((m: any) => (m?.estudiante_id != null ? api.estudiantes.getById(m.estudiante_id) : Promise.resolve(undefined)));
      const [cursos, tutores, estudiantes] = await Promise.all([
        Promise.all(cursosPromises),
        Promise.all(tutoresPromises),
        Promise.all(estudiantesPromises)
      ]);

      const sesionesmes: Record<string, SesionDelDia[]> = {};
      
      // Calcular para cada día sin await individual
      for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const diaSemana = getDiaSemana(dateStr);
        const sesiones: SesionDelDia[] = [];
        
        matriculas.forEach((matricula, index) => {
          const curso = cursos[index];
          const tutor = tutores[index];
          const estudiante = estudiantes[index];
          const isGrupo = Boolean((matricula as any)?.es_grupo);
          const grupoNombre = String((matricula as any)?.grupo_nombre || '').trim();
          const grupoCount = Array.isArray((matricula as any)?.estudiante_ids) ? (matricula as any).estudiante_ids.length : 0;
          const estudianteNombre = !isGrupo
            ? (estudiante?.nombre || (matricula as any)?.estudiante_nombre || `Alumno ${(matricula as any)?.estudiante_id}`)
            : `Grupo: ${grupoNombre || 'Sin nombre'}${grupoCount ? ` (${grupoCount})` : ''}`;

          const sched = getCursoScheduleForDay(curso, diaSemana);
          if (sched?.kind === 'schedule' && sched.value) {
            const schedule = sched.value as any;
            
            sesiones.push({
              matricula_id: matricula.id,
              curso_nombre: curso.nombre,
              estudiante_nombre: estudianteNombre,
              tutor_nombre: tutor.nombre,
              hora_inicio: schedule.hora_inicio || schedule.horaInicio || schedule.start || '—',
              hora_fin: schedule.hora_fin || schedule.horaFin || schedule.end || '—',
              duracion_horas: schedule.duracion_horas || 0,
              turno: schedule.turno,
              tutor_id: tutor.id,
              estudiante_id: !isGrupo ? (estudiante?.id ?? (matricula as any)?.estudiante_id) : undefined,
              curso_id: curso.id,
              avisado: false,
              confirmado: false,
              fecha: dateStr
            });
          } else if (sched?.kind === 'turno' && sched.value) {
            const turno = sched.value as any;
            sesiones.push({
              matricula_id: matricula.id,
              curso_nombre: curso.nombre,
              estudiante_nombre: estudianteNombre,
              tutor_nombre: tutor.nombre,
              hora_inicio: '—',
              hora_fin: '—',
              duracion_horas: 0,
              turno: turno,
              tutor_id: tutor.id,
              estudiante_id: !isGrupo ? (estudiante?.id ?? (matricula as any)?.estudiante_id) : undefined,
              curso_id: curso.id,
              avisado: false,
              confirmado: false,
              fecha: dateStr
            });
          }
        });
        
        if (sesiones.length > 0) {
          sesiones.sort((a, b) => String(a.hora_inicio).localeCompare(String(b.hora_inicio)));
          sesionesmes[dateStr] = sesiones;
        }
      }
      
      // Cargar estados (avisado, confirmado) desde la base de datos para todas las fechas
      for (const dateStr of Object.keys(sesionesmes)) {
        try {
          const estados = await api.dashboard.obtenerEstadosClases(dateStr);
          // Crear un mapa de matricula_id -> estado para búsqueda rápida
          const estadosMap: Record<number, any> = {};
          estados.forEach((e: any) => {
            estadosMap[e.matricula_id] = { avisado: e.avisado, confirmado: e.confirmado };
          });
          // Actualizar sesiones con estados reales del backend
          sesionesmes[dateStr].forEach((sesion: SesionDelDia) => {
            if (estadosMap[sesion.matricula_id]) {
              sesion.avisado = estadosMap[sesion.matricula_id].avisado || false;
              sesion.confirmado = estadosMap[sesion.matricula_id].confirmado || false;
            }
          });
        } catch (e) {
          console.warn(`No se pudieron cargar estados para ${dateStr}:`, e);
        }
      }
      
      setSesionesDelMes(sesionesmes);
      // Sincronizar sesiones del día seleccionado con el cálculo mensual (incluye hoy)
      if (selectedDate) {
        setSesionesDelDia(sesionesmes[selectedDate] || []);
      }

      // Resúmenes
      const [rt, rc] = await Promise.all([
        api.dashboard.getResumenTutoresEstudiantes().catch(() => []),
        api.dashboard.getResumenCursosGrupos().catch(() => [])
      ]);
      setResumenTutores(rt);
      setResumenCursos(rc);
    } catch (err) {
      console.error('Error en dashboard:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedDate, hoy, metricMes]);

  const maxAbsSerie = (() => {
    const s = metricas?.series || [];
    let max = 0;
    for (const it of s) {
      const a = Math.max(Math.abs(Number(it.ingresos) || 0), Math.abs(Number(it.egresos) || 0), Math.abs(Number(it.neto) || 0));
      if (a > max) max = a;
    }
    return max || 1;
  })();

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000); // Actualizar cada 30 segundos
    const onFocus = () => fetchData();
    window.addEventListener('focus', onFocus);
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
    };
  }, [fetchData]);

  const marcarSesionComoDada = useCallback(async (sesion: SesionDelDia) => {
    const sesionKey = getSesionKey(sesion);
    setCompletandoKeys(prev => ({ ...prev, [sesionKey]: true }));
    try {
      const hoyStr = new Date().toISOString().split('T')[0];
      // IMPORTANTE: usar la fecha "hoy" en zona Costa Rica para que coincida con la agenda.
      // El hoyStr basado en UTC puede caer en el día anterior/siguiente cerca de medianoche.
      const fechaToUse = sesion?.fecha || hoy || hoyStr;
      const result = await api.dashboard.completarSesion(sesion.matricula_id, fechaToUse);

      // Remover de la lista de hoy inmediatamente (experiencia UX)
      setSesionesHoy(prev => prev.filter((s) => getSesionKey(s) !== sesionKey));
      setUiNotice({
        type: 'success',
        message: result?.message || 'Clase marcada como dada.'
      });

      // Sincronizar stats/agenda
      await fetchData();
    } catch (e: any) {
      console.error(e);
      setUiNotice({ type: 'error', message: e?.response?.data?.error || e?.message || 'Error marcando la clase como dada' });
    } finally {
      setCompletandoKeys(prev => {
        const next = { ...prev };
        delete next[sesionKey];
        return next;
      });
    }
  }, [api.dashboard, fetchData, getSesionKey, hoy]);

  const StatCard = ({ title, value, icon, accentColor }: any) => (
    <Card className="relative overflow-hidden hover:-translate-y-1 transition-all cursor-default border-white/10">
      <div className="absolute top-0 right-0 w-28 h-28 bg-[#00AEEF] opacity-10 rounded-bl-full blur-2xl" />
      <CardHeader className="flex flex-row items-start justify-between pb-2 border-none">
        <div>
          <CardDescription className="font-bold text-slate-400 tracking-wider uppercase text-[11px]">{title}</CardDescription>
          <div className="text-4xl font-black text-white leading-tight mt-2">{value}</div>
        </div>
        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${accentColor}`}>
          {icon}
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="mt-3 flex items-center gap-2 text-xs font-semibold text-slate-400 tracking-widest">
          <TrendingUp className="w-3 h-3 text-emerald-400" />
          En tiempo real
        </div>
      </CardContent>
    </Card>
  );

  if (loading && !stats) return (
    <div className="flex flex-col items-center justify-center h-[50vh] space-y-6">
      <div className="w-12 h-12 border-4 border-slate-200 border-t-blue-600 rounded-full animate-spin" />
      <p className="text-sm font-semibold text-slate-500">Actualizando datos...</p>
    </div>
  );

  return (
    <div className="flex gap-6">
      {/* Contenido principal - 70% */}
      <div className="flex-1 space-y-10">
        {uiNotice && (
          <div className={`rounded-2xl border px-4 py-3 text-sm font-semibold flex items-start justify-between gap-4 ${
            uiNotice.type === 'success'
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-100'
              : uiNotice.type === 'error'
              ? 'border-red-500/30 bg-red-500/10 text-red-100'
              : 'border-white/10 bg-white/5 text-slate-200'
          }`}>
            <div>{uiNotice.message}</div>
            <button
              className="text-slate-300 hover:text-white transition-colors"
              onClick={() => setUiNotice(null)}
              aria-label="Cerrar aviso"
              title="Cerrar"
            >
              ✕
            </button>
          </div>
        )}

        <Dialog
          isOpen={!!confirmMarcarDada}
          onClose={() => setConfirmMarcarDada(null)}
          title="Confirmar: marcar clase como dada"
          maxWidthClass="max-w-xl"
        >
          <div className="space-y-4">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="text-sm font-black text-white">{confirmMarcarDada?.sesion.curso_nombre}</div>
              <div className="text-xs text-slate-300 mt-1">{confirmMarcarDada?.sesion.estudiante_nombre}</div>
              <div className="text-xs text-slate-400 mt-1">{confirmMarcarDada?.sesion.hora_inicio} - {confirmMarcarDada?.sesion.hora_fin}</div>
            </div>

            <div className="text-sm text-slate-200">
              Al confirmar, la clase se marcará como <span className="font-bold">DADA</span>, se quitará de “Sesiones de Hoy” y se actualizarán los movimientos/pagos según el tipo de pago del curso.
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <Button variant="outline" className="h-11" onClick={() => setConfirmMarcarDada(null)}>
                Volver
              </Button>
              <Button
                className="h-11 bg-emerald-600 hover:bg-emerald-700 text-white"
                onClick={async () => {
                  if (!confirmMarcarDada) return;
                  const sesion = confirmMarcarDada.sesion;
                  setConfirmMarcarDada(null);
                  await marcarSesionComoDada(sesion);
                }}
              >
                Confirmar
              </Button>
            </div>
          </div>
        </Dialog>

        <Dialog
          isOpen={!!confirmCancelarHoy}
          onClose={() => setConfirmCancelarHoy(null)}
          title="Confirmar: cancelar solo por hoy"
          maxWidthClass="max-w-xl"
        >
          <div className="space-y-4">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="text-sm font-black text-white">{confirmCancelarHoy?.sesion.curso_nombre}</div>
              <div className="text-xs text-slate-300 mt-1">{confirmCancelarHoy?.sesion.estudiante_nombre}</div>
              <div className="text-xs text-slate-400 mt-1">{confirmCancelarHoy?.sesion.hora_inicio} - {confirmCancelarHoy?.sesion.hora_fin}</div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="text-xs font-bold text-slate-300 uppercase tracking-widest">Motivo</div>
              <Input
                value={confirmCancelarHoy?.motivo ?? ''}
                onChange={(e) => {
                  const value = e.target.value;
                  setConfirmCancelarHoy((prev) => (prev ? { ...prev, motivo: value } : prev));
                }}
                placeholder="Escribe el motivo de la cancelación por hoy..."
                className="mt-3 bg-white/5 border-white/10 text-white placeholder:text-slate-400"
              />
              <div className="text-[11px] text-slate-400 mt-2">Este motivo es para tu control (no bloquea la cancelación).</div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <Button variant="outline" className="h-11" onClick={() => setConfirmCancelarHoy(null)}>
                Volver
              </Button>
              <Button
                variant="destructive"
                className="h-11"
                onClick={async () => {
                  if (!confirmCancelarHoy) return;
                  const sesion = confirmCancelarHoy.sesion;
                  const hoyStr = new Date().toISOString().split('T')[0];
                  const motivo = (confirmCancelarHoy.motivo || '').trim();
                  if (!motivo) {
                    setUiNotice({ type: 'error', message: 'Escribe un motivo antes de cancelar.' });
                    return;
                  }
                  setConfirmCancelarHoy(null);
                  try {
                    await api.dashboard.cancelarSesionDia(sesion.matricula_id, hoyStr);
                    console.log('Motivo cancelación (UI):', motivo);
                    setUiNotice({ type: 'success', message: 'Clase cancelada (solo por hoy).' });
                    await fetchData();
                  } catch (e: any) {
                    console.error(e);
                    setUiNotice({ type: 'error', message: e?.response?.data?.error || e?.message || 'Error cancelando la clase' });
                  }
                }}
              >
                Confirmar cancelación
              </Button>
            </div>
          </div>
        </Dialog>

        {/* Sesiones Hoy (arriba del calendario) */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-black text-white tracking-tight flex items-center gap-3">
              <CalendarIcon className="w-6 h-6 text-emerald-600" />
              Sesiones de Hoy
            </h2>
            <span className="text-xs text-slate-400">{hoy ? new Date(hoy + 'T00:00:00').toLocaleDateString('es-CR') : '—'}</span>
          </div>
          <Card className="border-white/10 bg-[#0F2445]">
            <CardContent className="pt-4">
              {sesionesHoy.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-6">
                  <Clock className="w-8 h-8 mb-2 text-slate-500" />
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest text-center">Sin sesiones hoy</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {sesionesHoy.map((sesion, index) => {
                    const ahora = new Date();
                    const [hIni, mIni] = String(sesion.hora_inicio).split(':').map(Number);
                    const [hFin, mFin] = String(sesion.hora_fin).split(':').map(Number);
                    const finDate = new Date(); finDate.setHours(hFin || 0, mFin || 0, 0, 0);
                    const puedeMarcarDada = isFinite(hIni) && isFinite(mIni) && ahora >= finDate;
                    const hoyStr = new Date().toISOString().split('T')[0];
                    const sesionKey = getSesionKey(sesion);
                    const isCompleting = !!completandoKeys[sesionKey];
                    return (
                      <div key={`hoy-top-${sesion.matricula_id}-${index}`} className="p-3 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition-all group">
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="flex-1">
                            <p className="text-sm font-bold text-white group-hover:text-[#00AEEF] transition-colors">{sesion.curso_nombre}</p>
                            <p className="text-xs text-slate-400 mt-0.5">{sesion.hora_inicio} - {sesion.hora_fin}</p>
                          </div>
                          <button onClick={() => abrirProgramacion(sesion, 'info')} className="text-[#00AEEF] hover:text-white transition-colors p-1 rounded hover:bg-white/10 flex-shrink-0" title="Ver detalles">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                          </button>
                        </div>
                        <p className="text-xs text-slate-300 mb-2">{sesion.estudiante_nombre}</p>
                        <div className="flex items-center gap-1.5 mb-2">
                          <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${
                            sesion.confirmado ? 'bg-emerald-400/20 text-emerald-300' : 
                            sesion.avisado ? 'bg-amber-400/20 text-amber-300' : 
                            'bg-slate-600/30 text-slate-400'
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${
                              sesion.confirmado ? 'bg-emerald-400' : 
                              sesion.avisado ? 'bg-amber-400' : 
                              'bg-slate-500'
                            }`} />
                            {sesion.confirmado ? 'Confirmada' : sesion.avisado ? 'En espera' : 'Programada'}
                          </span>
                        </div>
                        <div className="flex gap-1.5 justify-end flex-wrap">
                          <Button
                            size="sm"
                            className={`text-[10px] px-2 py-0.5 h-7 ${puedeMarcarDada ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : 'bg-white/10 text-slate-400 border border-white/10'}`}
                            disabled={!puedeMarcarDada || isCompleting}
                            onClick={async () => {
                              setConfirmMarcarDada({ sesion, sesionKey });
                            }}
                          >
                            {isCompleting ? 'Marcando...' : 'Marcar dada'}
                          </Button>
                          <Button
                            size="sm"
                            className="text-[10px] px-2 py-0.5 h-7 bg-white/10 border border-white/15 hover:bg-white/15"
                            onClick={() => abrirProgramacion(sesion, 'programar')}
                          >
                            Programar
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            className="text-[10px] px-2 py-0.5 h-7"
                            onClick={async () => {
                              // Confirmación UI (motivo dentro del Dialog)
                              setConfirmCancelarHoy({ sesion, sesionKey, motivo: '' });
                            }}
                          >
                            Cancelar hoy
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </section>

        {/* Calendario Mensual */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-black text-white tracking-tight flex items-center gap-3">
              <CalendarIcon className="w-6 h-6 text-[#00AEEF]" />
              Calendario de Clases
            </h2>
          </div>

          <Card className="border-white/10 bg-[#0F2445]">
            <CardContent className="p-6">
              {(() => {
                const today = new Date(hoy + 'T00:00:00');
                const year = today.getFullYear();
                const month = today.getMonth();
                const firstDay = new Date(year, month, 1);
                const lastDay = new Date(year, month + 1, 0);
                const daysInMonth = lastDay.getDate();
                const startDay = firstDay.getDay(); // 0 = Domingo

                const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
                const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

                const days: (number | null)[] = [];
                for (let i = 0; i < startDay; i++) days.push(null);
                for (let d = 1; d <= daysInMonth; d++) days.push(d);

                return (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xl font-black text-white">{monthNames[month]} {year}</h3>
                    </div>
                    <div className="grid grid-cols-7 gap-2">
                      {dayNames.map(day => (
                        <div key={day} className="text-center text-xs font-bold text-slate-400 uppercase tracking-widest py-2">
                          {day}
                        </div>
                      ))}
                      {days.map((day, index) => {
                        if (!day) return <div key={`empty-${index}`} className="min-h-28" />;
                        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                        const isToday = dateStr === hoy;
                        const isSelected = selectedDate === dateStr;
                        const sesionesEnDia = sesionesDelMes[dateStr] || [];
                        const hasClasses = sesionesEnDia.length > 0;
                        const diaSemana = getDiaSemana(dateStr);
                        const diaCorto = diaSemana.slice(0, 3);
                        
                        return (
                          <button
                            key={day}
                            onClick={() => {
                              setSelectedDate(dateStr);
                              setSesionesDelDia(sesionesEnDia);
                              setShowDayDetail(true);
                            }}
                            className={`min-h-28 rounded-lg border transition-all relative group flex flex-col p-2 overflow-hidden ${
                              isToday
                                ? 'bg-gradient-to-br from-[#00AEEF]/20 to-[#00AEEF]/10 border-[#00AEEF] shadow-lg shadow-[#00AEEF]/20'
                                : isSelected
                                ? 'bg-gradient-to-br from-[#FFC800]/20 to-[#FFC800]/10 border-[#FFC800] shadow-lg shadow-[#FFC800]/20'
                                : hasClasses
                                ? 'bg-white/5 border-white/20 hover:bg-white/10 hover:border-[#00AEEF]/50'
                                : 'bg-transparent border-white/5 text-slate-600'
                            } text-sm`}
                          >
                            <div className="flex items-center justify-between mb-1.5">
                              <span className={`text-sm font-black ${
                                isToday ? 'text-[#00AEEF]' : isSelected ? 'text-[#FFC800]' : 'text-white'
                              }`}>
                                {day}
                              </span>
                              {hasClasses && (
                                <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${
                                  isToday ? 'bg-[#00AEEF]/30 text-[#00AEEF]' : isSelected ? 'bg-[#FFC800]/30 text-[#FFC800]' : 'bg-emerald-500/30 text-emerald-300'
                                }`}>
                                  {sesionesEnDia.length}
                                </span>
                              )}
                            </div>
                            
                            {hasClasses && (
                              <div className="flex-1 flex flex-col gap-1 overflow-hidden">
                                {sesionesEnDia.slice(0, 2).map((sesion, idx) => (
                                  <div key={idx} className="text-[10px] leading-tight">
                                    <p className={`font-bold truncate ${
                                      isToday ? 'text-[#00AEEF]' : isSelected ? 'text-[#FFC800]' : 'text-emerald-300'
                                    }`}>
                                      {sesion.curso_nombre}
                                    </p>
                                    <p className={`text-[9px] ${
                                      isToday ? 'text-[#00AEEF]/70' : isSelected ? 'text-[#FFC800]/70' : 'text-slate-400'
                                    }`}>
                                      {sesion.hora_inicio}
                                    </p>
                                  </div>
                                ))}
                                {sesionesEnDia.length > 2 && (
                                  <p className={`text-[9px] font-semibold ${
                                    isToday ? 'text-[#00AEEF]/60' : isSelected ? 'text-[#FFC800]/60' : 'text-slate-500'
                                  }`}>
                                    +{sesionesEnDia.length - 2} más
                                  </p>
                                )}
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
            </CardContent>
          </Card>
        </section>

        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-8">
          <div>
            <h1 className="text-4xl font-black text-[#FFC800] tracking-tight leading-none">
              Resumen General
            </h1>
            <p className="text-slate-500 text-sm mt-3 font-medium flex items-center gap-2">
              <Activity className="w-4 h-4" style={{color: '#00AEEF'}} />
              Estado actual de Linguistika Academy
            </p>
          </div>
          <div className="flex items-center gap-4">
            <Button
              variant="primary"
              className="h-11 px-6 bg-[#00AEEF] hover:bg-[#00AEEF]/80 text-[#051026] font-bold"
              onClick={fetchData}
              disabled={loading}
            >
              Actualizar Datos
            </Button>
            <div className="flex items-center gap-3 bg-gradient-to-r from-yellow-50 to-cyan-50 p-3 rounded-2xl border border-cyan-200 shadow-sm">
              <div className="flex flex-col items-end px-2">
                <span className="text-xs font-black text-cyan-700 uppercase tracking-widest">Estado</span>
                <span className="text-sm font-bold text-cyan-900">OPERATIVO</span>
              </div>
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-yellow-400 to-cyan-500 flex items-center justify-center text-white shadow-lg">
                <Star className="w-5 h-5 fill-current" />
              </div>
            </div>
          </div>
        </header>

        {/* Métricas financieras (solo admin/contador) */}
        {!metricasDenied ? (
          <Card className="border-white/10 bg-[#0F2445]">
            <CardHeader className="border-b border-white/10">
              <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
                <div>
                  <CardTitle className="text-white flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-[#00AEEF]" /> Métricas (Tesorería)
                  </CardTitle>
                  <CardDescription className="text-slate-400 text-xs mt-1">
                    Resumen mensual basado en movimientos. Fuente: {metricas?.fuente || '—'}
                  </CardDescription>
                </div>
                <div className="flex items-end gap-3">
                  <div>
                    <div className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Mes</div>
                    <Input
                      type="month"
                      value={metricMes}
                      onChange={(e) => setMetricMes(String(e.target.value || '').slice(0, 7))}
                      className="h-11 w-44"
                    />
                  </div>
                  <Button type="button" variant="outline" className="h-11" onClick={fetchData} disabled={loading}>
                    {loading ? 'Cargando...' : 'Refrescar'}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-6 space-y-5">
              {!metricas ? (
                <div className="text-sm text-slate-400">No hay datos (o todavía no cargan).</div>
              ) : (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-4">
                      <div className="text-[11px] font-black text-emerald-200 uppercase tracking-widest">Ingresos</div>
                      <div className="text-2xl font-black text-white mt-1">{formatCRC(metricas.ingresos || 0)}</div>
                      <div className="text-xs text-emerald-200/80 mt-1">{metricas.fecha_inicio} a {metricas.fecha_fin}</div>
                    </div>
                    <div className="rounded-2xl border border-rose-400/20 bg-rose-500/10 p-4">
                      <div className="text-[11px] font-black text-rose-200 uppercase tracking-widest">Pagos a tutores</div>
                      <div className="text-2xl font-black text-white mt-1">{formatCRC(metricas.pagos_tutores || 0)}</div>
                      <div className="text-xs text-rose-200/80 mt-1">Movimientos: {metricas.movimientos || 0}</div>
                    </div>
                    <div className="rounded-2xl border border-cyan-400/20 bg-cyan-500/10 p-4">
                      <div className="text-[11px] font-black text-cyan-200 uppercase tracking-widest">Neto (en bolsa)</div>
                      <div className="text-2xl font-black text-white mt-1">{formatCRC(metricas.neto || 0)}</div>
                      <div className="text-xs text-cyan-200/80 mt-1">Neto = ingresos - pagos</div>
                    </div>
                  </div>

                  {/* Serie simple últimos 6 meses */}
                  {Array.isArray(metricas.series) && metricas.series.length > 0 ? (
                    <div className="rounded-2xl border border-white/10 bg-black/10 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-sm font-black text-white">Últimos 6 meses</div>
                        <div className="text-[11px] text-slate-400 font-bold uppercase tracking-widest">Ingresos vs Pagos</div>
                      </div>
                      <div className="mt-4 grid grid-cols-6 gap-2 items-end">
                        {metricas.series.map((it) => {
                          const ing = Number(it.ingresos) || 0;
                          const egr = Number(it.egresos) || 0;
                          const hIng = Math.max(2, Math.round((Math.abs(ing) / maxAbsSerie) * 80));
                          const hEgr = Math.max(2, Math.round((Math.abs(egr) / maxAbsSerie) * 80));
                          return (
                            <div key={it.mes} className="flex flex-col items-center gap-2">
                              <div className="w-full flex items-end justify-center gap-1 h-[90px]">
                                <div className="w-4 rounded-md bg-emerald-400/70 border border-emerald-400/30" style={{ height: `${hIng}px` }} title={`Ingresos: ${formatCRC(ing)}`} />
                                <div className="w-4 rounded-md bg-rose-400/70 border border-rose-400/30" style={{ height: `${hEgr}px` }} title={`Pagos: ${formatCRC(egr)}`} />
                              </div>
                              <div className="text-[10px] text-slate-400 font-black tracking-widest">{it.mes}</div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}

                  {/* Top tutores por pagos */}
                  {Array.isArray(metricas.top_tutores) && metricas.top_tutores.length > 0 ? (
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                      <div className="text-sm font-black text-white">Top pagos a tutores</div>
                      <div className="mt-3 space-y-2">
                        {metricas.top_tutores.map((t) => (
                          <div key={t.tutor_id} className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/10 px-3 py-2">
                            <div className="text-sm text-slate-200 font-bold truncate">{t.tutor_nombre || `Tutor #${t.tutor_id}`}</div>
                            <div className="text-sm font-black text-rose-200">{formatCRC(t.total || 0)}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </>
              )}
            </CardContent>
          </Card>
        ) : null}

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          <StatCard 
            title="Tutores Activos" 
            value={stats?.tutores_activos || 0} 
            icon={<Users className="w-5 h-5" style={{color: '#051026'}} />} 
            accentColor="bg-[#FFC800] text-[#051026]"
          />
          <StatCard 
            title="Estudiantes" 
            value={stats?.estudiantes_activos || 0} 
            icon={<GraduationCap className="w-5 h-5" style={{color: '#051026'}} />} 
            accentColor="bg-[#00AEEF] text-[#051026]"
          />
          <StatCard 
            title="Cursos" 
            value={stats?.cursos_activos || 0} 
            icon={<BookOpen className="w-5 h-5" style={{color: '#051026'}} />} 
            accentColor="bg-[#FFC800] text-[#051026]"
          />
          <StatCard 
            title="Matrículas" 
            value={stats?.matriculas_activas || 0} 
            icon={<ClipboardList className="w-5 h-5" style={{color: '#051026'}} />} 
            accentColor="bg-[#00AEEF] text-[#051026]"
          />
          <StatCard 
            title="Sesiones Totales" 
            value={stats?.total_clases || 0} 
            icon={<Award className="w-5 h-5" style={{color: '#051026'}} />} 
            accentColor="bg-[#FFC800] text-[#051026]"
          />
          <StatCard 
            title="Ingresos Pendientes" 
            value={formatCRC(stats?.ingresos_pendientes ?? 0)} 
            icon={<CreditCard className="w-5 h-5" style={{color: '#051026'}} />} 
            accentColor="bg-[#00AEEF] text-[#051026]"
          />
        </div>
      </div>

      {/* Sidebar derecha - 30% */}
      <aside className="w-[30%] space-y-6 sticky top-24 self-start">
        {/* Detalle del Día Seleccionado */}
        {showDayDetail && selectedDate !== hoy && (
          <Card className="border-white/10 bg-[#0F2445]">
            <CardHeader className="border-b border-white/10">
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-white text-base">
                    {new Date(selectedDate + 'T00:00:00').toLocaleDateString('es-CR', {
                      weekday: 'long',
                      day: 'numeric',
                      month: 'long'
                    })}
                  </CardTitle>
                  <CardDescription className="text-slate-400 mt-1 text-xs">
                    {sesionesDelDia.length} sesión(es) programada(s)
                  </CardDescription>
                </div>
                <button 
                  onClick={() => setShowDayDetail(false)}
                  className="text-slate-400 hover:text-white transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </CardHeader>
            <CardContent className="pt-4">
              {sesionesDelDia.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-6 text-center">
                  <Clock className="w-8 h-8 mb-2 text-slate-500" />
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Sin sesiones</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                  {sesionesDelDia.map((sesion, index) => (
                    <div key={`detail-${sesion.matricula_id}-${index}`} className="w-full p-3 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition-all">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div>
                          <p className="text-sm font-bold text-white">{sesion.curso_nombre}</p>
                          <p className="text-xs text-[#00AEEF] font-semibold mt-0.5">{sesion.hora_inicio} - {sesion.hora_fin}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold text-[#FFC800] bg-[#FFC800]/20 px-2 py-1 rounded-full border border-[#FFC800]/30 flex-shrink-0">
                            {sesion.turno}
                          </span>
                          <button onClick={() => cargarDetalleMatricula(sesion.matricula_id)} className="text-[#00AEEF] hover:text-white transition-colors p-1 rounded hover:bg-white/10" title="Ver detalles">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                          </button>
                        </div>
                      </div>
                      <div className="text-xs text-slate-300 space-y-1">
                        <p className="truncate"><span className="font-semibold text-slate-200">{sesion.estudiante_nombre}</span></p>
                        <p className="text-slate-500 text-[11px]">Docente: {sesion.tutor_nombre}</p>
                        <div className="flex items-center gap-2 text-[11px]">
                          <span className={`px-2 py-0.5 rounded-full border text-[10px] ${sesion.avisado ? 'border-emerald-400 text-emerald-300 bg-emerald-400/10' : 'border-slate-500 text-slate-400 bg-slate-700/30'}`}>
                            {sesion.avisado ? 'Avisado' : 'Aviso pendiente'}
                          </span>
                          <span className={`px-2 py-0.5 rounded-full border text-[10px] ${sesion.confirmado ? 'border-emerald-400 text-emerald-300 bg-emerald-400/10' : 'border-amber-400 text-amber-200 bg-amber-400/10'}`}>
                            {sesion.confirmado ? 'Confirmado' : 'Confirmar'}
                          </span>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2 mt-3 text-[11px]">
                        <Button
                          size="sm"
                          className="h-7 text-[11px] px-2 bg-white/10 border border-white/15 hover:bg-white/15"
                          onClick={() => console.log('Ir al chat con tutor', sesion.tutor_id || sesion.tutor_nombre)}
                        >
                          Chat tutor
                        </Button>
                        <Button
                          size="sm"
                          className="h-7 text-[11px] px-2 bg-white/10 border border-white/15 hover:bg-white/15"
                          onClick={() => console.log('Ir al chat con encargados', sesion.estudiante_id || sesion.estudiante_nombre)}
                        >
                          Chat encargados
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {programacionSesion && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[120] p-4">
            <Card className="bg-[#0F2445] border border-white/10 w-full max-w-lg rounded-2xl shadow-2xl">
              <div className="flex items-start justify-between p-5 border-b border-white/10">
                <div>
                  <CardTitle className="text-white text-base">{programacionSesion.sesion.curso_nombre}</CardTitle>
                  <p className="text-xs text-slate-400 mt-1">{programacionSesion.sesion.hora_inicio} - {programacionSesion.sesion.hora_fin}</p>
                </div>
                <button onClick={cerrarProgramacion} className="text-slate-400 hover:text-white transition-colors p-1 rounded hover:bg-white/10">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>

              <div className="p-5 space-y-4 max-h-[60vh] overflow-y-auto text-slate-100">
                <div className="space-y-1">
                  <p className="text-sm font-semibold">{programacionSesion.sesion.estudiante_nombre}</p>
                  <p className="text-[11px] text-slate-400">Docente: {programacionSesion.sesion.tutor_nombre}</p>
                  <div className="flex items-center gap-2 text-[11px]">
                    <span className={`px-2 py-0.5 rounded-full border ${programacionSesion.sesion.avisado ? 'border-amber-300 text-amber-200 bg-amber-300/10' : 'border-slate-500 text-slate-400 bg-slate-700/30'}`}>
                      {programacionSesion.sesion.avisado ? 'Avisado' : 'Aviso pendiente'}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full border ${programacionSesion.sesion.confirmado ? 'border-emerald-400 text-emerald-300 bg-emerald-400/10' : 'border-slate-500 text-slate-400 bg-slate-700/30'}`}>
                      {programacionSesion.sesion.confirmado ? 'Confirmado' : 'En espera'}
                    </span>
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-white/5 border border-white/10 space-y-2">
                  <p className="text-[11px] text-slate-400 font-semibold">Mensaje para WhatsApp</p>
                  <textarea
                    className="w-full text-sm bg-transparent border border-white/10 rounded-lg p-2 text-slate-100"
                    rows={3}
                    value={mensajeWA}
                    onChange={(e) => setMensajeWA(e.target.value)}
                  />
                  <div className="flex gap-2 text-[11px]">
                    <Button
                      size="sm"
                      className="h-8 px-3 text-[11px] bg-white/10 border border-white/15 hover:bg-white/15"
                      onClick={async () => {
                        const waUrl = `https://wa.me/[telefono]?text=${encodeURIComponent(mensajeWA)}`;
                        window.open(waUrl, '_blank');
                      }}
                    >
                      Abrir WhatsApp
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 px-3 text-[11px] bg-white/5 border-white/15 hover:bg-white/10"
                      onClick={async () => {
                        if (navigator?.clipboard?.writeText) {
                          await navigator.clipboard.writeText(mensajeWA);
                          alert('Mensaje copiado');
                        }
                      }}
                    >
                      Copiar mensaje
                    </Button>
                  </div>
                </div>

                {programacionSesion.modo === 'programar' && (
                  <div className="space-y-2">
                    <p className="text-[11px] text-slate-400 font-semibold">Estado</p>
                    <div className="flex flex-wrap gap-2">
                      <Button 
                        size="sm" 
                        className="h-8 text-[11px] px-3 bg-white/10 border-white/15 hover:bg-white/20"
                        onClick={() => cambiarEstadoSesion(programacionSesion.sesion, true, false)}
                      >
                        Programada
                      </Button>
                      <Button 
                        size="sm" 
                        className="h-8 text-[11px] px-3 bg-white/10 border-white/15 hover:bg-white/20"
                        onClick={() => cambiarEstadoSesion(programacionSesion.sesion, true, false)}
                      >
                        En espera
                      </Button>
                      <Button 
                        size="sm" 
                        className="h-8 text-[11px] px-3 bg-emerald-600 hover:bg-emerald-700 text-white"
                        onClick={() => cambiarEstadoSesion(programacionSesion.sesion, true, true)}
                      >
                        Confirmada
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              <div className="p-5 border-t border-white/10 flex justify-end">
                <Button
                  variant="outline"
                  className="text-xs h-8 bg-white/5 border-white/10 hover:bg-white/10 text-white"
                  onClick={cerrarProgramacion}
                >
                  Cerrar
                </Button>
              </div>
            </Card>
          </div>
        )}

        {/* Resumen del curso seleccionado (pantalla completa) */}
        {detalleMatricula && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            <Card className="bg-[#0F2445] border border-white/10 w-full max-w-md rounded-2xl shadow-2xl">
              <div className="flex items-start justify-between p-5 border-b border-white/10">
                <div>
                  <CardTitle className="text-base font-bold text-white">{detalleMatricula.curso_nombre}</CardTitle>
                  <p className="text-xs text-slate-400 mt-1">Docente: {detalleMatricula.tutor_nombre}</p>
                </div>
                <button onClick={() => setDetalleMatricula(null)} className="text-slate-400 hover:text-white transition-colors p-1 rounded hover:bg-white/10">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
              
              <div className="p-5 space-y-3 max-h-[55vh] overflow-y-auto">
                <div className="grid grid-cols-2 gap-2">
                  <div className="p-2.5 rounded-lg bg-white/5 border border-white/10">
                    <p className="text-[10px] text-slate-400 mb-0.5">Tipo</p>
                    <p className="text-xs font-semibold text-white">{detalleMatricula.tipo_inscripcion || '-'}</p>
                  </div>
                  <div className="p-2.5 rounded-lg bg-white/5 border border-white/10">
                    <p className="text-[10px] text-slate-400 mb-0.5">Grupo</p>
                    <p className="text-xs font-semibold text-white">{detalleMatricula.grupo || 'Sin grupo'}</p>
                  </div>
                </div>

                {Array.isArray(detalleMatricula.students) && detalleMatricula.students.length > 0 && (
                  <div>
                    <p className="text-[10px] text-slate-400 mb-1.5 font-semibold">Alumnos ({detalleMatricula.students.length})</p>
                    <div className="space-y-1">
                      {detalleMatricula.students.slice(0, 4).map((al: any) => (
                        <div key={al.id || al.nombre} className="p-1.5 rounded-lg bg-white/5 border border-white/10">
                          <p className="text-[10px] font-semibold text-white">{al.nombre}</p>
                        </div>
                      ))}
                      {detalleMatricula.students.length > 4 && (
                        <p className="text-[10px] text-slate-400 mt-1">+{detalleMatricula.students.length - 4} más</p>
                      )}
                    </div>
                  </div>
                )}

                <div>
                  <p className="text-[10px] text-slate-400 mb-1.5 font-semibold">Horarios</p>
                  <div className="flex flex-wrap gap-1">
                    {renderHorarioBadges(detalleMatricula)}
                  </div>
                </div>

                {(detalleMatricula.curso_costo_curso || detalleMatricula.curso_pago_tutor) && (
                  <div className="space-y-1.5 pt-1">
                    <p className="text-[10px] text-slate-400 font-semibold">Costos</p>
                    <div className="grid grid-cols-2 gap-2">
                      {detalleMatricula.curso_costo_curso && (
                        <div className="p-2 rounded-lg bg-white/5 border border-white/10">
                          <p className="text-[10px] text-slate-400">Curso</p>
                          <p className="text-xs font-bold text-[#FFC800]">₡{(detalleMatricula.curso_costo_curso || 0).toLocaleString()}</p>
                        </div>
                      )}
                      {detalleMatricula.curso_pago_tutor && (
                        <div className="p-2 rounded-lg bg-white/5 border border-white/10">
                          <p className="text-[10px] text-slate-400">Tutor</p>
                          <p className="text-xs font-bold text-[#00AEEF]">₡{(detalleMatricula.curso_pago_tutor || 0).toLocaleString()}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="p-5 border-t border-white/10">
                <Button
                  variant="outline"
                  className="w-full text-xs h-7 bg-white/5 border-white/10 hover:bg-white/10 text-white"
                  onClick={() => setDetalleMatricula(null)}
                >
                  Cerrar
                </Button>
              </div>
            </Card>
          </div>
        )}

        {/* Estudiantes por Tutor */}
        <Card className="border-slate-200">
          <CardHeader>
            <CardTitle className="text-lg">Alumnos por Tutor</CardTitle>
            <CardDescription className="text-xs">Conteo de estudiantes activos por docente</CardDescription>
          </CardHeader>
          <CardContent>
            {resumenTutores.length === 0 ? (
              <div className="text-xs text-slate-400 font-bold uppercase tracking-widest py-6 text-center">Sin datos</div>
            ) : (
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {resumenTutores.map((r) => (
                  <button onClick={() => cargarAlumnosTutor(r.tutor_id, r.tutor_nombre)} key={r.tutor_id} className="w-full flex items-center justify-between p-2.5 rounded-xl border border-white/10 hover:border-[#00AEEF]/30 hover:bg-white/5 transition-all">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-white/10 border border-white/10 flex items-center justify-center text-white font-bold text-xs">
                        {r.tutor_nombre.charAt(0)}
                      </div>
                      <span className="font-semibold text-slate-200 text-sm">{r.tutor_nombre}</span>
                    </div>
                    <span className="text-[11px] font-bold text-[#FFC800] bg-[#FFC800]/15 px-2.5 py-1 rounded-full border border-[#FFC800]/30">
                      {r.total_estudiantes}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {tutorSeleccionado && (
          <Card className="border-white/10 bg-[#0F2445]">
            <CardHeader className="border-b border-white/10">
              <div className="flex justify-between items-start">
                <CardTitle className="text-white text-base">Alumnos de {tutorSeleccionado.nombre}</CardTitle>
                <button onClick={() => { setTutorSeleccionado(null); setAlumnosTutor([]); }} className="text-slate-400 hover:text-white transition-colors">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </CardHeader>
            <CardContent className="pt-4">
              {alumnosTutor.length === 0 ? (
                <div className="text-xs text-slate-400">Sin alumnos asociados</div>
              ) : (
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {alumnosTutor.map((al) => (
                    <div key={al.id} className="flex items-center gap-2 p-2 rounded-lg border border-white/10 bg-white/5">
                      <div className="w-8 h-8 rounded-full bg-white/10 border border-white/10 flex items-center justify-center text-white font-bold text-xs">
                        {al.nombre.charAt(0)}
                      </div>
                      <span className="font-semibold text-slate-100">{al.nombre}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

      </aside>
    </div>
  );
};

export default Dashboard;
