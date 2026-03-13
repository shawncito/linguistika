// Dashboard con calendario interactivo mejorado
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { authService } from '../services/api/authService';
import { dashboardService } from '../services/api/dashboardService';
import { matriculasService } from '../services/api/matriculasService';
import { tutoresService } from '../services/api/tutoresService';
import { estudiantesService } from '../services/api/estudiantesService';
import { useRealtimeSubscription } from '../hooks/useRealtimeSubscription';
import { Matricula, Curso, Tutor, Estudiante, ResumenTutorEstudiantes, ResumenCursoGrupos } from '../types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, Badge, Input, Button, Dialog } from '../components/UI';
import { formatCRC } from '../lib/format';
import {
  Users, BookOpen, GraduationCap,
  ClipboardList, Clock, CreditCard,
  User as UserIcon, Calendar as CalendarIcon,
  TrendingUp, Award, ChevronRight, ChevronLeft, Activity, Star,
  Plus, Minus, AlertTriangle, Download
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import jsPDF from 'jspdf';

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
  curso_tipo_pago?: string | null;
  tutor_id?: number;
  estudiante_id?: number;
  curso_id?: number;
  avisado?: boolean;
  confirmado?: boolean;
  fecha?: string;
  estado_sesion?: 'dada' | 'cancelada' | null;
  fecha_inscripcion?: string | null;
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
  series_esperado?: Array<{ mes: string; ingresos: number; egresos: number; neto: number }>;
  series_real?: Array<{ mes: string; ingresos: number; egresos: number; neto: number }>;
  top_tutores?: Array<{ tutor_id: number; tutor_nombre: string; total: number }>;
  top_tutores_real?: Array<{ tutor_id: number; tutor_nombre: string; total: number }>;
  esperado?: { ingresos: number; pagos_tutores: number; neto: number; movimientos: number };
  real?: { ingresos: number; pagos_tutores: number; neto: number; movimientos: number };
  diferencial?: { ingresos: number; pagos_tutores: number; neto: number };
  fuente?: string;
}

interface TutorNota {
  id: number;
  tutor_id: number;
  mensaje: string;
  estado: 'pendiente' | 'hecha' | 'eliminada';
  creado_por_nombre?: string | null;
  actualizado_por_nombre?: string | null;
  eliminado_por_nombre?: string | null;
  hecha_en?: string | null;
  eliminada_en?: string | null;
  created_at?: string;
  updated_at?: string;
}

interface TutorNotaHistorial {
  id: number;
  nota_id: number;
  tutor_id: number;
  accion: 'crear' | 'editar' | 'marcar_hecha' | 'reabrir' | 'eliminar';
  mensaje?: string | null;
  estado?: string | null;
  actor_name?: string | null;
  actor_role?: string | null;
  created_at?: string;
  meta?: Record<string, any>;
}

const Dashboard: React.FC = () => {
  const [stats, setStats] = useState<Stats | null>(null);
  // Fecha de hoy usando zona horaria de Costa Rica
  const crToday = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Costa_Rica' });
  const [hoy, setHoy] = useState<string>(crToday);
  const [selectedDate, setSelectedDate] = useState<string>(crToday);
  const [sesionesDelDia, setSesionesDelDia] = useState<SesionDelDia[]>([]);
  const [sesionesHoy, setSesionesHoy] = useState<SesionDelDia[]>([]);
  const [sesionesHoyQuery, setSesionesHoyQuery] = useState('');
  const [sesionesHoyExpanded, setSesionesHoyExpanded] = useState(false);
  const [matriculasLista, setMatriculasLista] = useState<any[]>([]);
  const [tutoresMapa, setTutoresMapa] = useState<Record<number, Tutor>>({});
  const [estudiantesMapa, setEstudiantesMapa] = useState<Record<number, Estudiante>>({});
  const [loading, setLoading] = useState(true);
  const dashboardLoaded = React.useRef(false);
  const [resumenTutores, setResumenTutores] = useState<ResumenTutorEstudiantes[]>([]);
  const [resumenCursos, setResumenCursos] = useState<ResumenCursoGrupos[]>([]);
  const [sesionesDelMes, setSesionesDelMes] = useState<Record<string, SesionDelDia[]>>({});
  const [showDayDetail, setShowDayDetail] = useState(false);
  const [dayDetailQuery, setDayDetailQuery] = useState('');
  const [detalleMatricula, setDetalleMatricula] = useState<any | null>(null);
  const [tutorSeleccionado, setTutorSeleccionado] = useState<{ id: number; nombre: string } | null>(null);
  const [tutorTab, setTutorTab] = useState<'alumnos' | 'clases'>('alumnos');
  const [tutorMes, setTutorMes] = useState<string>(crToday.slice(0, 7));
  const [alumnosTutor, setAlumnosTutor] = useState<{ id: number; nombre: string }[]>([]);
  const [tutorMatriculas, setTutorMatriculas] = useState<Matricula[]>([]);
  const [tutorNotas, setTutorNotas] = useState<TutorNota[]>([]);
  const [tutorNotasHistorial, setTutorNotasHistorial] = useState<TutorNotaHistorial[]>([]);
  const [tutorNotasLoading, setTutorNotasLoading] = useState(false);
  const [tutorNotaDraft, setTutorNotaDraft] = useState('');
  const [tutorNotaSaving, setTutorNotaSaving] = useState(false);
  const [tutorNotaBusy, setTutorNotaBusy] = useState<Record<number, boolean>>({});
  const [tutorNotaEditId, setTutorNotaEditId] = useState<number | null>(null);
  const [tutorNotaEditText, setTutorNotaEditText] = useState('');
  const [tutorHistorialOpen, setTutorHistorialOpen] = useState(false);
  const [programacionSesion, setProgramacionSesion] = useState<{ sesion: SesionDelDia; modo: 'info' | 'programar' } | null>(null);
  const [mensajeWA, setMensajeWA] = useState('');
  const [completandoKeys, setCompletandoKeys] = useState<Record<string, boolean>>({});
  const [uiTick5s, setUiTick5s] = useState(0);
  const [statInfoOpen, setStatInfoOpen] = useState<string | null>(null);

  const [uiNotice, setUiNotice] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
  const [confirmMarcarDada, setConfirmMarcarDada] = useState<{ sesion: SesionDelDia; sesionKey: string } | null>(null);
  const [confirmCancelarHoy, setConfirmCancelarHoy] = useState<{ sesion: SesionDelDia; sesionKey: string; motivo: string } | null>(null);
  const [pendientesQuery, setPendientesQuery] = useState('');
  const [pendientesExpanded, setPendientesExpanded] = useState(false);

  const [metricMes, setMetricMes] = useState<string>(crToday.slice(0, 7));
  const [calMes, setCalMes] = useState<string>(crToday.slice(0, 7));
  const autoCompletedRef = useRef<Set<string>>(new Set());
  const selectedDateRef = useRef<string>(crToday);
  const sessionOverridesRef = useRef<Record<string, Partial<SesionDelDia>>>({});
  const generatedByNameRef = useRef<string>('');
  const pdfLogoDataUrlRef = useRef<string>('');
  useEffect(() => { selectedDateRef.current = selectedDate; }, [selectedDate]);
  const [metricas, setMetricas] = useState<MetricasFinancieras | null>(null);
  const [metricasDenied, setMetricasDenied] = useState(false);
  const [chartModo, setChartModo] = useState<'real' | 'esperado'>(() => {
    try {
      const raw = localStorage.getItem('dashboard.financeChartMode');
      if (raw === 'real' || raw === 'esperado') return raw;
    } catch {
      // ignore
    }
    return 'real';
  });

  useEffect(() => {
    try {
      localStorage.setItem('dashboard.financeChartMode', chartModo);
    } catch {
      // ignore
    }
  }, [chartModo]);

  const [calendarDensity, setCalendarDensity] = useState<number>(() => {
    try {
      const raw = localStorage.getItem('dashboard.calendarDensity');
      const value = Number(raw);
      if (value === 0 || value === 1 || value === 2) return value;
    } catch {
      // ignore
    }
    return 1;
  });

  useEffect(() => {
    try {
      localStorage.setItem('dashboard.calendarDensity', String(calendarDensity));
    } catch {
      // ignore
    }
  }, [calendarDensity]);

  useEffect(() => {
    const id = window.setInterval(() => setUiTick5s((value) => value + 1), 5000);
    return () => window.clearInterval(id);
  }, []);

  const totalSesionesMes = useMemo(() => {
    return Object.entries(sesionesDelMes || {}).reduce((sum, [dateStr, list]) => {
      if (!dateStr.startsWith(`${calMes}-`)) return sum;
      return sum + (list?.length || 0);
    }, 0);
  }, [calMes, sesionesDelMes]);

  // Sesiones de días pasados que NO fueron marcadas como dada ni cancelada
  // Solo incluir sesiones que tienen horario definido (pueden marcarse como dada)
  const sesionesPendientes = useMemo(() => {
    const result: (SesionDelDia & { _fecha: string })[] = [];
    for (const [dateStr, sesiones] of Object.entries(sesionesDelMes || {})) {
      if (!dateStr.startsWith(`${calMes}-`)) continue;
      if (dateStr >= hoy) continue; // solo días pasados (antes de hoy)
      for (const s of sesiones) {
        // Solo mostrar if: (1) sin estado, (2) tiene horario válido (no "—")
        if (!s.estado_sesion && s.hora_inicio && s.hora_inicio !== '—' && s.hora_fin && s.hora_fin !== '—') {
          const inscripcion = String(s.fecha_inscripcion || '').slice(0, 10);
          if (inscripcion && dateStr < inscripcion) continue;
          result.push({ ...s, _fecha: dateStr, fecha: dateStr });
        }
      }
    }
    // Ordenar por fecha DESC (más reciente primero), luego por hora
    return result.sort((a, b) => b._fecha.localeCompare(a._fecha) || String(a.hora_inicio).localeCompare(String(b.hora_inicio)));
  }, [calMes, sesionesDelMes, hoy]);

  const getSesionKey = useCallback((s: SesionDelDia) => {
    return `${s.matricula_id}:${s.hora_inicio}:${s.hora_fin}:${s.curso_nombre}`;
  }, []);

  const normalizeSearch = (value: string) =>
    String(value || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .trim();

  const formatTimeAmPm = (hhmm: string) => {
    const raw = String(hhmm || '').trim();
    const [hRaw, mRaw] = raw.split(':');
    const h = Number(hRaw);
    const m = Number(mRaw);
    if (!Number.isFinite(h) || !Number.isFinite(m)) return raw;
    const d = new Date();
    d.setHours(h, m, 0, 0);
    return d.toLocaleTimeString('es-CR', { hour: 'numeric', minute: '2-digit', hour12: true });
  };

  const getSessionStateKey = useCallback((fecha: string, matriculaId: number) => {
    return `${String(fecha || '').slice(0, 10)}|${Number(matriculaId)}`;
  }, []);

  const filterVisibleSesionesForDate = useCallback((dateStr: string, sesiones: SesionDelDia[]) => {
    if (dateStr < hoy) {
      return sesiones.filter((session) => session.estado_sesion === 'dada' || session.estado_sesion === 'cancelada');
    }
    return sesiones;
  }, [hoy]);

  const getVisibleSesionesForDate = useCallback(
    (dateStr: string, source: Record<string, SesionDelDia[]> = sesionesDelMes) => {
      return filterVisibleSesionesForDate(dateStr, source[dateStr] || []);
    },
    [filterVisibleSesionesForDate, sesionesDelMes]
  );

  const filterOpenSesionesHoy = useCallback((sesiones: SesionDelDia[]) => {
    return sesiones.filter((session) => session.estado_sesion !== 'dada' && session.estado_sesion !== 'cancelada');
  }, []);

  const getSesionesHoyList = useCallback((source: Record<string, SesionDelDia[]>) => {
    return filterOpenSesionesHoy(source[hoy] || []);
  }, [filterOpenSesionesHoy, hoy]);

  const applySessionLocalPatch = useCallback((sesion: SesionDelDia, fechaRaw: string, patch: Partial<SesionDelDia>) => {
    const fecha = String(fechaRaw || sesion.fecha || hoy).slice(0, 10);
    const stateKey = getSessionStateKey(fecha, sesion.matricula_id);
    sessionOverridesRef.current[stateKey] = {
      ...(sessionOverridesRef.current[stateKey] || {}),
      ...patch,
      fecha,
    };

    const patchSession = (item: SesionDelDia) => {
      const itemFecha = String(item.fecha || fecha).slice(0, 10);
      if (item.matricula_id !== sesion.matricula_id || itemFecha !== fecha) return item;
      return { ...item, ...patch, fecha };
    };

    setProgramacionSesion((prev) => {
      if (!prev) return prev;
      const prevFecha = String(prev.sesion.fecha || fecha).slice(0, 10);
      if (prev.sesion.matricula_id !== sesion.matricula_id || prevFecha !== fecha) return prev;
      return {
        ...prev,
        sesion: {
          ...prev.sesion,
          ...patch,
          fecha,
        },
      };
    });

    setSesionesDelDia((prev) => prev.map(patchSession));
    setSesionesHoy((prev) => filterOpenSesionesHoy(prev.map(patchSession)));
    setSesionesDelMes((prev) => {
      const next = { ...prev };
      const list = next[fecha];
      if (Array.isArray(list)) {
        next[fecha] = list.map(patchSession);
      }
      return next;
    });
  }, [filterOpenSesionesHoy, getSessionStateKey, hoy]);

  const resolveGeneratedByName = useCallback(async () => {
    if (generatedByNameRef.current) return generatedByNameRef.current;
    try {
      const me = (await authService.me())?.user;
      const name = String(me?.nombre_completo || me?.username || me?.email || '').trim() || 'Sistema';
      generatedByNameRef.current = name;
      return name;
    } catch {
      return generatedByNameRef.current || 'Sistema';
    }
  }, []);

  const resolvePdfLogoDataUrl = useCallback(async () => {
    if (pdfLogoDataUrlRef.current) return pdfLogoDataUrlRef.current;
    if (typeof window === 'undefined') return '';

    const dataUrl = await new Promise<string>((resolve) => {
      const img = new Image();
      img.decoding = 'async';
      img.onload = () => {
        try {
          const width = img.naturalWidth || img.width || 64;
          const height = img.naturalHeight || img.height || 64;
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve('');
            return;
          }
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/png'));
        } catch {
          resolve('');
        }
      };
      img.onerror = () => resolve('');
      img.src = new URL('favicon.png', window.location.href).toString();
    });

    if (dataUrl) pdfLogoDataUrlRef.current = dataUrl;
    return dataUrl;
  }, []);

  const getMatriculasSnapshot = useCallback(async () => {
    if (Array.isArray(matriculasLista) && matriculasLista.length > 0) return matriculasLista;
    const all = await matriculasService.getAll();
    setMatriculasLista(all as any[]);
    return all;
  }, [matriculasLista]);

  const getErrorMessage = (error: any, fallback: string) => {
    return error?.response?.data?.error || error?.message || fallback;
  };

  const formatNotaDate = (value?: string | null) => {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleString('es-CR', { dateStyle: 'short', timeStyle: 'short' });
  };

  const getNotaAccionLabel = (accion?: string | null) => {
    switch (String(accion || '').toLowerCase()) {
      case 'crear':
        return 'Creó nota';
      case 'editar':
        return 'Editó nota';
      case 'marcar_hecha':
        return 'Marcó como hecha';
      case 'reabrir':
        return 'Reabrió nota';
      case 'eliminar':
        return 'Eliminó nota';
      default:
        return 'Actualizó nota';
    }
  };

  const cargarTutorNotas = useCallback(async (tutorId: number, options: { silent?: boolean } = {}) => {
    if (!tutorId) return;
    if (!options.silent) setTutorNotasLoading(true);
    try {
      const result = await dashboardService.getTutorNotas(tutorId, { history_limit: 180 });
      const notas = [...(result?.notas || [])]
        .filter((n: any) => n && n.estado !== 'eliminada')
        .sort((a: any, b: any) => String(a.created_at || '').localeCompare(String(b.created_at || '')));
      const historial = [...(result?.historial || [])]
        .sort((a: any, b: any) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
      setTutorNotas(notas);
      setTutorNotasHistorial(historial);
    } catch (error) {
      if (!options.silent) {
        setUiNotice({ type: 'error', message: getErrorMessage(error, 'No se pudo cargar las notas internas del equipo') });
      }
    } finally {
      if (!options.silent) setTutorNotasLoading(false);
    }
  }, []);

  const crearTutorNota = useCallback(async () => {
    const tutorId = tutorSeleccionado?.id;
    const mensaje = tutorNotaDraft.trim();
    if (!tutorId || !mensaje || tutorNotaSaving) return;

    setTutorNotaSaving(true);
    try {
      await dashboardService.createTutorNota(tutorId, { mensaje });
      setTutorNotaDraft('');
      await cargarTutorNotas(tutorId, { silent: true });
      setUiNotice({ type: 'success', message: 'Nota guardada y compartida con el equipo.' });
    } catch (error) {
      setUiNotice({ type: 'error', message: getErrorMessage(error, 'No se pudo crear la nota') });
    } finally {
      setTutorNotaSaving(false);
    }
  }, [cargarTutorNotas, tutorNotaDraft, tutorNotaSaving, tutorSeleccionado?.id]);

  const guardarEdicionTutorNota = useCallback(async (notaId: number) => {
    const tutorId = tutorSeleccionado?.id;
    const mensaje = tutorNotaEditText.trim();
    if (!tutorId || !notaId || !mensaje) return;

    setTutorNotaBusy((prev) => ({ ...prev, [notaId]: true }));
    try {
      await dashboardService.updateTutorNota(tutorId, notaId, { mensaje });
      setTutorNotaEditId(null);
      setTutorNotaEditText('');
      await cargarTutorNotas(tutorId, { silent: true });
      setUiNotice({ type: 'success', message: 'Nota actualizada.' });
    } catch (error) {
      setUiNotice({ type: 'error', message: getErrorMessage(error, 'No se pudo editar la nota') });
    } finally {
      setTutorNotaBusy((prev) => {
        const next = { ...prev };
        delete next[notaId];
        return next;
      });
    }
  }, [cargarTutorNotas, tutorNotaEditText, tutorSeleccionado?.id]);

  const cambiarEstadoTutorNota = useCallback(async (nota: TutorNota) => {
    const tutorId = tutorSeleccionado?.id;
    if (!tutorId || !nota?.id) return;
    const nextState = nota.estado === 'hecha' ? 'pendiente' : 'hecha';

    setTutorNotaBusy((prev) => ({ ...prev, [nota.id]: true }));
    try {
      await dashboardService.setTutorNotaEstado(tutorId, nota.id, { estado: nextState });
      await cargarTutorNotas(tutorId, { silent: true });
    } catch (error) {
      setUiNotice({ type: 'error', message: getErrorMessage(error, 'No se pudo cambiar el estado de la nota') });
    } finally {
      setTutorNotaBusy((prev) => {
        const next = { ...prev };
        delete next[nota.id];
        return next;
      });
    }
  }, [cargarTutorNotas, tutorSeleccionado?.id]);

  const eliminarTutorNota = useCallback(async (nota: TutorNota) => {
    const tutorId = tutorSeleccionado?.id;
    if (!tutorId || !nota?.id) return;
    if (!window.confirm('¿Eliminar esta nota? Quedará registrada en el historial.')) return;

    setTutorNotaBusy((prev) => ({ ...prev, [nota.id]: true }));
    try {
      await dashboardService.deleteTutorNota(tutorId, nota.id);
      if (tutorNotaEditId === nota.id) {
        setTutorNotaEditId(null);
        setTutorNotaEditText('');
      }
      await cargarTutorNotas(tutorId, { silent: true });
      setUiNotice({ type: 'success', message: 'Nota eliminada.' });
    } catch (error) {
      setUiNotice({ type: 'error', message: getErrorMessage(error, 'No se pudo eliminar la nota') });
    } finally {
      setTutorNotaBusy((prev) => {
        const next = { ...prev };
        delete next[nota.id];
        return next;
      });
    }
  }, [cargarTutorNotas, tutorNotaEditId, tutorSeleccionado?.id]);

  const exportCalendarPdf = useCallback(async () => {
    const [year, monthNum] = calMes.split('-').map(Number);
    const month = monthNum - 1;
    const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    const firstDay = new Date(year, month, 1);
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const startDay = firstDay.getDay();

    const days: (number | null)[] = [];
    for (let index = 0; index < startDay; index++) days.push(null);
    for (let day = 1; day <= daysInMonth; day++) days.push(day);
    while (days.length % 7 !== 0) days.push(null);

    const sessionsByDate: Record<string, { timeRange: string; participants: string[] }[]> = {};
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(monthNum).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const sessions = (sesionesDelMes[dateStr] || [])
        .filter((session) => session.estado_sesion !== 'cancelada')
        .sort((a, b) => String(a.hora_inicio || '').localeCompare(String(b.hora_inicio || '')))
        .map((session) => {
          const matricula = (matriculasLista || []).find((item: any) => item?.id === session.matricula_id);
          const isGrupo = Boolean(matricula?.es_grupo) || Boolean(matricula?.grupo_nombre);
          const ids = Array.isArray(matricula?.estudiante_ids) ? matricula.estudiante_ids : [];
          const nombres = ids
            .map((id: number) => String(estudiantesMapa[id]?.nombre || '').trim())
            .filter(Boolean);
          const fallback = String(session.estudiante_nombre || matricula?.grupo_nombre || '—')
            .replace(/^Grupo:\s*/i, '')
            .replace(/\s*\(\d+\)\s*$/, '')
            .trim() || '—';

          return {
            timeRange: `${String(session.hora_inicio || '').slice(0, 5) || '—'} - ${String(session.hora_fin || '').slice(0, 5) || '—'}`,
            participants: isGrupo ? (nombres.length > 0 ? nombres : [fallback]) : [fallback],
          };
        });
      sessionsByDate[dateStr] = sessions;
    }

    const totalSessions = Object.values(sessionsByDate).reduce((sum, list) => sum + list.length, 0);
    if (totalSessions === 0) {
      setUiNotice({ type: 'info', message: 'No hay clases para exportar en este mes.' });
      return;
    }

    const [generatedBy, logoDataUrl] = await Promise.all([
      resolveGeneratedByName(),
      resolvePdfLogoDataUrl(),
    ]);

    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const marginX = 24;
    const marginBottom = 24;
    const titleY = 30;
    const subY = 47;
    const metaY = 61;
    const gridStartY = 84;
    const headerHeight = 24;
    const gridWidth = pageWidth - marginX * 2;
    const weeks = Array.from({ length: days.length / 7 }, (_, index) => days.slice(index * 7, index * 7 + 7));
    const cellWidth = gridWidth / 7;
    const gridHeight = pageHeight - gridStartY - marginBottom;
    const cellHeight = (gridHeight - headerHeight) / weeks.length;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(15, 44, 90);
    doc.text(`Calendario de Clases - ${monthNames[month]} ${year}`, marginX, titleY);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    doc.text('Cada cuadro muestra el horario y el nombre completo del estudiante o integrantes del grupo.', marginX, subY);
    doc.text(`Generado por: ${generatedBy}`, marginX, metaY);
    doc.text(`Generado: ${new Date().toLocaleString('es-CR')}`, pageWidth - marginX, metaY, { align: 'right' });

    if (logoDataUrl) {
      try {
        const logoSize = 26;
        const logoX = pageWidth - marginX - logoSize;
        const logoY = 16;
        doc.addImage(logoDataUrl, 'PNG', logoX, logoY, logoSize, logoSize, undefined, 'FAST');
      } catch {
        // Si falla la carga del logo, el PDF sigue generándose sin bloquear al usuario.
      }
    }

    for (let col = 0; col < 7; col++) {
      const x = marginX + col * cellWidth;
      doc.setFillColor(15, 44, 90);
      doc.setDrawColor(203, 213, 225);
      doc.rect(x, gridStartY, cellWidth, headerHeight, 'FD');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(255, 255, 255);
      doc.text(dayNames[col], x + cellWidth / 2, gridStartY + 16, { align: 'center' });
    }

    weeks.forEach((week, weekIndex) => {
      week.forEach((day, colIndex) => {
        const x = marginX + colIndex * cellWidth;
        const y = gridStartY + headerHeight + weekIndex * cellHeight;
        const isToday = day != null && `${year}-${String(monthNum).padStart(2, '0')}-${String(day).padStart(2, '0')}` === hoy;
        const fill = day == null ? [248, 250, 252] : isToday ? [224, 242, 254] : [255, 255, 255];
        doc.setFillColor(fill[0], fill[1], fill[2]);
        doc.setDrawColor(203, 213, 225);
        doc.rect(x, y, cellWidth, cellHeight, 'FD');

        if (day == null) return;

        const dateStr = `${year}-${String(monthNum).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const entries = sessionsByDate[dateStr] || [];
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(15, 23, 42);
        doc.text(String(day), x + 6, y + 12);

        const contentWidth = cellWidth - 10;
        const topPadding = 22;
        const lineHeight = 7.4;
        const blockGap = 3;
        const maxY = y + cellHeight - 5;
        let cursorY = y + topPadding;

        for (const entry of entries) {
          const wrappedParticipantLines = entry.participants.flatMap((participant) => doc.splitTextToSize(participant, contentWidth) as string[]);
          const neededHeight = ((1 + wrappedParticipantLines.length) * lineHeight) + blockGap;
          if (cursorY + neededHeight > maxY) break;

          doc.setFont('helvetica', 'bold');
          doc.setFontSize(6.8);
          doc.setTextColor(15, 44, 90);
          doc.text(entry.timeRange, x + 5, cursorY);
          cursorY += lineHeight;

          doc.setFont('helvetica', 'normal');
          doc.setFontSize(6.4);
          doc.setTextColor(30, 41, 59);
          wrappedParticipantLines.forEach((line) => {
            doc.text(line, x + 5, cursorY);
            cursorY += lineHeight;
          });

          cursorY += blockGap;
        }
      });
    });

    doc.save(`Calendario_${calMes}.pdf`);
    setUiNotice({ type: 'success', message: `PDF exportado: Calendario_${calMes}.pdf` });
  }, [calMes, estudiantesMapa, matriculasLista, resolveGeneratedByName, resolvePdfLogoDataUrl, sesionesDelMes]);

  const getCursoStudentCountForSession = (sesion: SesionDelDia): number | null => {
    const m = (matriculasLista || []).find((x: any) => x?.id === sesion.matricula_id);
    if (m) {
      if (m?.es_grupo && Array.isArray(m?.estudiante_ids)) return m.estudiante_ids.length;
      return 1;
    }
    if (sesion?.estudiante_id != null) return 1;
    return null;
  };

  const getSingleStudentNameForSession = (sesion: SesionDelDia): string => {
    const m = (matriculasLista || []).find((x: any) => x?.id === sesion.matricula_id);
    if (m?.es_grupo && Array.isArray(m?.estudiante_ids) && m.estudiante_ids.length === 1) {
      const onlyId = m.estudiante_ids[0];
      const e = onlyId != null ? estudiantesMapa[onlyId] : undefined;
      return String(e?.nombre || '').trim() || String(m?.estudiante_nombre || '').trim() || String(sesion.estudiante_nombre || '').trim();
    }
    if (m && !m?.es_grupo) {
      return String(m?.estudiante_nombre || '').trim() || String(sesion.estudiante_nombre || '').trim();
    }
    return String(sesion.estudiante_nombre || '').trim();
  };

  const getEnrollmentDate = (source: any): string => {
    return String(source?.fecha_inscripcion || source?.created_at || '').slice(0, 10);
  };

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

  const isSesionEnCurso = (s: SesionDelDia, fecha?: string) => {
    const fechaRef = String(fecha || s.fecha || '').slice(0, 10);
    const hoyCr = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Costa_Rica' });
    if (!fechaRef || fechaRef !== hoyCr) return false;

    const [hIni, mIni] = String(s.hora_inicio || '').split(':').map(Number);
    const [hFin, mFin] = String(s.hora_fin || '').split(':').map(Number);
    if (!isFinite(hIni) || !isFinite(mIni) || !isFinite(hFin) || !isFinite(mFin)) return false;

    const ahora = new Date();
    const inicio = new Date();
    inicio.setHours(hIni, mIni, 0, 0);
    const fin = new Date();
    fin.setHours(hFin, mFin, 0, 0);
    if (fin <= inicio) return false;

    return ahora >= inicio && ahora <= fin;
  };

  const estadoSesionLabel = (s: SesionDelDia, fecha?: string) => {
    if (isSesionEnCurso(s, fecha)) return 'En curso';
    if (s.confirmado) return 'Confirmada';
    if (s.avisado) return 'En espera';
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

  const getMatriculaFromSesion = (sesion: SesionDelDia) => {
    return (matriculasLista || []).find((m: any) => m?.id === sesion.matricula_id) || null;
  };

  const getPagoTipo = (matricula: any, sesion?: SesionDelDia) => {
    const raw = String(
      matricula?.curso_tipo_pago ??
        matricula?.tipo_pago ??
        matricula?.tipo_pago_curso ??
        (sesion as any)?.curso_tipo_pago ??
        ''
    ).toLowerCase();
    if (raw === 'mensual') return 'mensual';
    if (raw === 'sesion' || raw === 'sesión') return 'sesion';
    return '';
  };

  const getGrupoInfoForSession = (sesion: SesionDelDia) => {
    const matricula = getMatriculaFromSesion(sesion);
    const isGrupo = Boolean(matricula?.es_grupo) || Boolean(matricula?.grupo_nombre);
    const grupoNombre = String(matricula?.grupo_nombre || '').trim();
    const ids = Array.isArray(matricula?.estudiante_ids) ? matricula.estudiante_ids : [];
    const nombres = ids
      .map((id: number) => estudiantesMapa[id]?.nombre || `Estudiante #${id}`)
      .filter(Boolean);
    const nombreResuelto = grupoNombre
      || (nombres.length > 0
        ? (nombres.length <= 3 ? nombres.join(', ') : `${nombres.slice(0, 2).join(', ')} +${nombres.length - 2}`)
        : 'Sin nombre');
    return {
      isGrupo,
      nombre: nombreResuelto,
      count: ids.length,
      nombres,
    };
  };

  const getSessionParticipantLabel = (sesion?: SesionDelDia | null): string => {
    if (!sesion) return '—';
    const grupoInfo = getGrupoInfoForSession(sesion);
    if (grupoInfo.isGrupo && grupoInfo.nombres.length > 0) {
      return grupoInfo.nombres.join(', ');
    }
    const raw = String(sesion.estudiante_nombre || '').trim();
    const normalized = raw
      .replace(/^Grupo:\s*/i, '')
      .replace(/\s*\(\d+\)\s*$/, '')
      .trim();
    return normalized || '—';
  };

  const normalizePhoneForWhatsApp = (numero: string): string => {
    const raw = String(numero || '').trim();
    let digits = raw.replace(/\D/g, '');
    if (!digits) return '';

    // Prefijo internacional "00" (común en varios países): 00 + country + number
    if (digits.startsWith('00')) digits = digits.slice(2);

    // Si el usuario explícitamente puso '+', respetar el código país que venga.
    // WhatsApp espera solo dígitos (E.164 sin '+').
    const hasExplicitCountryCode = raw.startsWith('+');

    // Default Costa Rica SOLO cuando no hay indicio de código país
    // (8 dígitos locales o 0+8 dígitos) y no empezó con '+'.
    if (!hasExplicitCountryCode) {
      if (digits.length === 8) digits = `506${digits}`;
      if (digits.length === 9 && digits.startsWith('0')) digits = `506${digits.slice(1)}`;
    }

    return digits;
  };

  const buildWaUrl = (numero: string, mensaje: string) => {
    const phone = normalizePhoneForWhatsApp(numero);
    if (!phone) return '';
    const text = String(mensaje || '').trim();
    const qs = text ? `?text=${encodeURIComponent(text)}` : '';
    return `https://wa.me/${phone}${qs}`;
  };

  const openWhatsApp = async (numero: string, mensaje?: string) => {
    const phone = normalizePhoneForWhatsApp(numero);
    if (!phone) {
      setUiNotice({ type: 'error', message: 'No hay teléfono configurado para WhatsApp.' });
      return;
    }

    const text = String(mensaje || '').trim();
    const webUrl = buildWaUrl(phone, text);

    // Abrir siempre por navegador. En Electron, `desktop/main.cjs` intercepta `window.open`
    // y lo redirige con `shell.openExternal` (navegador del sistema).
    const isElectron = typeof navigator !== 'undefined' && /Electron/i.test(navigator.userAgent);
    try {
      setUiNotice({ type: 'info', message: 'Abriendo WhatsApp en el navegador…' });
      const opened = window.open(webUrl, '_blank', 'noopener,noreferrer');

      // En Electron, cuando se usa setWindowOpenHandler, window.open puede retornar null
      // aunque el enlace sí se abra externamente.
      if (!opened && !isElectron) {
        setUiNotice({
          type: 'error',
          message: 'El navegador bloqueó la ventana emergente. Habilita pop-ups o intenta de nuevo.',
        });
      }
    } catch {
      if (!isElectron) {
        window.location.href = webUrl;
      }
    }
  };

  const abrirProgramacion = (sesion: SesionDelDia, modo: 'info' | 'programar') => {
    setProgramacionSesion({ sesion, modo });
    const fechaLabel = hoy ? new Date(hoy + 'T00:00:00').toLocaleDateString('es-CR') : '';
    const hi = formatTimeAmPm(sesion.hora_inicio);
    const hf = formatTimeAmPm(sesion.hora_fin);
    const studentCount = getCursoStudentCountForSession(sesion);
    const singleName = getSingleStudentNameForSession(sesion);
    const participantLabel = getSessionParticipantLabel(sesion);
    const msg = studentCount === 1
      ? `Hola, confirmamos la sesión de ${singleName} de hoy de ${hi} a ${hf}. ¿Puedes confirmar asistencia?`
      : `Hola, confirmamos la sesión de ${sesion.curso_nombre} con ${participantLabel} el ${fechaLabel} de ${hi} a ${hf}. ¿Puedes confirmar asistencia?`;
    setMensajeWA(msg);
  };

  const cerrarProgramacion = () => setProgramacionSesion(null);

  const cambiarEstadoSesion = async (sesion: SesionDelDia, avisado?: boolean, confirmado?: boolean) => {
    try {
      const fecha = sesion.fecha || new Date().toISOString().split('T')[0];
      setUiNotice({ type: 'info', message: 'Actualizando estado de la sesión…' });
      await dashboardService.actualizarEstadoSesion(sesion.matricula_id, fecha, { avisado, confirmado });

      applySessionLocalPatch(sesion, fecha, { avisado, confirmado, fecha });
      window.setTimeout(() => { void fetchData(); }, 350);

      const label = confirmado ? 'Confirmada' : avisado ? 'En espera' : 'Programada';
      setUiNotice({ type: 'success', message: `Estado actualizado: ${label}.` });
    } catch (e) {
      console.error('Error al actualizar estado:', e);
      const errAny: any = e as any;
      const status = errAny?.response?.status;
      const code = errAny?.response?.data?.code;
      const serverMsg = errAny?.response?.data?.error || errAny?.response?.data?.message;
      const tail = [
        status ? `(${status})` : null,
        code ? `[${code}]` : null,
        serverMsg ? String(serverMsg) : null,
      ].filter(Boolean).join(' ');
      setUiNotice({ type: 'error', message: `Error al actualizar estado${tail ? ` ${tail}` : ''}` });
    }
  };

  const cargarDetalleMatricula = async (matriculaId: number) => {
    try {
      const all = await getMatriculasSnapshot();
      const m = all.find((x) => x.id === matriculaId);
      if (!m) {
        setDetalleMatricula(null);
        return;
      }
      const tipoInscripcionBase = (() => {
        const tipoClase = String((m as any)?.curso_tipo_clase || '').toLowerCase();
        if (m.es_grupo || m.grupo_nombre) return 'Grupal';
        if (tipoClase === 'tutoria' || tipoClase === 'tutoría') return 'Tutoría (1 a 1)';
        return 'Individual';
      })();

      const tipoPagoLabel = (() => {
        const raw = String((m as any)?.curso_tipo_pago || '').toLowerCase();
        if (raw === 'mensual') return 'Pago mensual';
        if (raw === 'sesion' || raw === 'sesión') return 'Pago por sesión';
        return '';
      })();

      const tipoInscripcion = tipoPagoLabel ? `${tipoInscripcionBase} · ${tipoPagoLabel}` : tipoInscripcionBase;

      const existingTipo = String((m as any)?.tipo_inscripcion ?? '').trim();
      const effectiveTipo = existingTipo && existingTipo !== '-' && existingTipo !== '—' ? existingTipo : tipoInscripcion;

      let students: { id: number; nombre: string }[] = [];
      if (m.es_grupo && m.grupo_nombre) {
        const uniq = new Map<number, string>();

        // Caso 1: matrícula grupal como fila única con estudiante_ids
        const ids = Array.isArray((m as any)?.estudiante_ids) ? (m as any).estudiante_ids : [];
        if (ids.length > 0) {
          ids.forEach((id: any) => {
            const n = Number(id);
            if (!Number.isFinite(n) || !n) return;
            const e = (estudiantesMapa as any)?.[n];
            uniq.set(n, String(e?.nombre || `Alumno ${n}`));
          });
        } else {
          // Caso 2: grupo modelado como múltiples filas (una por estudiante)
          const miembros = all.filter((x: any) => x.curso_id === m.curso_id && x.grupo_nombre === m.grupo_nombre);
          miembros.forEach((x: any) => {
            if (x.estudiante_id) uniq.set(x.estudiante_id, x.estudiante_nombre || `Alumno ${x.estudiante_id}`);
          });
        }

        students = Array.from(uniq.entries()).map(([id, nombre]) => ({ id, nombre }));
      } else if (m.estudiante_id) {
        students = [{ id: m.estudiante_id, nombre: m.estudiante_nombre || `Alumno ${m.estudiante_id}` }];
      }
      setDetalleMatricula({
        ...m,
        students,
        tipo_inscripcion: effectiveTipo,
        grupo: (m as any)?.grupo || m.grupo_nombre || null,
      });
    } catch (e) {
      console.error('Error cargando detalle de matrícula', e);
      setDetalleMatricula(null);
    }
  };

  const cargarAlumnosTutor = async (tutorId: number, nombre: string) => {
    try {
      const all = await getMatriculasSnapshot();
      const filtradas = all.filter((m) => m.tutor_id === tutorId && m.estado !== 0);
      const uniq = new Map<number, string>();
      filtradas.forEach((m) => {
        if (m.estudiante_id) uniq.set(m.estudiante_id, m.estudiante_nombre || `Alumno ${m.estudiante_id}`);
        const ids = Array.isArray((m as any)?.estudiante_ids) ? (m as any).estudiante_ids as number[] : [];
        ids.forEach((id) => {
          uniq.set(id, estudiantesMapa[id]?.nombre || `Alumno ${id}`);
        });
      });
      setTutorHistorialOpen(false);
      setTutorNotaDraft('');
      setTutorNotaEditId(null);
      setTutorNotaEditText('');
      setTutorSeleccionado({ id: tutorId, nombre });
      setTutorTab('alumnos');
      setTutorMatriculas(filtradas as Matricula[]);
      setAlumnosTutor(Array.from(uniq.entries()).map(([id, nombre]) => ({ id, nombre })));
    } catch (e) {
      console.error('Error cargando alumnos del tutor', e);
      setTutorHistorialOpen(false);
      setTutorNotaDraft('');
      setTutorNotaEditId(null);
      setTutorNotaEditText('');
      setTutorSeleccionado({ id: tutorId, nombre });
      setTutorTab('alumnos');
      setTutorMatriculas([]);
      setAlumnosTutor([]);
    }
  };

  const fetchData = useCallback(async () => {
    // Solo mostrar loading en la primera carga, no en actualizaciones realtime
    if (!dashboardLoaded.current) setLoading(true);
    try {
      const monthsForView = Array.from(new Set([calMes, tutorMes].filter(Boolean))).sort();
      const startMonth = monthsForView[0] || calMes;
      const endMonth = monthsForView[monthsForView.length - 1] || calMes;

      const [startY, startM] = startMonth.split('-').map(Number);
      const [endY, endM] = endMonth.split('-').map(Number);
      const endDim = new Date(endY, endM, 0).getDate();
      const fi = `${String(startY)}-${String(startM).padStart(2, '0')}-01`;
      const ff = `${String(endY)}-${String(endM).padStart(2, '0')}-${String(endDim).padStart(2, '0')}`;

      // ── Lanzar TODAS las llamadas API en paralelo ──
      const [tutoresAll, estudiantesAll, statsData, metricasResult, matriculasAll, estadosRangoResult, rt, rc] = await Promise.all([
        tutoresService.getAll().catch(() => [] as Tutor[]),
        estudiantesService.getAll().catch(() => [] as Estudiante[]),
        dashboardService.getStats().catch(() => ({
          tutores_activos: 0, estudiantes_activos: 0, cursos_activos: 0,
          matriculas_activas: 0, total_clases: 0, ingresos_pendientes: 0,
        })),
        dashboardService.getMetricas({ mes: metricMes }).then(m => ({ data: m, denied: false })).catch((e: any) => ({
          data: null, denied: e?.response?.status === 403,
        })),
        matriculasService.getAll().catch(() => [] as Matricula[]),
        dashboardService.obtenerEstadosClasesRango({ fecha_inicio: fi, fecha_fin: ff }).catch(() => []),
        dashboardService.getResumenTutoresEstudiantes().catch(() => []),
        dashboardService.getResumenCursosGrupos().catch(() => []),
      ]);

      // ── Procesar tutores y estudiantes ──
      const tMap: Record<number, Tutor> = {};
      const eMap: Record<number, Estudiante> = {};
      tutoresAll.forEach((t) => { if (t?.id) tMap[t.id] = t; });
      estudiantesAll.forEach((e) => { if (e?.id) eMap[e.id] = e; });
      setTutoresMapa(tMap);
      setEstudiantesMapa(eMap);
      setStats(statsData);

      // ── Métricas ──
      setMetricas(metricasResult.data as any);
      setMetricasDenied(metricasResult.denied);
      setMatriculasLista(matriculasAll as any[]);

      // ── Calcular sesiones de los meses visibles (calendario + panel tutor) ──
      const matriculas = matriculasAll.filter((m: any) => {
        const isActiva = !!m?.estado;
        const hasCursoTutor = m?.curso_id != null && m?.tutor_id != null;
        const isIndividual = m?.estudiante_id != null;
        const isGrupo = !!m?.es_grupo && Array.isArray(m?.estudiante_ids) && m.estudiante_ids.length > 0;
        return isActiva && hasCursoTutor && (isIndividual || isGrupo);
      });

      const sesionesmes: Record<string, SesionDelDia[]> = {};

      for (const monthKey of monthsForView) {
        const [year, monthNum] = monthKey.split('-').map(Number);
        if (!Number.isFinite(year) || !Number.isFinite(monthNum)) continue;

        const month = monthNum - 1;
        const daysInMonth = new Date(year, month + 1, 0).getDate();

        for (let day = 1; day <= daysInMonth; day++) {
          const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const diaSemana = getDiaSemana(dateStr);
          const sesiones: SesionDelDia[] = [];

          matriculas.forEach((matricula: any) => {
            const enrollmentDate = getEnrollmentDate(matricula);
            if (enrollmentDate && dateStr < enrollmentDate) return;

            const isGrupo = Boolean((matricula as any)?.es_grupo);
            const grupoNombre = String((matricula as any)?.grupo_nombre || '').trim();
            const grupoIds = Array.isArray((matricula as any)?.estudiante_ids) ? (matricula as any).estudiante_ids as number[] : [];
            const participantNames = grupoIds
              .map((id: number) => String(eMap[id]?.nombre || '').trim())
              .filter((name): name is string => Boolean(name));
            let estudianteNombre: string;
            if (!isGrupo) {
              estudianteNombre = (matricula as any)?.estudiante_nombre || `Alumno ${(matricula as any)?.estudiante_id}`;
            } else {
              estudianteNombre = participantNames.join(', ') || grupoNombre || 'Sin nombre';
            }

            const cursoLike = {
              dias_schedule: (matricula as any)?.curso_dias_schedule,
              dias_turno: (matricula as any)?.curso_dias_turno,
            };
            const sched = getCursoScheduleForDay(cursoLike, diaSemana);
            if (sched?.kind === 'schedule' && sched.value) {
              const schedule = sched.value as any;
              sesiones.push({
                matricula_id: matricula.id,
                curso_nombre: (matricula as any)?.curso_nombre || 'Curso',
                estudiante_nombre: estudianteNombre,
                tutor_nombre: (matricula as any)?.tutor_nombre || 'Tutor',
                hora_inicio: schedule.hora_inicio || schedule.horaInicio || schedule.start || '—',
                hora_fin: schedule.hora_fin || schedule.horaFin || schedule.end || '—',
                duracion_horas: schedule.duracion_horas || 0,
                turno: schedule.turno,
                curso_tipo_pago: (matricula as any)?.curso_tipo_pago ?? null,
                tutor_id: (matricula as any)?.tutor_id,
                estudiante_id: !isGrupo ? ((matricula as any)?.estudiante_id) : undefined,
                curso_id: (matricula as any)?.curso_id,
                avisado: true,
                confirmado: false,
                fecha: dateStr,
                fecha_inscripcion: enrollmentDate || null,
              });
            } else if (sched?.kind === 'turno' && sched.value) {
              const turno = sched.value as any;
              sesiones.push({
                matricula_id: matricula.id,
                curso_nombre: (matricula as any)?.curso_nombre || 'Curso',
                estudiante_nombre: estudianteNombre,
                tutor_nombre: (matricula as any)?.tutor_nombre || 'Tutor',
                hora_inicio: '—',
                hora_fin: '—',
                duracion_horas: 0,
                turno: turno,
                curso_tipo_pago: (matricula as any)?.curso_tipo_pago ?? null,
                tutor_id: (matricula as any)?.tutor_id,
                estudiante_id: !isGrupo ? ((matricula as any)?.estudiante_id) : undefined,
                curso_id: (matricula as any)?.curso_id,
                avisado: true,
                confirmado: false,
                fecha: dateStr,
                fecha_inscripcion: enrollmentDate || null,
              });
            }
          });

          if (sesiones.length > 0) {
            sesiones.sort((a, b) => String(a.hora_inicio).localeCompare(String(b.hora_inicio)));
            sesionesmes[dateStr] = sesiones;
          }
        }
      }

      // ── Aplicar estados de sesiones (ya cargados en paralelo) ──
      const estadosMap = new Map<string, { avisado: boolean; confirmado: boolean; estado_sesion: 'dada' | 'cancelada' | null }>();
      ((estadosRangoResult || []) as any[]).forEach((e: any) => {
        const key = `${String(e.fecha || '').slice(0, 10)}|${e.matricula_id}`;
        if (!key.startsWith('|')) {
          estadosMap.set(key, {
            avisado: Boolean(e.avisado),
            confirmado: Boolean(e.confirmado),
            estado_sesion: (e.estado_sesion as 'dada' | 'cancelada' | null) || null,
          });
        }
      });

      const consumedKeys = new Set<string>();
      for (const dateStr of Object.keys(sesionesmes)) {
        sesionesmes[dateStr].forEach((sesion: SesionDelDia) => {
          const key = `${dateStr}|${sesion.matricula_id}`;
          const estado = estadosMap.get(key);
          if (estado) {
            sesion.avisado = estado.avisado;
            sesion.confirmado = estado.confirmado;
            sesion.estado_sesion = estado.estado_sesion;
            consumedKeys.add(key);
          }
        });
      }

      // ── Inyectar sesiones huérfanas (horario cambiado después de marcar) ──
      for (const [key, estado] of estadosMap) {
        if (consumedKeys.has(key) || !estado.estado_sesion) continue;
        const [dateStr, matIdStr] = key.split('|');
        const matId = Number(matIdStr);
        const mat = matriculas.find((m: any) => m.id === matId);
        if (!mat) continue;
        const enrollmentDate = getEnrollmentDate(mat);
        if (enrollmentDate && dateStr < enrollmentDate) continue;
        const eRaw = (estadosRangoResult as any[]).find(
          (e: any) => String(e.fecha || '').slice(0, 10) === dateStr && e.matricula_id === matId
        );
        const isGrupo = Boolean((mat as any)?.es_grupo);
        const grupoNombre = String((mat as any)?.grupo_nombre || '').trim();
        const grupoIdsOrphan = Array.isArray((mat as any)?.estudiante_ids) ? (mat as any).estudiante_ids as number[] : [];
        const participantNames = grupoIdsOrphan
          .map((id: number) => String(eMap[id]?.nombre || '').trim())
          .filter((name): name is string => Boolean(name));
        let estudianteNombre: string;
        if (!isGrupo) {
          estudianteNombre = (mat as any)?.estudiante_nombre || `Alumno ${(mat as any)?.estudiante_id}`;
        } else {
          estudianteNombre = participantNames.join(', ') || grupoNombre || 'Sin nombre';
        }
        const orphan: SesionDelDia = {
          matricula_id: matId,
          curso_nombre: (mat as any)?.curso_nombre || 'Curso',
          estudiante_nombre: estudianteNombre,
          tutor_nombre: (mat as any)?.tutor_nombre || 'Tutor',
          hora_inicio: eRaw?.hora_inicio || '—',
          hora_fin: eRaw?.hora_fin || '—',
          duracion_horas: eRaw?.duracion_horas || 0,
          turno: '',
          curso_tipo_pago: (mat as any)?.curso_tipo_pago ?? null,
          tutor_id: (mat as any)?.tutor_id,
          estudiante_id: !isGrupo ? ((mat as any)?.estudiante_id) : undefined,
          curso_id: (mat as any)?.curso_id,
          avisado: estado.avisado,
          confirmado: estado.confirmado,
          fecha: dateStr,
          estado_sesion: estado.estado_sesion,
          fecha_inscripcion: enrollmentDate || null,
        };
        if (!sesionesmes[dateStr]) sesionesmes[dateStr] = [];
        sesionesmes[dateStr].push(orphan);
      }

      const resolvedOverrideKeys: string[] = [];
      for (const [stateKey, patch] of Object.entries(sessionOverridesRef.current)) {
        const [dateStr, matriculaIdRaw] = stateKey.split('|');
        const matriculaId = Number(matriculaIdRaw);
        const list = sesionesmes[dateStr];
        if (!Array.isArray(list)) continue;

        let applied = false;
        sesionesmes[dateStr] = list.map((sesion) => {
          if (sesion.matricula_id !== matriculaId) return sesion;
          applied = true;
          return { ...sesion, ...patch, fecha: dateStr };
        });

        const serverState = estadosMap.get(stateKey);
        if (applied && serverState && Object.entries(patch).every(([field, value]) => (serverState as any)?.[field] === value)) {
          resolvedOverrideKeys.push(stateKey);
        }
      }

      resolvedOverrideKeys.forEach((stateKey) => {
        delete sessionOverridesRef.current[stateKey];
      });

      setSesionesDelMes(sesionesmes);
      // Sesiones de hoy extraídas del cálculo mensual (sin llamada extra)
      setSesionesHoy(getSesionesHoyList(sesionesmes));
      // Solo actualizar sesionesDelDia si ya hay un día seleccionado
      const curSel = selectedDateRef.current;
      if (curSel) {
        setSesionesDelDia(filterVisibleSesionesForDate(curSel, sesionesmes[curSel] || []));
      }

      // Resúmenes (ya cargados en paralelo)
      setResumenTutores(rt);
      setResumenCursos(rc);
    } catch (err) {
      console.error('Error en dashboard:', err);
    } finally {
      dashboardLoaded.current = true;
      setLoading(false);
    }
  }, [calMes, filterVisibleSesionesForDate, getSesionesHoyList, hoy, metricMes, tutorMes]);

  const tutorMonthView = useMemo(() => {
    const [cy, cm] = tutorMes.split('-').map(Number);
    const mNames = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
    const dayNames = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
    const byDate = new Map<string, SesionDelDia[]>();

    if (tutorSeleccionado?.id != null) {
      for (const [dateStr, sesiones] of Object.entries(sesionesDelMes)) {
        if (!dateStr.startsWith(`${tutorMes}-`)) continue;
        const filtered = (sesiones as SesionDelDia[]).filter((s) => s.tutor_id === tutorSeleccionado.id);
        if (filtered.length > 0) {
          byDate.set(dateStr, [...filtered].sort((a, b) => (a.hora_inicio || '').localeCompare(b.hora_inicio || '')));
        }
      }
    }

    const sortedDates = Array.from(byDate.keys()).sort();
    let totD = 0;
    let totC = 0;
    let totP = 0;
    for (const seses of byDate.values()) {
      for (const s of seses) {
        if (s.estado_sesion === 'dada') totD++;
        else if (s.estado_sesion === 'cancelada') totC++;
        else totP++;
      }
    }

    return { cy, cm, mNames, dayNames, byDate, sortedDates, totD, totC, totP };
  }, [sesionesDelMes, tutorMes, tutorSeleccionado?.id]);

  const maxAbsSerie = (() => {
    const s = (metricas?.series_esperado || metricas?.series || []) as any[];
    let max = 0;
    for (const it of s) {
      const a = Math.max(Math.abs(Number(it.ingresos) || 0), Math.abs(Number(it.egresos) || 0), Math.abs(Number(it.neto) || 0));
      if (a > max) max = a;
    }
    return max || 1;
  })();

  const maxAbsSerieReal = (() => {
    const s = (metricas?.series_real || []) as any[];
    let max = 0;
    for (const it of s) {
      const a = Math.max(Math.abs(Number(it.ingresos) || 0), Math.abs(Number(it.egresos) || 0), Math.abs(Number(it.neto) || 0));
      if (a > max) max = a;
    }
    return max || 1;
  })();

  const chartHasReal = Array.isArray(metricas?.series_real) && metricas.series_real.length > 0;
  const chartHasEsperado = Array.isArray(metricas?.series_esperado || metricas?.series) && ((metricas?.series_esperado || metricas?.series) as any[]).length > 0;
  const chartShowReal = chartModo === 'real' && chartHasReal;
  const chartSeries = (chartShowReal ? metricas?.series_real : (metricas?.series_esperado || metricas?.series)) as any[] | undefined;
  const chartMaxAbs = chartShowReal ? maxAbsSerieReal : maxAbsSerie;

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (!tutorSeleccionado?.id) {
      setTutorNotas([]);
      setTutorNotasHistorial([]);
      setTutorNotaDraft('');
      setTutorNotaEditId(null);
      setTutorNotaEditText('');
      setTutorNotaBusy({});
      setTutorHistorialOpen(false);
      setTutorNotasLoading(false);
      return;
    }
    setTutorNotaEditId(null);
    setTutorNotaEditText('');
    void cargarTutorNotas(tutorSeleccionado.id);
  }, [cargarTutorNotas, tutorSeleccionado?.id]);

  // Auto-completar sesiones mensuales pendientes de días pasados
  useEffect(() => {
    const mensualPendientes = sesionesPendientes.filter(s => {
      if (s.curso_tipo_pago !== 'mensual') return false;
      const key = `${s.matricula_id}:${s._fecha}`;
      return !autoCompletedRef.current.has(key);
    });
    if (mensualPendientes.length === 0) return;
    mensualPendientes.forEach(s => {
      const key = `${s.matricula_id}:${s._fecha}`;
      autoCompletedRef.current.add(key);
      dashboardService.completarSesion(s.matricula_id, s._fecha)
        .catch(e => console.warn('Auto-complete mensual failed:', key, e));
    });
    setTimeout(() => fetchData(), 1500);
  }, [sesionesPendientes, fetchData]);

  // Suscripción realtime — actualiza automáticamente al cambiar datos relevantes
  useRealtimeSubscription(
    ['matriculas', 'sesiones_clases', 'clases', 'cursos', 'estudiantes', 'tutores', 'movimientos_dinero', 'tesoreria_pagos'],
    fetchData,
  );

  useRealtimeSubscription(
    ['tutor_notas', 'tutor_notas_historial'],
    () => {
      if (tutorSeleccionado?.id) {
        void cargarTutorNotas(tutorSeleccionado.id, { silent: true });
      }
    },
    Boolean(tutorSeleccionado?.id),
  );

  const marcarSesionComoDada = useCallback(async (sesion: SesionDelDia) => {
    const sesionKey = getSesionKey(sesion);
    setCompletandoKeys(prev => ({ ...prev, [sesionKey]: true }));
    try {
      const hoyStr = new Date().toISOString().split('T')[0];
      // IMPORTANTE: usar la fecha "hoy" en zona Costa Rica para que coincida con la agenda.
      // El hoyStr basado en UTC puede caer en el día anterior/siguiente cerca de medianoche.
      const fechaToUse = sesion?.fecha || hoy || hoyStr;
      const result = await dashboardService.completarSesion(sesion.matricula_id, fechaToUse);

      applySessionLocalPatch(sesion, fechaToUse, {
        estado_sesion: 'dada',
        avisado: true,
        confirmado: true,
        fecha: fechaToUse,
      });
      setUiNotice({
        type: 'success',
        message: result?.message || 'Clase marcada como dada.'
      });

      window.setTimeout(() => { void fetchData(); }, 400);
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
  }, [applySessionLocalPatch, fetchData, getSesionKey, hoy]);

  const StatCard = ({ id, title, value, icon, accentColor, description }: any) => {
    const isOpen = statInfoOpen === id;
    return (
      <Card
        className="relative overflow-hidden hover:-translate-y-1 transition-all cursor-pointer border-white/10"
        onClick={() => setStatInfoOpen(isOpen ? null : id)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setStatInfoOpen(isOpen ? null : id);
          }
        }}
        role="button"
        tabIndex={0}
        title="Toca para ver la descripción"
      >
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
          {isOpen && description && (
            <div className="mt-2 text-[11px] text-slate-200 font-semibold leading-relaxed">
              {description}
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

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
              <div className="text-xs text-slate-300 mt-1">{getSessionParticipantLabel(confirmMarcarDada?.sesion)}</div>
              <div className="text-xs text-slate-400 mt-1">{formatTimeAmPm(confirmMarcarDada?.sesion.hora_inicio ?? '')} - {formatTimeAmPm(confirmMarcarDada?.sesion.hora_fin ?? '')}</div>
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
              <div className="text-xs text-slate-300 mt-1">{getSessionParticipantLabel(confirmCancelarHoy?.sesion)}</div>
              <div className="text-xs text-slate-400 mt-1">{formatTimeAmPm(confirmCancelarHoy?.sesion.hora_inicio ?? '')} - {formatTimeAmPm(confirmCancelarHoy?.sesion.hora_fin ?? '')}</div>
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
                  const fechaToUse = sesion?.fecha || hoy || hoyStr;
                  const motivo = (confirmCancelarHoy.motivo || '').trim();
                  if (!motivo) {
                    setUiNotice({ type: 'error', message: 'Escribe un motivo antes de cancelar.' });
                    return;
                  }
                  setConfirmCancelarHoy(null);
                  try {
                    await dashboardService.cancelarSesionDia(sesion.matricula_id, fechaToUse, motivo);
                    applySessionLocalPatch(sesion, fechaToUse, {
                      estado_sesion: 'cancelada',
                      fecha: fechaToUse,
                    });
                    setUiNotice({ type: 'success', message: 'Clase cancelada (solo por hoy).' });
                    window.setTimeout(() => { void fetchData(); }, 400);
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
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">{hoy ? new Date(hoy + 'T00:00:00').toLocaleDateString('es-CR') : '—'}</span>
              <div className="w-56 hidden md:block">
                <Input
                  value={sesionesHoyQuery}
                  onChange={(e) => {
                    setSesionesHoyQuery(e.target.value);
                    setSesionesHoyExpanded(false);
                  }}
                  placeholder="Buscar curso/estudiante/tutor…"
                  className="h-9"
                />
              </div>
            </div>
          </div>
          <Card className="border-white/10 bg-[#0F2445]">
            <CardContent className="pt-4">
              {(() => {
                const q = normalizeSearch(sesionesHoyQuery);
                const sesionesHoyOrdenadas = [...(sesionesHoy || [])].sort((a, b) => String(a.hora_inicio || '').localeCompare(String(b.hora_inicio || '')));
                const sesionesHoyFiltradas = !q
                  ? sesionesHoyOrdenadas
                  : sesionesHoyOrdenadas.filter((s) => {
                      const haystack = normalizeSearch(
                        [
                          s.curso_nombre,
                          s.estudiante_nombre,
                          s.tutor_nombre,
                          s.turno,
                          s.hora_inicio,
                          s.hora_fin,
                        ].filter(Boolean).join(' ')
                      );
                      return haystack.includes(q);
                    });

                const MAX_PREVIEW = 8;
                const total = sesionesHoyFiltradas.length;
                const mostrar = sesionesHoyExpanded ? sesionesHoyFiltradas : sesionesHoyFiltradas.slice(0, MAX_PREVIEW);
                const hayMas = total > MAX_PREVIEW;

                if ((sesionesHoy || []).length === 0) {
                  return (
                <div className="flex flex-col items-center justify-center py-6">
                  <Clock className="w-8 h-8 mb-2 text-slate-500" />
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest text-center">Sin sesiones hoy</p>
                </div>
                  );
                }

                if (total === 0) {
                  return (
                    <div className="flex flex-col items-center justify-center py-6">
                      <Clock className="w-8 h-8 mb-2 text-slate-500" />
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest text-center">No hay resultados</p>
                      <p className="text-[11px] text-slate-500 mt-1">Prueba con otro texto de búsqueda.</p>
                    </div>
                  );
                }

                return (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-[11px] text-slate-400 font-bold uppercase tracking-widest">
                        {sesionesHoyQuery ? `Resultados: ${total}` : `Total: ${total}`}
                        {!sesionesHoyExpanded && hayMas ? ` · Mostrando ${Math.min(MAX_PREVIEW, total)}` : ''}
                      </div>
                      {hayMas && (
                        <Button
                          size="sm"
                          className="h-8 text-[11px] px-3 bg-white/10 border border-white/15 hover:bg-white/15"
                          onClick={() => setSesionesHoyExpanded((v) => !v)}
                        >
                          {sesionesHoyExpanded ? 'Mostrar menos' : `Ver todas (${total})`}
                        </Button>
                      )}
                    </div>

                    <div
                      className={`grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3 ${sesionesHoyExpanded ? 'max-h-[560px] overflow-y-auto pr-1' : ''}`}
                    >
                      {mostrar.map((sesion, index) => {
                    const ahora = new Date();
                    const [hIni, mIni] = String(sesion.hora_inicio).split(':').map(Number);
                    const [hFin, mFin] = String(sesion.hora_fin).split(':').map(Number);
                    const finDate = new Date(); finDate.setHours(hFin || 0, mFin || 0, 0, 0);
                    const sesionKey = getSesionKey(sesion);
                    const isCompleting = !!completandoKeys[sesionKey];
                    const enCurso = isSesionEnCurso(sesion, hoy);
                    const matriculaInfo = getMatriculaFromSesion(sesion);
                    const pagoTipo = getPagoTipo(matriculaInfo, sesion);
                    const esMensual = pagoTipo === 'mensual';
                    const puedeMarcarDada = !esMensual && isFinite(hIni) && isFinite(mIni) && ahora >= finDate;
                        const hi = formatTimeAmPm(sesion.hora_inicio);
                        const hf = formatTimeAmPm(sesion.hora_fin);
                      const participantLabel = getSessionParticipantLabel(sesion);
                    return (
                          <div
                            key={`hoy-top-${sesion.matricula_id}-${index}`}
                            className="rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 transition-all group p-4 flex flex-col min-h-[170px]"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="text-sm font-black text-white group-hover:text-[#00AEEF] transition-colors truncate">
                                  {sesion.curso_nombre}
                                </p>
                                <p className="text-xs text-slate-400 mt-0.5 tabular-nums">{hi} - {hf}</p>
                              </div>
                              <button
                                onClick={() => abrirProgramacion(sesion, 'info')}
                                className="text-[#00AEEF] hover:text-white transition-colors p-1 rounded hover:bg-white/10 flex-shrink-0"
                                title="Ver detalles"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                              </button>
                            </div>

                            <div className="mt-3 space-y-1">
                              <p className="text-xs font-bold text-slate-200 whitespace-normal break-words">{participantLabel}</p>
                              <p className="text-[11px] text-slate-500 truncate">Tutor: {sesion.tutor_nombre || '—'}</p>
                            </div>

                            <div className="mt-3 flex items-center gap-2 flex-wrap">
                              <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-semibold ${
                                enCurso
                                  ? 'bg-cyan-500/20 text-cyan-200'
                                  : sesion.confirmado
                                  ? 'bg-emerald-400/20 text-emerald-300'
                                  : sesion.avisado
                                  ? 'bg-amber-300/15 text-amber-200'
                                  : 'bg-slate-600/30 text-slate-300'
                              }`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${
                                  enCurso ? 'bg-cyan-300' : sesion.confirmado ? 'bg-emerald-400' : sesion.avisado ? 'bg-amber-300' : 'bg-slate-400'
                                }`} />
                                {estadoSesionLabel(sesion, hoy)}
                              </span>
                            </div>

                            <div className="mt-auto pt-4 flex items-center justify-between gap-2 flex-wrap">
                              <div className="flex flex-col items-start gap-1">
                                <Button
                                  size="sm"
                                  className={`text-[11px] px-3 h-9 ${puedeMarcarDada ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : 'bg-white/10 text-slate-400 border border-white/10'}`}
                                  disabled={!puedeMarcarDada || isCompleting}
                                  onClick={async () => {
                                    if (!puedeMarcarDada) return;
                                    setConfirmMarcarDada({ sesion, sesionKey });
                                  }}
                                  title={esMensual ? 'Pago mensual: no se marca como dada desde aquí.' : 'Disponible al finalizar la sesión.'}
                                >
                                  {isCompleting ? 'Marcando...' : esMensual ? 'Pago mensual' : 'Marcar dada'}
                                </Button>
                                {esMensual && (
                                  <span className="text-[10px] text-amber-200/90">Mensual: no se marca por sesión.</span>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                <Button
                                  size="sm"
                                  className="text-[11px] px-3 h-9 bg-white/10 border border-white/15 hover:bg-white/15"
                                  onClick={() => abrirProgramacion(sesion, 'programar')}
                                >
                                  Programar
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  className="text-[11px] px-3 h-9"
                                  onClick={async () => {
                                    setConfirmCancelarHoy({ sesion, sesionKey, motivo: '' });
                                  }}
                                >
                                  Cancelar hoy
                                </Button>
                              </div>
                            </div>
                          </div>
                    );
                      })}
                    </div>
                  </div>
                );
              })()}
            </CardContent>
          </Card>
        </section>

        {/* Sesiones Pendientes de días pasados */}
        {sesionesPendientes.length > 0 && (
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-black text-white tracking-tight flex items-center gap-3">
                <AlertTriangle className="w-6 h-6 text-amber-400" />
                Sesiones Pendientes
                <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/30 text-xs">{sesionesPendientes.length}</Badge>
              </h2>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400">Días pasados sin marcar</span>
                <div className="w-56 hidden md:block">
                  <Input
                    value={pendientesQuery}
                    onChange={(e) => {
                      setPendientesQuery(e.target.value);
                      setPendientesExpanded(false);
                    }}
                    placeholder="Buscar curso/estudiante/tutor…"
                    className="h-9"
                  />
                </div>
              </div>
            </div>
            <Card className="border-amber-500/20 bg-[#0F2445]">
              <CardContent className="pt-4">
                {(() => {
                  const q = normalizeSearch(pendientesQuery);
                  const filtradas = !q
                    ? sesionesPendientes
                    : sesionesPendientes.filter((s) => {
                        const haystack = normalizeSearch(
                          [s.curso_nombre, s.estudiante_nombre, s.tutor_nombre, s._fecha].filter(Boolean).join(' ')
                        );
                        return haystack.includes(q);
                      });

                  const MAX_PREVIEW = 8;
                  const total = filtradas.length;
                  const mostrar = pendientesExpanded ? filtradas : filtradas.slice(0, MAX_PREVIEW);
                  const hayMas = total > MAX_PREVIEW;

                  if (total === 0) {
                    return (
                      <div className="flex flex-col items-center justify-center py-6">
                        <Clock className="w-8 h-8 mb-2 text-slate-500" />
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest text-center">No hay resultados</p>
                      </div>
                    );
                  }

                  return (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-[11px] text-amber-300/80 font-bold uppercase tracking-widest">
                          {pendientesQuery ? `Resultados: ${total}` : `Total: ${total}`}
                          {!pendientesExpanded && hayMas ? ` · Mostrando ${Math.min(MAX_PREVIEW, total)}` : ''}
                        </div>
                        {hayMas && (
                          <Button
                            size="sm"
                            className="h-8 text-[11px] px-3 bg-white/10 border border-white/15 hover:bg-white/15"
                            onClick={() => setPendientesExpanded((v) => !v)}
                          >
                            {pendientesExpanded ? 'Mostrar menos' : `Ver todas (${total})`}
                          </Button>
                        )}
                      </div>

                      <div
                        className={`grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3 ${pendientesExpanded ? 'max-h-[560px] overflow-y-auto pr-1' : ''}`}
                      >
                        {mostrar.map((sesion, index) => {
                          const sesionKey = `pending-${sesion.matricula_id}:${sesion._fecha}`;
                          const isCompleting = !!completandoKeys[sesionKey];
                          const fechaDisplay = new Date(sesion._fecha + 'T00:00:00').toLocaleDateString('es-CR', { weekday: 'short', day: 'numeric', month: 'short' });
                          const hi = formatTimeAmPm(sesion.hora_inicio);
                          const hf = formatTimeAmPm(sesion.hora_fin);
                          const esMensual = (sesion.curso_tipo_pago || '').toLowerCase() === 'mensual';
                          const participantLabel = getSessionParticipantLabel(sesion);
                          return (
                            <div
                              key={`pend-${sesion.matricula_id}-${sesion._fecha}-${index}`}
                              className="rounded-2xl border border-amber-500/20 bg-amber-500/5 hover:bg-amber-500/10 transition-all group p-4 flex flex-col min-h-[150px]"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <p className="text-sm font-black text-white group-hover:text-amber-300 transition-colors truncate">
                                    {sesion.curso_nombre}
                                  </p>
                                  <p className="text-xs text-amber-300/70 mt-0.5 font-semibold">{fechaDisplay}</p>
                                  {sesion.hora_inicio && sesion.hora_inicio !== '—' && (
                                    <p className="text-xs text-slate-400 mt-0.5 tabular-nums">{hi} - {hf}</p>
                                  )}
                                </div>
                                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-semibold bg-amber-400/15 text-amber-200 flex-shrink-0">
                                  <AlertTriangle className="w-3 h-3" />
                                  Pendiente
                                </span>
                              </div>

                              <div className="mt-3 space-y-1">
                                <p className="text-xs font-bold text-slate-200 whitespace-normal break-words">{participantLabel}</p>
                                <p className="text-[11px] text-slate-500 truncate">Tutor: {sesion.tutor_nombre || '—'}</p>
                              </div>

                              <div className="mt-auto pt-4 flex items-center gap-2 flex-wrap">
                                {!esMensual && (
                                  <Button
                                    size="sm"
                                    className="text-[11px] px-3 h-9 bg-emerald-600 hover:bg-emerald-700 text-white"
                                    disabled={isCompleting}
                                    onClick={() => {
                                      setConfirmMarcarDada({ sesion: { ...sesion, fecha: sesion._fecha }, sesionKey });
                                    }}
                                  >
                                    {isCompleting ? 'Marcando...' : 'Marcar dada'}
                                  </Button>
                                )}
                                {esMensual && (
                                  <span className="text-[10px] text-amber-200/90">Mensual: no se marca por sesión.</span>
                                )}
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  className="text-[11px] px-3 h-9"
                                  onClick={() => {
                                    setConfirmCancelarHoy({ sesion: { ...sesion, fecha: sesion._fecha }, sesionKey, motivo: '' });
                                  }}
                                >
                                  Cancelar
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}
              </CardContent>
            </Card>
          </section>
        )}

        {/* Calendario Mensual */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-black text-white tracking-tight flex items-center gap-3">
              <CalendarIcon className="w-6 h-6 text-[#00AEEF]" />
              Calendario de Clases
            </h2>

            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  const rows: { Fecha: string; Día: string; Alumno: string; Curso: string; Tutor: string; 'Hora Inicio': string; 'Hora Fin': string; Estado: string }[] = [];
                  const [eY, eM] = calMes.split('-').map(Number);
                  const dim = new Date(eY, eM, 0).getDate();
                  for (let d = 1; d <= dim; d++) {
                    const ds = `${eY}-${String(eM).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                    const ses = sesionesDelMes[ds] || [];
                    for (const s of ses) {
                      rows.push({
                        Fecha: ds,
                        Día: getDiaSemana(ds),
                        Alumno: s.estudiante_nombre,
                        Curso: s.curso_nombre,
                        Tutor: s.tutor_nombre,
                        'Hora Inicio': s.hora_inicio,
                        'Hora Fin': s.hora_fin,
                        Estado: s.estado_sesion === 'dada' ? 'Dada' : s.estado_sesion === 'cancelada' ? 'Cancelada' : 'Programada',
                      });
                    }
                  }
                  if (rows.length === 0) return;
                  const ws = XLSX.utils.json_to_sheet(rows);
                  const wb = XLSX.utils.book_new();
                  XLSX.utils.book_append_sheet(wb, ws, 'Calendario');
                  const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
                  saveAs(new Blob([buf], { type: 'application/octet-stream' }), `Calendario_${calMes}.xlsx`);
                }}
                className="h-9 px-3 flex items-center gap-1.5 bg-emerald-600/80 hover:bg-emerald-500 text-white text-xs font-bold rounded-md transition-colors"
                title="Exportar mes a Excel"
              >
                <Download className="w-4 h-4" />
                <span className="hidden md:inline">Excel</span>
              </button>
              <button
                onClick={exportCalendarPdf}
                className="h-9 px-3 flex items-center gap-1.5 bg-red-700/80 hover:bg-red-600 text-white text-xs font-bold rounded-md transition-colors"
                title="Exportar mes a PDF"
              >
                <Download className="w-4 h-4" />
                <span className="hidden md:inline">PDF</span>
              </button>
              <span className="hidden md:inline text-xs text-slate-400 font-bold uppercase tracking-widest">Tamaño</span>
              <Button
                size="sm"
                className="h-9 w-9 p-0 bg-white/10 border border-white/15 hover:bg-white/15"
                onClick={() => setCalendarDensity((v) => Math.max(0, v - 1))}
                title="Más compacto"
              >
                <Minus className="w-4 h-4" />
              </Button>
              <Button
                size="sm"
                className="h-9 w-9 p-0 bg-white/10 border border-white/15 hover:bg-white/15"
                onClick={() => setCalendarDensity((v) => Math.min(2, v + 1))}
                title="Más grande"
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          </div>

          <Card className="border-white/10 bg-[#0F2445]">
            <CardContent className="p-6">
              {(() => {
                const calendarMinHClass = calendarDensity === 0 ? 'min-h-24' : calendarDensity === 2 ? 'min-h-32' : 'min-h-28';
                const calendarPreviewCount = calendarDensity === 0 ? 2 : calendarDensity === 2 ? 4 : 3;
                const chipPad = calendarDensity === 0 ? 'px-1.5 py-0.5' : calendarDensity === 2 ? 'px-2 py-1' : 'px-1.5 py-1';

                const [calRenderY, calRenderM] = calMes.split('-').map(Number);
                const year = calRenderY;
                const month = calRenderM - 1;
                const firstDay = new Date(year, month, 1);
                const lastDay = new Date(year, month + 1, 0);
                const daysInMonth = lastDay.getDate();
                const startDay = firstDay.getDay(); // 0 = Domingo

                const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
                const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

                const days: (number | null)[] = [];
                for (let i = 0; i < startDay; i++) days.push(null);
                for (let d = 1; d <= daysInMonth; d++) days.push(d);

                const prevMonth = () => {
                  const [py, pm] = calMes.split('-').map(Number);
                  const d = new Date(py, pm - 2, 1);
                  setCalMes(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
                };
                const nextMonth = () => {
                  const [ny, nm] = calMes.split('-').map(Number);
                  const d = new Date(ny, nm, 1);
                  setCalMes(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
                };
                const isCurrentMonth = calMes === crToday.slice(0, 7);

                return (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <button onClick={prevMonth} className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors" title="Mes anterior"><ChevronLeft className="w-5 h-5" /></button>
                      <div className="flex items-center gap-2">
                        <h3 className="text-xl font-black text-white">{monthNames[month]} {year}</h3>
                        {!isCurrentMonth && (
                          <button onClick={() => setCalMes(crToday.slice(0, 7))} className="text-xs px-2 py-0.5 rounded bg-[#00AEEF]/20 text-[#00AEEF] hover:bg-[#00AEEF]/30 transition-colors">Hoy</button>
                        )}
                      </div>
                      <button onClick={nextMonth} className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors" title="Mes siguiente"><ChevronRight className="w-5 h-5" /></button>
                    </div>
                    <div className="grid grid-cols-7 gap-2">
                      {dayNames.map(day => (
                        <div key={day} className="text-center text-xs font-bold text-slate-400 uppercase tracking-widest py-2">
                          {day}
                        </div>
                      ))}
                      {days.map((day, index) => {
                        if (!day) return <div key={`empty-${index}`} className={calendarMinHClass} />;
                        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                        const isToday = dateStr === hoy;
                        const isSelected = selectedDate === dateStr;
                        const sesionesEnDia = getVisibleSesionesForDate(dateStr);
                        
                        const hasClasses = sesionesEnDia.length > 0;
                        const diaSemana = getDiaSemana(dateStr);
                        const diaCorto = diaSemana.slice(0, 3);
                        const countLabel = sesionesEnDia.length > 99 ? '99+' : String(sesionesEnDia.length);
                        const preview = (() => {
                          if (sesionesEnDia.length <= calendarPreviewCount) return sesionesEnDia;
                          const len = sesionesEnDia.length;
                          const start = (uiTick5s + day) % len;
                          const out: SesionDelDia[] = [];
                          for (let i = 0; i < calendarPreviewCount; i++) {
                            out.push(sesionesEnDia[(start + i) % len]);
                          }
                          return out;
                        })();
                        
                        return (
                          <button
                            key={day}
                            onClick={() => {
                              setSelectedDate(dateStr);
                              setSesionesDelDia(getVisibleSesionesForDate(dateStr));
                              setDayDetailQuery('');
                              setShowDayDetail(true);
                            }}
                            className={`${calendarMinHClass} rounded-lg border transition-all relative group flex flex-col p-2 overflow-hidden ${
                              isToday
                                ? 'bg-gradient-to-br from-[#00AEEF]/20 to-[#00AEEF]/10 border-[#00AEEF] shadow-lg shadow-[#00AEEF]/20'
                                : isSelected
                                ? 'bg-gradient-to-br from-[#FFC800]/20 to-[#FFC800]/10 border-[#FFC800] shadow-lg shadow-[#FFC800]/20'
                                : hasClasses
                                ? 'bg-white/5 border-white/20 hover:bg-white/10 hover:border-[#00AEEF]/50'
                                : 'bg-transparent border-white/5 text-slate-600'
                            } text-sm`}
                          >
                            {hasClasses && (
                              <span
                                className={`absolute top-1.5 right-1.5 text-[10px] font-black px-1.5 py-0.5 rounded min-w-6 text-center tabular-nums ${
                                  isToday ? 'bg-[#00AEEF]/30 text-[#00AEEF]' 
                                  : isSelected ? 'bg-[#FFC800]/30 text-[#FFC800]' 
                                  : 'bg-emerald-500/30 text-emerald-300'
                                }`}
                                title={`${sesionesEnDia.length} sesión(es) programada(s)`}
                              >
                                {countLabel}
                              </span>
                            )}

                            <div className="flex items-center justify-between mb-1.5">
                              <span className={`text-sm font-black ${
                                isToday ? 'text-[#00AEEF]' : isSelected ? 'text-[#FFC800]' : 'text-white'
                              }`}>
                                {day}
                              </span>
                            </div>
                            
                            {hasClasses && (
                              <div className="flex-1 flex flex-col gap-1 overflow-hidden">
                                {preview.map((sesion, idx) => {
                                  const enCurso = isSesionEnCurso(sesion, dateStr);
                                  const hi = formatTimeAmPm(sesion.hora_inicio);
                                  const hf = formatTimeAmPm(sesion.hora_fin);
                                  return (
                                  <div
                                    key={idx}
                                    className={`flex items-start gap-1 rounded-md border ${chipPad} ${
                                      isToday
                                        ? 'border-[#00AEEF]/25 bg-[#00AEEF]/10'
                                        : isSelected
                                        ? 'border-[#FFC800]/25 bg-[#FFC800]/10'
                                        : 'border-white/10 bg-white/5'
                                    }`}
                                    title={`${sesion.curso_nombre} · ${hi} - ${hf}`}
                                  >
                                    <span
                                      className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                                        enCurso
                                          ? 'bg-cyan-300'
                                          : isToday
                                          ? 'bg-[#00AEEF]'
                                          : isSelected
                                          ? 'bg-[#FFC800]'
                                          : 'bg-emerald-400'
                                      }`}
                                    />
                                    <span
                                      className={`flex-1 font-bold text-[10px] leading-tight whitespace-normal break-words ${
                                        enCurso
                                          ? 'text-cyan-100'
                                          : isToday
                                          ? 'text-[#00AEEF]'
                                          : isSelected
                                          ? 'text-[#FFC800]'
                                          : 'text-emerald-200'
                                      }`}
                                    >
                                      {sesion.curso_nombre}
                                    </span>
                                    <span
                                      className={`text-[9px] leading-none tabular-nums flex-shrink-0 ${
                                        enCurso
                                          ? 'text-cyan-200/80'
                                          : isToday
                                          ? 'text-[#00AEEF]/75'
                                          : isSelected
                                          ? 'text-[#FFC800]/75'
                                          : 'text-slate-400'
                                      }`}
                                    >
                                      {hi}
                                    </span>
                                  </div>
                                  );
                                })}

                                {sesionesEnDia.length > preview.length && (
                                  <div className="mt-0.5 flex items-center justify-between">
                                    <p
                                      className={`text-[9px] font-semibold ${
                                        isToday ? 'text-[#00AEEF]/70' : isSelected ? 'text-[#FFC800]/70' : 'text-slate-500'
                                      }`}
                                    >
                                      +{sesionesEnDia.length - preview.length} más
                                    </p>
                                    <p className="text-[9px] text-slate-500 font-bold">Ver</p>
                                  </div>
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
                    Resumen mensual en formato <span className="text-slate-200 font-bold">Debe</span>/<span className="text-slate-200 font-bold">Haber</span>.
                    En bolsa = Debe − Haber. Fuente: {metricas?.fuente || '—'}
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
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="text-sm font-black text-white">Real (solo movimientos completados/verificados)</div>
                    <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-4">
                        <div className="text-[11px] font-black text-emerald-200 uppercase tracking-widest">Debe (real)</div>
                        <div className="text-2xl font-black text-white mt-1">{formatCRC(metricas.real?.ingresos || 0)}</div>
                        <div className="text-xs text-emerald-200/80 mt-1">{metricas.fecha_inicio} a {metricas.fecha_fin}</div>
                      </div>
                      <div className="rounded-2xl border border-rose-400/20 bg-rose-500/10 p-4">
                        <div className="text-[11px] font-black text-rose-200 uppercase tracking-widest">Haber (real)</div>
                        <div className="text-2xl font-black text-white mt-1">{formatCRC(metricas.real?.pagos_tutores || 0)}</div>
                        <div className="text-xs text-rose-200/80 mt-1">Movimientos reales: {metricas.real?.movimientos || 0}</div>
                      </div>
                      <div className="rounded-2xl border border-cyan-400/20 bg-cyan-500/10 p-4">
                        <div className="text-[11px] font-black text-cyan-200 uppercase tracking-widest">En bolsa (real)</div>
                        <div className="text-2xl font-black text-white mt-1">{formatCRC(metricas.real?.neto || 0)}</div>
                        <div className="text-xs text-cyan-200/80 mt-1">En bolsa = Debe − Haber</div>
                      </div>
                    </div>
                    <div className="mt-4 text-[11px] text-slate-400 font-bold uppercase tracking-widest">
                      Diferencial (en bolsa esperado - real): {formatCRC(metricas.diferencial?.neto ?? 0)}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-black/10 p-4">
                    <div className="text-sm font-black text-white">Esperado (pendiente por registrar)</div>
                    <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-4">
                        <div className="text-[11px] font-black text-emerald-200 uppercase tracking-widest">Debe (esperado)</div>
                        <div className="text-2xl font-black text-white mt-1">{formatCRC((metricas.esperado?.ingresos ?? metricas.ingresos) || 0)}</div>
                        <div className="text-xs text-emerald-200/80 mt-1">{metricas.fecha_inicio} a {metricas.fecha_fin}</div>
                      </div>
                      <div className="rounded-2xl border border-rose-400/20 bg-rose-500/10 p-4">
                        <div className="text-[11px] font-black text-rose-200 uppercase tracking-widest">Haber (esperado)</div>
                        <div className="text-2xl font-black text-white mt-1">{formatCRC((metricas.esperado?.pagos_tutores ?? metricas.pagos_tutores) || 0)}</div>
                        <div className="text-xs text-rose-200/80 mt-1">Obligaciones: {(metricas.esperado?.movimientos ?? metricas.movimientos) || 0}</div>
                      </div>
                      <div className="rounded-2xl border border-cyan-400/20 bg-cyan-500/10 p-4">
                        <div className="text-[11px] font-black text-cyan-200 uppercase tracking-widest">En bolsa (esperado)</div>
                        <div className="text-2xl font-black text-white mt-1">{formatCRC((metricas.esperado?.neto ?? metricas.neto) || 0)}</div>
                        <div className="text-xs text-cyan-200/80 mt-1">En bolsa = Debe − Haber</div>
                      </div>
                    </div>
                  </div>

                  {/* Serie simple últimos 6 meses (toggle Real/Esperado) */}
                  {(chartHasReal || chartHasEsperado) && Array.isArray(chartSeries) && chartSeries.length > 0 ? (
                    <div className="rounded-2xl border border-white/10 bg-black/10 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-sm font-black text-white">Últimos 6 meses</div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            className={`px-3 py-1 rounded-lg text-[11px] font-black uppercase tracking-widest border ${chartShowReal ? 'bg-white/10 border-white/20 text-white' : 'bg-transparent border-white/10 text-slate-400'}`}
                            onClick={() => setChartModo('real')}
                            disabled={!chartHasReal}
                            title={!chartHasReal ? 'No hay datos reales para graficar.' : 'Ver serie real.'}
                          >
                            Real
                          </button>
                          <button
                            type="button"
                            className={`px-3 py-1 rounded-lg text-[11px] font-black uppercase tracking-widest border ${!chartShowReal ? 'bg-white/10 border-white/20 text-white' : 'bg-transparent border-white/10 text-slate-400'}`}
                            onClick={() => setChartModo('esperado')}
                            disabled={!chartHasEsperado}
                            title={!chartHasEsperado ? 'No hay datos esperados para graficar.' : 'Ver serie esperada.'}
                          >
                            Esperado
                          </button>
                          <div className="text-[11px] text-slate-400 font-bold uppercase tracking-widest ml-2">
                            {chartShowReal ? 'Real: Debe vs Haber' : 'Esperado: Debe vs Haber'}
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 grid grid-cols-6 gap-2 items-end">
                        {chartSeries.map((it) => {
                          const ing = Number(it.ingresos) || 0;
                          const egr = Number(it.egresos) || 0;
                          const hIng = Math.max(2, Math.round((Math.abs(ing) / chartMaxAbs) * 80));
                          const hEgr = Math.max(2, Math.round((Math.abs(egr) / chartMaxAbs) * 80));
                          const isReal = chartShowReal;
                          return (
                            <div key={it.mes} className="flex flex-col items-center gap-2">
                              <div className="w-full flex items-end justify-center gap-1 h-[90px]">
                                <div
                                  className={`w-4 rounded-md border ${isReal ? 'bg-emerald-200/70 border-emerald-200/30' : 'bg-emerald-400/70 border-emerald-400/30'}`}
                                  style={{ height: `${hIng}px` }}
                                  title={`${isReal ? 'Debe real' : 'Debe esperado'}: ${formatCRC(ing)}`}
                                />
                                <div
                                  className={`w-4 rounded-md border ${isReal ? 'bg-rose-200/70 border-rose-200/30' : 'bg-rose-400/70 border-rose-400/30'}`}
                                  style={{ height: `${hEgr}px` }}
                                  title={`${isReal ? 'Haber real' : 'Haber esperado'}: ${formatCRC(egr)}`}
                                />
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
                      <div className="text-sm font-black text-white">Top pagos a tutores (Haber real)</div>
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
            id="tutores"
            title="Tutores Activos" 
            value={stats?.tutores_activos || 0} 
            icon={<Users className="w-5 h-5" style={{color: '#051026'}} />} 
            accentColor="bg-[#FFC800] text-[#051026]"
            description="Tutores con estado activo registrados en el sistema."
          />
          <StatCard 
            id="estudiantes"
            title="Estudiantes" 
            value={stats?.estudiantes_activos || 0} 
            icon={<GraduationCap className="w-5 h-5" style={{color: '#051026'}} />} 
            accentColor="bg-[#00AEEF] text-[#051026]"
            description="Estudiantes activos registrados actualmente."
          />
          <StatCard 
            id="cursos"
            title="Cursos" 
            value={stats?.cursos_activos || 0} 
            icon={<BookOpen className="w-5 h-5" style={{color: '#051026'}} />} 
            accentColor="bg-[#FFC800] text-[#051026]"
            description="Cursos activos disponibles y con programación vigente."
          />
          <StatCard 
            id="matriculas"
            title="Matrículas" 
            value={stats?.matriculas_activas || 0} 
            icon={<ClipboardList className="w-5 h-5" style={{color: '#051026'}} />} 
            accentColor="bg-[#00AEEF] text-[#051026]"
            description="Matrículas activas en este momento."
          />
          <StatCard 
            id="sesiones-mes"
            title="Sesiones del Mes" 
            value={totalSesionesMes} 
            icon={<Award className="w-5 h-5" style={{color: '#051026'}} />} 
            accentColor="bg-[#FFC800] text-[#051026]"
            description="Sesiones programadas dentro del mes actual."
          />
          <StatCard 
            id="ingresos"
            title="Dinero ingresado total" 
            value={formatCRC(stats?.ingresos_pendientes ?? 0)} 
            icon={<CreditCard className="w-5 h-5" style={{color: '#051026'}} />} 
            accentColor="bg-[#00AEEF] text-[#051026]"
            description="Monto total registrado como ingreso pendiente."
          />
        </div>
      </div>

      {/* Sidebar derecha - 30% */}
      <aside className="w-[30%] space-y-6 sticky top-24 self-start page-sidebar-scroll">
        {programacionSesion && (
          <Card className="border-white/10 bg-[#0F2445] overflow-hidden">
            <div className="h-1.5 bg-[#FFC800]/45" />
            <CardHeader className="border-b border-white/10 bg-white/5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <CardTitle className="text-white text-base truncate">{programacionSesion.sesion.curso_nombre}</CardTitle>
                  <CardDescription className="text-slate-400 mt-1 text-xs">
                    {formatTimeAmPm(programacionSesion.sesion.hora_inicio)} - {formatTimeAmPm(programacionSesion.sesion.hora_fin)}
                  </CardDescription>
                </div>
                <button
                  onClick={cerrarProgramacion}
                  className="text-slate-200 hover:text-white transition-colors p-1.5 rounded-full bg-white/10 border border-[#FFC800]/30 hover:bg-[#FFC800]/12 hover:border-[#FFC800]/45"
                  aria-label="Cerrar"
                  title="Cerrar"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              {(() => {
                const fechaRef = programacionSesion.sesion.fecha || hoy;
                const diaLabel = fechaRef ? new Date(fechaRef + 'T00:00:00').toLocaleDateString('es-CR', { weekday: 'long', day: 'numeric', month: 'long' }) : '—';
                const grupoInfo = getGrupoInfoForSession(programacionSesion.sesion);
                const matriculaInfo = getMatriculaFromSesion(programacionSesion.sesion);
                const pagoTipo = getPagoTipo(matriculaInfo, programacionSesion.sesion);
                const pagoLabel = pagoTipo === 'mensual' ? 'Pago mensual' : pagoTipo === 'sesion' ? 'Pago por sesión' : '—';

                return (
                  <>
                    <div className="grid grid-cols-1 gap-2">
                      <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                        <div className="text-[11px] text-slate-400 font-semibold">Fecha</div>
                        <div className="text-sm font-bold text-white mt-1">{diaLabel}</div>
                      </div>
                      <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                        <div className="text-[11px] text-slate-400 font-semibold">Tutor</div>
                        <div className="text-sm font-bold text-white mt-1">{programacionSesion.sesion.tutor_nombre || '—'}</div>
                      </div>
                      <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                        <div className="text-[11px] text-slate-400 font-semibold">Estudiante / Grupo</div>
                        <div className="text-sm font-bold text-white mt-1">{getSessionParticipantLabel(programacionSesion.sesion)}</div>
                        {grupoInfo.isGrupo && (
                          <div className="text-[11px] text-slate-300 mt-1">
                            Grupo: {grupoInfo.nombre}{grupoInfo.count ? ` (${grupoInfo.count})` : ''}
                          </div>
                        )}
                        {grupoInfo.isGrupo && grupoInfo.nombres.length > 0 && (
                          <div className="text-[11px] text-slate-400 mt-1">{grupoInfo.nombres.join(', ')}</div>
                        )}
                      </div>
                      <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                        <div className="text-[11px] text-slate-400 font-semibold">Tipo de pago</div>
                        <div className="text-sm font-bold text-white mt-1">{pagoLabel}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-[11px]">
                      {(() => {
                        const label = estadoSesionLabel(programacionSesion.sesion, hoy);
                        const cls = label === 'Confirmada'
                          ? 'border-emerald-400 text-emerald-300 bg-emerald-400/10'
                          : label === 'En espera'
                          ? 'border-amber-300 text-amber-200 bg-amber-300/10'
                          : label === 'En curso'
                          ? 'border-cyan-300 text-cyan-200 bg-cyan-400/10'
                          : 'border-slate-500 text-slate-300 bg-slate-700/30';
                        return (
                          <span className={`px-2 py-0.5 rounded-full border ${cls}`}>{label}</span>
                        );
                      })()}
                    </div>
                  </>
                );
              })()}

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
                      await openWhatsApp(telefonoEncargado(programacionSesion.sesion), mensajeWA);
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
                  <div className="inline-flex rounded-xl border border-white/10 bg-white/5 p-1 gap-1">
                    <Button
                      size="sm"
                      className={`h-8 text-[11px] px-3 rounded-lg ${
                        !programacionSesion.sesion.confirmado
                          ? 'bg-amber-500/25 text-amber-200 border border-amber-400/30'
                          : 'bg-transparent text-slate-300 hover:bg-white/10 border border-transparent'
                      }`}
                      onClick={() => cambiarEstadoSesion(programacionSesion.sesion, true, false)}
                    >
                      En espera
                    </Button>
                    <Button
                      size="sm"
                      className={`h-8 text-[11px] px-3 rounded-lg ${
                        programacionSesion.sesion.confirmado
                          ? 'bg-emerald-600 text-white'
                          : 'bg-transparent text-slate-300 hover:bg-white/10 border border-transparent'
                      }`}
                      onClick={() => cambiarEstadoSesion(programacionSesion.sesion, true, true)}
                    >
                      Confirmada
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}
        {/* Detalle del Día Seleccionado */}
        {showDayDetail && (
          <Card className="border-white/10 bg-[#0F2445] overflow-hidden">
            <div className="h-1.5 bg-[#FFC800]/45" />
            <CardHeader className="border-b border-white/10 bg-white/5">
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
                    {(() => {
                      const q = normalizeSearch(dayDetailQuery);
                      const filtered = !q
                        ? (sesionesDelDia || [])
                        : (sesionesDelDia || []).filter((s) => {
                            const haystack = normalizeSearch([
                              s.curso_nombre,
                              s.estudiante_nombre,
                              s.tutor_nombre,
                              s.turno,
                              s.hora_inicio,
                              s.hora_fin,
                            ].filter(Boolean).join(' '));
                            return haystack.includes(q);
                          });
                      const total = (sesionesDelDia || []).length;
                      return q ? `${filtered.length}/${total} sesión(es)` : `${total} sesión(es) programada(s)`;
                    })()}
                  </CardDescription>
                </div>
                <button 
                  onClick={() => {
                    setShowDayDetail(false);
                    setDayDetailQuery('');
                  }}
                  className="text-slate-200 hover:text-white transition-colors p-1.5 rounded-full bg-white/10 border border-[#FFC800]/30 hover:bg-[#FFC800]/12 hover:border-[#FFC800]/45"
                  aria-label="Cerrar"
                  title="Cerrar"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="mt-3">
                <Input
                  value={dayDetailQuery}
                  onChange={(e) => setDayDetailQuery(e.target.value)}
                  placeholder="Filtrar (curso/estudiante/tutor)…"
                  className="h-9"
                />
              </div>
            </CardHeader>
            <CardContent className="pt-4">
              {(() => {
                const q = normalizeSearch(dayDetailQuery);
                const sesionesOrdenadas = [...(sesionesDelDia || [])].sort((a, b) => String(a.hora_inicio || '').localeCompare(String(b.hora_inicio || '')));
                const sesionesFiltradas = !q
                  ? sesionesOrdenadas
                  : sesionesOrdenadas.filter((s) => {
                      const haystack = normalizeSearch([
                        s.curso_nombre,
                        s.estudiante_nombre,
                        s.tutor_nombre,
                        s.turno,
                        s.hora_inicio,
                        s.hora_fin,
                      ].filter(Boolean).join(' '));
                      return haystack.includes(q);
                    });

                if ((sesionesDelDia || []).length === 0) {
                  return (
                <div className="flex flex-col items-center justify-center py-6 text-center">
                  <Clock className="w-8 h-8 mb-2 text-slate-500" />
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Sin sesiones</p>
                </div>
                  );
                }

                if (sesionesFiltradas.length === 0) {
                  return (
                    <div className="flex flex-col items-center justify-center py-6 text-center">
                      <Clock className="w-8 h-8 mb-2 text-slate-500" />
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">No hay resultados</p>
                      <p className="text-[11px] text-slate-500 mt-1">Prueba con otro filtro.</p>
                    </div>
                  );
                }

                return (
                  <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
                    {sesionesFiltradas.map((sesion, index) => {
                      const enCurso = isSesionEnCurso(sesion, selectedDate);
                      const hi = formatTimeAmPm(sesion.hora_inicio);
                      const hf = formatTimeAmPm(sesion.hora_fin);
                      return (
                    <div key={`detail-${sesion.matricula_id}-${index}`} className="w-full p-3 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition-all">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div>
                          <p className="text-sm font-bold text-white">{sesion.curso_nombre}</p>
                          <p className="text-xs text-[#00AEEF] font-semibold mt-0.5">{hi} - {hf}</p>
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
                        <p className="whitespace-normal break-words"><span className="font-semibold text-slate-200">{getSessionParticipantLabel(sesion)}</span></p>
                        <p className="text-slate-500 text-[11px]">Docente: {sesion.tutor_nombre}</p>
                        <div className="flex items-center gap-2 text-[11px]">
                          {sesion.estado_sesion === 'dada' ? (
                            <span className="px-2 py-0.5 rounded-full border text-[10px] border-emerald-400 text-emerald-300 bg-emerald-400/10">
                              Dada
                            </span>
                          ) : sesion.estado_sesion === 'cancelada' ? (
                            <span className="px-2 py-0.5 rounded-full border text-[10px] border-red-400 text-red-300 bg-red-400/10">
                              Cancelada
                            </span>
                          ) : enCurso ? (
                            <span className="px-2 py-0.5 rounded-full border text-[10px] border-cyan-300 text-cyan-200 bg-cyan-400/10">
                              En curso
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full border text-[10px] border-amber-300 text-amber-200 bg-amber-300/10">
                              Futura
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2 mt-3 text-[11px]">
                        <Button
                          size="sm"
                          className="h-7 text-[11px] px-2 bg-white/10 border border-white/15 hover:bg-white/15"
                          onClick={() => openWhatsApp(telefonoTutor(sesion))}
                        >
                          Chat tutor
                        </Button>
                        <Button
                          size="sm"
                          className="h-7 text-[11px] px-2 bg-white/10 border border-white/15 hover:bg-white/15"
                          onClick={() => openWhatsApp(telefonoEncargado(sesion))}
                        >
                          Chat encargados
                        </Button>
                      </div>
                    </div>
                      );
                    })}
                  </div>
                );
              })()}
            </CardContent>
          </Card>
        )}

        {programacionSesion?.modo === 'programar' && (
          <div className="fixed inset-0 bg-black/60 flex items-start justify-center z-[120] p-4 overflow-y-auto">
            <Card className="bg-[#0F2445] border border-white/10 w-full max-w-lg max-h-[85vh] rounded-2xl shadow-2xl flex flex-col my-6 overflow-hidden">
              <div className="h-1.5 bg-[#FFC800]/45" />
              <div className="flex items-start justify-between p-5 border-b border-white/10 bg-white/5">
                <div>
                  <CardTitle className="text-white text-base">{programacionSesion.sesion.curso_nombre}</CardTitle>
                  <p className="text-xs text-slate-400 mt-1">{formatTimeAmPm(programacionSesion.sesion.hora_inicio)} - {formatTimeAmPm(programacionSesion.sesion.hora_fin)}</p>
                </div>
                <button
                  onClick={cerrarProgramacion}
                  className="text-slate-200 hover:text-white transition-colors p-1.5 rounded-full bg-white/10 border border-[#FFC800]/30 hover:bg-[#FFC800]/12 hover:border-[#FFC800]/45"
                  aria-label="Cerrar"
                  title="Cerrar"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>

              <div className="p-5 space-y-4 flex-1 overflow-y-auto text-slate-100">
                <div className="space-y-1">
                  <p className="text-sm font-semibold">{getSessionParticipantLabel(programacionSesion.sesion)}</p>
                  <p className="text-[11px] text-slate-400">Docente: {programacionSesion.sesion.tutor_nombre}</p>
                  <div className="flex items-center gap-2 text-[11px]">
                    {(() => {
                      const label = estadoSesionLabel(programacionSesion.sesion, hoy);
                      const cls = label === 'Confirmada'
                        ? 'border-emerald-400 text-emerald-300 bg-emerald-400/10'
                        : label === 'En espera'
                        ? 'border-amber-300 text-amber-200 bg-amber-300/10'
                        : label === 'En curso'
                        ? 'border-cyan-300 text-cyan-200 bg-cyan-400/10'
                        : 'border-slate-500 text-slate-300 bg-slate-700/30';
                      return (
                        <span className={`px-2 py-0.5 rounded-full border ${cls}`}>{label}</span>
                      );
                    })()}
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
                        await openWhatsApp(telefonoEncargado(programacionSesion.sesion), mensajeWA);
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

                <div className="space-y-2">
                  <p className="text-[11px] text-slate-400 font-semibold">Estado</p>
                  <div className="inline-flex rounded-xl border border-white/10 bg-white/5 p-1 gap-1">
                    <Button
                      size="sm"
                      className={`h-8 text-[11px] px-3 rounded-lg ${
                        !programacionSesion.sesion.confirmado
                          ? 'bg-amber-500/25 text-amber-200 border border-amber-400/30'
                          : 'bg-transparent text-slate-300 hover:bg-white/10 border border-transparent'
                      }`}
                      onClick={() => cambiarEstadoSesion(programacionSesion.sesion, true, false)}
                    >
                      En espera
                    </Button>
                    <Button
                      size="sm"
                      className={`h-8 text-[11px] px-3 rounded-lg ${
                        programacionSesion.sesion.confirmado
                          ? 'bg-emerald-600 text-white'
                          : 'bg-transparent text-slate-300 hover:bg-white/10 border border-transparent'
                      }`}
                      onClick={() => cambiarEstadoSesion(programacionSesion.sesion, true, true)}
                    >
                      Confirmada
                    </Button>
                  </div>
                </div>
              </div>

              <div className="p-5 border-t border-white/10 flex justify-end bg-[#0F2445]">
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
            <Card className="bg-[#0F2445] border border-white/10 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden">
              <div className="h-1.5 bg-[#FFC800]/45" />
              <div className="flex items-start justify-between p-5 border-b border-white/10 bg-white/5">
                <div>
                  <CardTitle className="text-base font-bold text-white">{detalleMatricula.curso_nombre}</CardTitle>
                  <p className="text-xs text-slate-400 mt-1">Docente: {detalleMatricula.tutor_nombre}</p>
                </div>
                <button
                  onClick={() => setDetalleMatricula(null)}
                  className="text-slate-200 hover:text-white transition-colors p-1.5 rounded-full bg-white/10 border border-[#FFC800]/30 hover:bg-[#FFC800]/12 hover:border-[#FFC800]/45"
                  aria-label="Cerrar"
                  title="Cerrar"
                >
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
                  <div className="p-2.5 rounded-lg bg-white/5 border border-white/10">
                    <p className="text-[10px] text-slate-400 mb-0.5">Método</p>
                    <p className="text-xs font-semibold text-white">{detalleMatricula.curso_metodo || '-'}</p>
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
                <CardTitle className="text-white text-base">{tutorSeleccionado.nombre}</CardTitle>
                <button onClick={() => { setTutorSeleccionado(null); setAlumnosTutor([]); setTutorMatriculas([]); setTutorNotaDraft(''); setTutorNotaEditId(null); setTutorNotaEditText(''); setTutorHistorialOpen(false); }} className="text-slate-400 hover:text-white transition-colors">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="flex gap-1 mt-3">
                <button
                  onClick={() => setTutorTab('alumnos')}
                  className={`ui-tab-trigger text-[11px] font-bold px-3 py-1.5 rounded-md transition-colors ${tutorTab === 'alumnos' ? 'bg-white/15 text-white border border-white/20' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
                >
                  Alumnos
                </button>
                <button
                  onClick={() => setTutorTab('clases')}
                  className={`ui-tab-trigger text-[11px] font-bold px-3 py-1.5 rounded-md transition-colors ${tutorTab === 'clases' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
                >
                  Clases {(() => { const [, cm] = tutorMes.split('-').map(Number); return ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'][cm - 1]; })()}
                </button>
              </div>
            </CardHeader>
            <CardContent className="pt-4">
              <div key={tutorTab} className="ui-tab-panel-transition">
              {tutorTab === 'alumnos' ? (() => {
                const items = (tutorMatriculas || []).filter((m) => (m?.tutor_id === tutorSeleccionado.id) && m.estado !== 0);
                if (items.length === 0) {
                  return <div className="text-xs text-slate-400">Sin alumnos asociados</div>;
                }

                const gruposMap = new Map<string, { key: string; curso_nombre: string; grupo_nombre: string; sample: Matricula; miembros: { id: number; nombre: string }[] }>();
                const individuales: Matricula[] = [];

                for (const m of items) {
                  if (m.es_grupo && m.grupo_nombre) {
                    const key = `${m.curso_id}::${m.grupo_nombre}`;
                    if (!gruposMap.has(key)) {
                      gruposMap.set(key, {
                        key,
                        curso_nombre: m.curso_nombre || 'Curso',
                        grupo_nombre: m.grupo_nombre || 'Grupo',
                        sample: m,
                        miembros: [],
                      });
                    }
                    const g = gruposMap.get(key)!;
                    // Matrículas grupales pueden venir como 1 sola fila con estudiante_id=null y estudiante_ids=[...]
                    const ids = Array.isArray((m as any)?.estudiante_ids)
                      ? (m as any).estudiante_ids
                      : (m.estudiante_id ? [m.estudiante_id] : []);
                    for (const id of ids) {
                      if (!id) continue;
                      const e = (estudiantesMapa as any)?.[id];
                      g.miembros.push({
                        id,
                        nombre: String(e?.nombre || m.estudiante_nombre || `Alumno ${id}`),
                      });
                    }
                  } else {
                    individuales.push(m);
                  }
                }

                const grupos = Array.from(gruposMap.values())
                  .map((g) => ({
                    ...g,
                    miembros: g.miembros
                      .filter((x, idx, arr) => arr.findIndex((y) => y.id === x.id) === idx)
                      .sort((a, b) => a.nombre.localeCompare(b.nombre)),
                  }))
                  .sort((a, b) => `${a.curso_nombre} ${a.grupo_nombre}`.localeCompare(`${b.curso_nombre} ${b.grupo_nombre}`));

                const individualesOrdenados = [...individuales]
                  .sort((a, b) => {
                    const ca = `${a.curso_nombre || ''}`;
                    const cb = `${b.curso_nombre || ''}`;
                    if (ca !== cb) return ca.localeCompare(cb);
                    return `${a.estudiante_nombre || ''}`.localeCompare(`${b.estudiante_nombre || ''}`);
                  });

                const cursosUnicos = new Set(items.map((m) => m.curso_id).filter(Boolean)).size;
                const totalGrupos = grupos.length;
                const totalInd = individualesOrdenados.length;

                return (
                  <div className="space-y-4">
                    <div className="text-[11px] text-slate-400 font-black uppercase tracking-widest">
                      Cursos: {cursosUnicos} · Matrículas: {items.length} · Grupos: {totalGrupos} · Individuales: {totalInd}
                    </div>

                    {grupos.length > 0 && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="text-xs font-black text-slate-200 uppercase tracking-widest">Grupos</div>
                          <div className="text-[11px] font-bold text-slate-400">{grupos.length}</div>
                        </div>
                        <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
                          {grupos.map((g) => (
                            <div key={g.key} className="rounded-xl border border-white/10 bg-white/5 p-3">
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="text-sm font-black text-white whitespace-normal break-words">{g.grupo_nombre}</div>
                                  <div className="text-[11px] text-slate-400 mt-0.5 whitespace-normal break-words">{g.curso_nombre}</div>
                                  <div className="mt-1 text-[10px] font-bold text-[#FFC800] bg-[#FFC800]/15 px-2 py-0.5 rounded-full inline-flex border border-[#FFC800]/25">
                                    Miembros: {g.miembros.length}
                                  </div>
                                </div>
                                <Button
                                  size="sm"
                                  className="h-8 text-[11px] px-3 bg-white/10 border border-white/15 hover:bg-white/15 flex-shrink-0"
                                  onClick={() => cargarDetalleMatricula(g.sample.id)}
                                >
                                  Detalles
                                </Button>
                              </div>

                              <div className="mt-2">{renderHorarioBadges(g.sample)}</div>

                              {g.miembros.length > 0 && (
                                <div className="mt-3 flex flex-wrap gap-2">
                                  {g.miembros.map((m) => (
                                    <span
                                      key={m.id}
                                      className="text-[11px] font-semibold text-slate-200 bg-white/5 border border-white/10 px-2 py-1 rounded-full"
                                    >
                                      {m.nombre}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="text-xs font-black text-slate-200 uppercase tracking-widest">Individuales</div>
                        <div className="text-[11px] font-bold text-slate-400">{individualesOrdenados.length}</div>
                      </div>

                      {individualesOrdenados.length === 0 ? (
                        <div className="text-xs text-slate-400">Sin clases individuales</div>
                      ) : (
                        <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
                          {individualesOrdenados.map((m) => (
                            <div key={m.id} className="rounded-xl border border-white/10 bg-white/5 p-3">
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="text-sm font-black text-white whitespace-normal break-words">{m.estudiante_nombre || `Alumno ${m.estudiante_id}`}</div>
                                  <div className="text-[11px] text-slate-400 mt-0.5 whitespace-normal break-words">{m.curso_nombre || 'Curso'}</div>
                                </div>
                                <Button
                                  size="sm"
                                  className="h-8 text-[11px] px-3 bg-white/10 border border-white/15 hover:bg-white/15 flex-shrink-0"
                                  onClick={() => cargarDetalleMatricula(m.id)}
                                >
                                  Detalles
                                </Button>
                              </div>
                              <div className="mt-2">{renderHorarioBadges(m)}</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })() : (() => {
                if (tutorMonthView.sortedDates.length === 0) {
                  return (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <span className="text-[12px] font-bold text-slate-300">Mes:</span>
                        <input
                          type="month"
                          value={tutorMes}
                          onChange={(e) => setTutorMes(e.target.value || calMes)}
                          className="h-8 px-2 rounded-md bg-white/10 border border-white/15 text-xs text-white"
                        />
                        <button
                          onClick={() => setTutorMes(calMes)}
                          className="h-8 px-2.5 rounded-md text-[11px] font-bold bg-white/10 border border-white/15 text-slate-200 hover:bg-white/15"
                        >
                          Usar mes calendario
                        </button>
                      </div>
                      <div className="text-sm text-slate-400 text-center py-4">Sin clases en {tutorMonthView.mNames[tutorMonthView.cm - 1]} {tutorMonthView.cy}</div>
                    </div>
                  );
                }
                return (
                  <div className="space-y-3.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[12px] font-bold text-slate-300">Mes:</span>
                      <input
                        type="month"
                        value={tutorMes}
                        onChange={(e) => setTutorMes(e.target.value || calMes)}
                        className="h-8 px-2 rounded-md bg-white/10 border border-white/15 text-xs text-white"
                      />
                      <button
                        onClick={() => setTutorMes(calMes)}
                        className="h-8 px-2.5 rounded-md text-[11px] font-bold bg-white/10 border border-white/15 text-slate-200 hover:bg-white/15"
                      >
                        Usar mes calendario
                      </button>
                    </div>
                    <div className="flex gap-3 text-[12px] font-bold flex-wrap">
                      <span className="text-emerald-400">Dadas: {tutorMonthView.totD}</span>
                      <span className="text-red-400">Canceladas: {tutorMonthView.totC}</span>
                      <span className="text-slate-400">Pendientes: {tutorMonthView.totP}</span>
                      <span className="text-white ml-auto">Total: {tutorMonthView.totD + tutorMonthView.totC + tutorMonthView.totP}</span>
                    </div>
                    <div className="space-y-2.5 max-h-[520px] overflow-y-auto pr-1">
                      {tutorMonthView.sortedDates.map((dateStr) => {
                        const parts = dateStr.split('-').map(Number);
                        const dateObj = new Date(parts[0], parts[1] - 1, parts[2]);
                        const dayName = tutorMonthView.dayNames[dateObj.getDay()];
                        const sessions = tutorMonthView.byDate.get(dateStr)!;
                        return (
                          <div key={dateStr} className="rounded-xl border border-white/10 bg-white/5 overflow-hidden">
                            <div className="px-3 py-2 bg-white/5 border-b border-white/10 flex items-center gap-2">
                              <span className="text-sm font-black text-white">{parts[2]} {tutorMonthView.mNames[parts[1] - 1].slice(0, 3)}</span>
                              <span className="text-[11px] text-slate-300 uppercase font-bold">{dayName}</span>
                              <span className="ml-auto text-[11px] text-slate-400">{sessions.length} clase{sessions.length !== 1 ? 's' : ''}</span>
                            </div>
                            <div className="divide-y divide-white/5">
                              {sessions.map((s, i) => (
                                <div key={i} className="px-3 py-2.5 flex items-center gap-2">
                                  <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${s.estado_sesion === 'dada' ? 'bg-emerald-400' : s.estado_sesion === 'cancelada' ? 'bg-red-400' : 'bg-slate-400'}`} />
                                  <div className="min-w-0 flex-1">
                                    <div className="text-sm font-bold text-white whitespace-normal break-words leading-tight">{getSessionParticipantLabel(s)}</div>
                                    <div className="text-xs text-slate-300 whitespace-normal break-words leading-tight mt-0.5">{s.curso_nombre}</div>
                                  </div>
                                  <div className="flex-shrink-0 text-right">
                                    {(s.hora_inicio || s.hora_fin) && (
                                      <div className="text-[11px] text-slate-200 font-bold">{s.hora_inicio?.slice(0, 5)}–{s.hora_fin?.slice(0, 5)}</div>
                                    )}
                                    <div className={`text-[11px] font-bold ${s.estado_sesion === 'dada' ? 'text-emerald-400' : s.estado_sesion === 'cancelada' ? 'text-red-400' : 'text-slate-300'}`}>
                                      {s.estado_sesion === 'dada' ? 'Dada' : s.estado_sesion === 'cancelada' ? 'Cancelada' : 'Pendiente'}
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="border-white/10 bg-[#0F2445]">
          <CardHeader>
            <CardTitle className="text-lg text-white">Notas Internas del Equipo</CardTitle>
            <CardDescription className="text-xs text-slate-300">Bitácora colaborativa en tiempo real escrita por empleados sobre este tutor</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!tutorSeleccionado ? (
              <div className="text-xs text-slate-400 text-center py-4">Selecciona un tutor para gestionar notas colaborativas.</div>
            ) : (
              <>
                <div className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">
                  Tutor en seguimiento: <span className="text-white">{tutorSeleccionado.nombre}</span>
                </div>

                <div className="flex flex-col gap-2">
                  <textarea
                    value={tutorNotaDraft}
                    onChange={(e) => setTutorNotaDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        void crearTutorNota();
                      }
                    }}
                    placeholder="Escribe una nota interna del equipo sobre este tutor (Enter para guardar, Shift+Enter para salto de línea)..."
                    className="w-full min-h-[90px] rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#00AEEF]/50"
                  />
                  <div className="flex justify-end">
                    <Button
                      size="sm"
                      variant="primary"
                      className="bg-[#00AEEF] hover:bg-[#00AEEF]/85 text-[#051026] font-bold"
                      onClick={() => void crearTutorNota()}
                      disabled={tutorNotaSaving || !tutorNotaDraft.trim()}
                    >
                      {tutorNotaSaving ? 'Guardando...' : 'Guardar nota'}
                    </Button>
                  </div>
                </div>

                {tutorNotasLoading ? (
                  <div className="text-xs text-slate-400">Cargando notas...</div>
                ) : tutorNotas.length === 0 ? (
                  <div className="text-xs text-slate-400">Aún no hay notas registradas para este tutor.</div>
                ) : (
                  <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
                    {tutorNotas.map((nota) => {
                      const busy = Boolean(tutorNotaBusy[nota.id]);
                      const editing = tutorNotaEditId === nota.id;
                      const actorName = nota.actualizado_por_nombre || nota.creado_por_nombre || 'Equipo';
                      return (
                        <div
                          key={nota.id}
                          className={`rounded-xl border p-3 ${nota.estado === 'hecha' ? 'bg-emerald-500/10 border-emerald-400/25' : 'bg-white/5 border-white/10'}`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${nota.estado === 'hecha' ? 'text-emerald-200 border-emerald-400/30 bg-emerald-500/10' : 'text-amber-200 border-amber-400/30 bg-amber-500/10'}`}>
                              {nota.estado === 'hecha' ? 'Hecha' : 'Pendiente'}
                            </span>
                            <span className="text-[11px] text-slate-400">{actorName} · {formatNotaDate(nota.updated_at || nota.created_at)}</span>
                          </div>

                          {editing ? (
                            <div className="mt-2 space-y-2">
                              <textarea
                                value={tutorNotaEditText}
                                onChange={(e) => setTutorNotaEditText(e.target.value)}
                                className="w-full min-h-[80px] rounded-lg border border-white/15 bg-[#0B1B33] px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#00AEEF]/50"
                              />
                              <div className="flex justify-end gap-2">
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  onClick={() => {
                                    setTutorNotaEditId(null);
                                    setTutorNotaEditText('');
                                  }}
                                >
                                  Cancelar
                                </Button>
                                <Button
                                  size="sm"
                                  variant="primary"
                                  className="bg-[#00AEEF] hover:bg-[#00AEEF]/85 text-[#051026] font-bold"
                                  disabled={busy || !tutorNotaEditText.trim()}
                                  onClick={() => void guardarEdicionTutorNota(nota.id)}
                                >
                                  Guardar
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <p className={`mt-2 text-sm whitespace-pre-wrap break-words ${nota.estado === 'hecha' ? 'text-emerald-100 line-through decoration-emerald-300/70' : 'text-slate-100'}`}>
                              {nota.mensaje}
                            </p>
                          )}

                          {!editing && (
                            <div className="mt-3 flex flex-wrap justify-end gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={busy}
                                onClick={() => {
                                  setTutorNotaEditId(nota.id);
                                  setTutorNotaEditText(nota.mensaje || '');
                                }}
                              >
                                Editar
                              </Button>
                              <Button
                                size="sm"
                                variant={nota.estado === 'hecha' ? 'secondary' : 'success'}
                                disabled={busy}
                                onClick={() => void cambiarEstadoTutorNota(nota)}
                              >
                                {nota.estado === 'hecha' ? 'Reabrir' : 'Marcar hecha'}
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                disabled={busy}
                                onClick={() => void eliminarTutorNota(nota)}
                              >
                                Borrar
                              </Button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                <div className="pt-3 border-t border-white/10">
                  <button
                    onClick={() => setTutorHistorialOpen((v) => !v)}
                    className="text-xs font-bold text-slate-300 hover:text-white transition-colors"
                  >
                    {tutorHistorialOpen ? 'Ocultar historial' : `Ver historial (${tutorNotasHistorial.length})`}
                  </button>

                  {tutorHistorialOpen && (
                    <div className="mt-3 space-y-2 max-h-[240px] overflow-y-auto pr-1">
                      {tutorNotasHistorial.length === 0 ? (
                        <div className="text-xs text-slate-400">Sin historial registrado.</div>
                      ) : (
                        tutorNotasHistorial.map((item) => {
                          const before = item?.meta?.before;
                          const after = item?.meta?.after;
                          return (
                            <div key={item.id} className="rounded-lg border border-white/10 bg-white/5 p-2.5">
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-[11px] font-bold text-slate-100">{getNotaAccionLabel(item.accion)}</span>
                                <span className="text-[10px] text-slate-400">{formatNotaDate(item.created_at)}</span>
                              </div>
                              <div className="text-[11px] text-slate-300 mt-0.5">
                                Empleado: {item.actor_name || 'Usuario'}{item.actor_role ? ` (${item.actor_role})` : ''}
                              </div>
                              {item.mensaje && (
                                <div className="text-xs text-slate-200 mt-1 whitespace-pre-wrap break-words">{item.mensaje}</div>
                              )}
                              {(before !== undefined || after !== undefined) && (
                                <div className="mt-1 text-[11px] text-slate-400">
                                  {before !== undefined && before !== null ? `Antes: ${String(before)} ` : ''}
                                  {after !== undefined && after !== null ? `Después: ${String(after)}` : ''}
                                </div>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>

      </aside>
    </div>
  );
};

export default Dashboard;
