import React, { useState, useEffect, useMemo, useRef } from 'react';
import { api } from '../services/api';
import { supabaseClient } from '../lib/supabaseClient';
import { usePersistentState } from '../lib/usePersistentState';
import { Curso, Tutor } from '../types';
import { 
  Button, Card, CardHeader, CardTitle, CardDescription, CardContent,
  Badge, Input, Label, Select, Dialog, Table, TableHead, TableHeader, TableRow, TableCell, TableBody
} from '../components/UI';
import { Plus, Edit, Trash2, BookOpen, Users as UsersIcon, Clock, MoreVertical, CheckCircle2, XCircle, Filter, Layers, Table as TableIcon } from 'lucide-react';

const DIAS_SEMANA = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
const NIVELES = ['None', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

const timeToMinutes = (value?: string | null) => {
  if (!value) return null;
  const [h, m] = value.split(':').map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  return h * 60 + m;
};

const normalizeDiaKey = (value?: string | null) => {
  if (value == null) return '';
  return String(value)
    .trim()
    .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
};

const formatRange = (inicio?: string | null, fin?: string | null) =>
  inicio && fin ? `${inicio}-${fin}` : 'Sin horario';

const getErrorMessage = (error: any) =>
  error?.response?.data?.message || error?.response?.data?.error || error?.message || 'Error al guardar curso';

type BulkCursosResult = {
  ok: boolean;
  bulkType?: string;
  attempted?: number;
  created?: number;
  failed?: number;
  successes?: Array<{ rowNumber: number; id?: number; nombre?: string }>;
  failures?: Array<{ rowNumber: number; nombre?: string | null; error: string }>;
};

const formatCurso409 = (error: any): Record<string, string> => {
  const data = error?.response?.data ?? {};
  const code = String(data?.code ?? '').trim();

  if (code === 'TUTOR_NOT_APTO') {
    const detail = Array.isArray(data?.details) ? data.details.join(' ') : '';
    return {
      submit: `⚠️ TUTOR NO APTO: El tutor seleccionado no puede impartir el nivel del curso. ${detail}`.trim(),
      tutor: detail || 'El tutor no es apto para este nivel.'
    };
  }

  if (code === 'TUTOR_SCHEDULE_INCOMPATIBLE') {
    const detailList = Array.isArray(data?.details) ? data.details : [];
    const detail = detailList.length ? detailList.join(' ') : '';
    return {
      submit: `⚠️ HORARIO INCOMPATIBLE: El tutor no cubre todos los días/horas del curso. ${detail}`.trim(),
      tutor: detail || 'Horarios incompatibles'
    };
  }

  if (code === 'TUTOR_SCHEDULE_CONFLICT') {
    const conflicts = Array.isArray(data?.conflicts) ? data.conflicts : [];
    const first = conflicts[0];
    const firstName = first?.curso_nombre ? `"${first.curso_nombre}"` : 'otro curso';
    const overlap = first?.overlaps?.[0];
    const overlapMsg = overlap?.dia && overlap?.a?.hora_inicio && overlap?.a?.hora_fin
      ? `${overlap.dia} ${overlap.a.hora_inicio}-${overlap.a.hora_fin}`
      : '';
    return {
      submit: `⚠️ CHOQUE DE HORARIO: El tutor ya tiene ${firstName} en esa franja${overlapMsg ? ` (${overlapMsg})` : ''}. Ajusta el horario o elige otro tutor.`,
      tutor: 'Choque de horario con otro curso'
    };
  }

  const fallback = data?.error || data?.message || getErrorMessage(error);
  return { submit: String(fallback) };
};

const Cursos: React.FC = () => {
  const [cursos, setCursos] = useState<Curso[]>([]);
  const [tutores, setTutores] = useState<Tutor[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [tutorCompatibilidad, setTutorCompatibilidad] = useState<Record<number, { compatible: boolean; detalles: string }>>({});
  const [tutorSearch, setTutorSearch] = useState('');
  const [onlyCompatible, setOnlyCompatible] = useState(false);
  const [tutorPreviewId, setTutorPreviewId] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    nombre: '',
    descripcion: '',
    metodo: '',
    nivel: 'None',
    tipo_clase: 'grupal',
    tipo_pago: 'sesion',
    max_estudiantes: 10,
    dias: [] as string[],
    dias_schedule: {} as Record<string, {
      hora_inicio: string;
      hora_fin: string;
      duracion_horas?: number;
    }>,
    costo_curso: 0,
    pago_tutor: 0,
    tutor_id: 0,
    grado_activo: false,
    grado_nombre: '',
    grado_color: '#2563eb'
  });
  const [resumenSeleccion, setResumenSeleccion] = useState<{ titulo: string; detalle: string; lista?: string[] } | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedCurso, setSelectedCurso] = useState<Curso | null>(null);
  const [menuOpen, setMenuOpen] = useState<number | null>(null);
  const [estadoFiltro, setEstadoFiltro] = usePersistentState<'todos' | 'activos' | 'inactivos'>(
    'ui:cursos:estadoFiltro',
    'todos',
    {
      version: 1,
      validate: (v: unknown): v is 'todos' | 'activos' | 'inactivos' => v === 'todos' || v === 'activos' || v === 'inactivos',
    }
  );
  const [search, setSearch] = usePersistentState<string>('ui:cursos:search', '', {
    version: 1,
    validate: (v): v is string => typeof v === 'string',
  });
  const [viewMode, setViewMode] = usePersistentState<'tabla' | 'tarjetas'>('ui:cursos:viewMode', 'tarjetas', {
    version: 1,
    validate: (v: unknown): v is 'tabla' | 'tarjetas' => v === 'tabla' || v === 'tarjetas',
  });
  const [nivelFiltro, setNivelFiltro] = usePersistentState<string>('ui:cursos:nivelFiltro', '', {
    version: 1,
    validate: (v): v is string => typeof v === 'string',
  });
  const [sortMode, setSortMode] = usePersistentState<
    'nombre_asc' | 'nombre_desc'
    | 'nivel_asc' | 'nivel_desc'
    | 'estado_activos'
    | 'tipo_clase_asc' | 'tipo_clase_desc'
    | 'tipo_pago_asc' | 'tipo_pago_desc'
    | 'costo_desc' | 'costo_asc'
    | 'pago_tutor_desc' | 'pago_tutor_asc'
  >(
    'ui:cursos:sortMode',
    'nombre_asc',
    {
      version: 1,
      validate: (v: unknown): v is
        | 'nombre_asc' | 'nombre_desc'
        | 'nivel_asc' | 'nivel_desc'
        | 'estado_activos'
        | 'tipo_clase_asc' | 'tipo_clase_desc'
        | 'tipo_pago_asc' | 'tipo_pago_desc'
        | 'costo_desc' | 'costo_asc'
        | 'pago_tutor_desc' | 'pago_tutor_asc' =>
        v === 'nombre_asc' || v === 'nombre_desc'
        || v === 'nivel_asc' || v === 'nivel_desc'
        || v === 'estado_activos'
        || v === 'tipo_clase_asc' || v === 'tipo_clase_desc'
        || v === 'tipo_pago_asc' || v === 'tipo_pago_desc'
        || v === 'costo_desc' || v === 'costo_asc'
        || v === 'pago_tutor_desc' || v === 'pago_tutor_asc',
    }
  );

  const [bulkFile, setBulkFile] = useState<File | null>(null);
  const [bulkUploading, setBulkUploading] = useState(false);
  const [bulkResult, setBulkResult] = useState<BulkCursosResult | null>(null);
  const bulkFileInputRef = useRef<HTMLInputElement | null>(null);

  const calcularDuracionHoras = (horaInicio: string, horaFin: string): number => {
    try {
      const [hi, mi] = horaInicio.split(':').map(Number);
      const [hf, mf] = horaFin.split(':').map(Number);
      const minutosTotales = (hf * 60 + mf) - (hi * 60 + mi);
      return parseFloat((minutosTotales / 60).toFixed(2));
    } catch {
      return 0;
    }
  };

  const loadData = async () => {
    setLoading(true);
    const [cursosData, tutoresData] = await Promise.all([
      api.cursos.getAll(),
      api.tutores.getAll()
    ]);
    setCursos(cursosData);
    setTutores(tutoresData);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const cursosFiltrados = useMemo(() => {
    const filtered = cursos.filter(c => {
      const matchesSearch = `${c.nombre} ${c.descripcion ?? ''} ${c.nivel} ${c.tipo_clase} ${c.metodo ?? ''}`
        .toLowerCase()
        .includes(search.toLowerCase());
      const matchesEstado = estadoFiltro === 'todos' ? true : estadoFiltro === 'activos' ? c.estado === 1 : c.estado !== 1;
      const matchesNivel = nivelFiltro ? c.nivel === nivelFiltro : true;
      return matchesSearch && matchesEstado && matchesNivel;
    });

    const compareText = (a: string | null | undefined, b: string | null | undefined) =>
      (a || '').localeCompare((b || ''), 'es', { sensitivity: 'base' });

    const sorted = [...filtered].sort((a, b) => {
      switch (sortMode) {
        case 'nombre_asc':
          return compareText(a.nombre, b.nombre);
        case 'nombre_desc':
          return compareText(b.nombre, a.nombre);
        case 'nivel_asc':
          return compareText(a.nivel, b.nivel) || compareText(a.nombre, b.nombre);
        case 'nivel_desc':
          return compareText(b.nivel, a.nivel) || compareText(a.nombre, b.nombre);
        case 'estado_activos':
          return (b.estado === 1 ? 1 : 0) - (a.estado === 1 ? 1 : 0) || compareText(a.nombre, b.nombre);
        case 'tipo_clase_asc':
          return compareText(a.tipo_clase, b.tipo_clase) || compareText(a.nombre, b.nombre);
        case 'tipo_clase_desc':
          return compareText(b.tipo_clase, a.tipo_clase) || compareText(a.nombre, b.nombre);
        case 'tipo_pago_asc':
          return compareText(a.tipo_pago, b.tipo_pago) || compareText(a.nombre, b.nombre);
        case 'tipo_pago_desc':
          return compareText(b.tipo_pago, a.tipo_pago) || compareText(a.nombre, b.nombre);
        case 'costo_desc':
          return (Number(b.costo_curso || 0) - Number(a.costo_curso || 0)) || compareText(a.nombre, b.nombre);
        case 'costo_asc':
          return (Number(a.costo_curso || 0) - Number(b.costo_curso || 0)) || compareText(a.nombre, b.nombre);
        case 'pago_tutor_desc':
          return (Number(b.pago_tutor || 0) - Number(a.pago_tutor || 0)) || compareText(a.nombre, b.nombre);
        case 'pago_tutor_asc':
          return (Number(a.pago_tutor || 0) - Number(b.pago_tutor || 0)) || compareText(a.nombre, b.nombre);
        default:
          return 0;
      }
    });

    return sorted;
  }, [cursos, estadoFiltro, search, nivelFiltro, sortMode]);

  const resumenCursos = useMemo(() => {
    const total = cursosFiltrados.length;
    const grupales = cursosFiltrados.filter(c => c.tipo_clase === 'grupal').length;
    const tutorias = cursosFiltrados.filter(c => c.tipo_clase === 'tutoria').length;
    const niveles = new Set(cursosFiltrados.map(c => c.nivel).filter(Boolean)).size;
    const conTutor = cursosFiltrados.filter(c => !!c.tutor_id).length;
    const top5 = cursosFiltrados.slice(0, 5).map(c => c.nombre);

    return [
      { titulo: 'Cursos', valor: total, accent: '#FFC800', detalle: `Total de cursos filtrados: ${total}.`, lista: top5 },
      { titulo: 'Grupales', valor: grupales, accent: '#00AEEF', detalle: `${grupales} cursos grupales.`, lista: cursosFiltrados.filter(c => c.tipo_clase === 'grupal').slice(0,5).map(c=>c.nombre) },
      { titulo: 'Tutorías', valor: tutorias, accent: '#FFC800', detalle: `${tutorias} cursos de tutoría.`, lista: cursosFiltrados.filter(c => c.tipo_clase === 'tutoria').slice(0,5).map(c=>c.nombre) },
      { titulo: 'Niveles distintos', valor: niveles, accent: '#00AEEF', detalle: `Cobertura de ${niveles} niveles.`, lista: Array.from(new Set(cursosFiltrados.map(c => c.nivel).filter(Boolean))).map(String) },
      { titulo: 'Con docente asignado', valor: conTutor, accent: '#FFC800', detalle: `${conTutor} cursos tienen tutor asignado.`, lista: cursosFiltrados.filter(c => c.tutor_id).slice(0,5).map(c=>c.nombre) },
    ];
  }, [cursosFiltrados]);

  const nivelesDisponibles = useMemo(() => {
    return Array.from(new Set(cursos.map(c => c.nivel).filter(Boolean))) as string[];
  }, [cursos]);

  const tutoresActivos = useMemo(() => tutores.filter(t => t.estado === 1), [tutores]);

  const tutorCompatMap = useMemo(() => {
    const map: Record<number, { compatible: boolean; detalles: string }> = {};
    const diasCurso = formData.dias || [];
    const scheduleCurso = formData.dias_schedule || {};

      tutoresActivos.forEach((tutor) => {
        const diasHorarios = (tutor as any).dias_horarios || {};

        // Construir índice por clave normalizada (ej: "Miércoles" -> "miercoles")
        const tutorKeyByNorm: Record<string, string> = {};
        Object.keys(diasHorarios).forEach(k => {
          const nk = normalizeDiaKey(k);
          if (nk && !tutorKeyByNorm[nk]) tutorKeyByNorm[nk] = k;
        });

        const issues: string[] = [];

        diasCurso.forEach((dia) => {
          const cursoDia = scheduleCurso[dia];
          if (!cursoDia?.hora_inicio || !cursoDia?.hora_fin) return;

          const diaNorm = normalizeDiaKey(dia);
          const tutorKey = tutorKeyByNorm[diaNorm];
          const tutorDia = tutorKey ? diasHorarios[tutorKey] : undefined;

          if (!tutorDia?.hora_inicio || !tutorDia?.hora_fin) {
            issues.push(`${dia}: sin horario`);
            return;
          }

          const cursoInicio = timeToMinutes(cursoDia.hora_inicio);
          const cursoFin = timeToMinutes(cursoDia.hora_fin);
          const tutorInicio = timeToMinutes(tutorDia.hora_inicio);
          const tutorFin = timeToMinutes(tutorDia.hora_fin);

          if (
            cursoInicio == null || cursoFin == null ||
            tutorInicio == null || tutorFin == null ||
            cursoInicio < tutorInicio ||
            cursoFin > tutorFin
          ) {
            issues.push(`${dia}: ${formatRange(cursoDia.hora_inicio, cursoDia.hora_fin)} (tutor ${formatRange(tutorDia.hora_inicio, tutorDia.hora_fin)})`);
          }
        });

        map[tutor.id] = {
          compatible: issues.length === 0,
          detalles: issues.length
            ? `No cubre: ${issues.join(' · ')}`
            : 'Disponible para todos los días y horarios del curso',
        };
      });

    return map;
  }, [tutoresActivos, formData.dias, formData.dias_schedule]);

  const tutoresFiltrados = useMemo(() => {
    const term = tutorSearch.trim().toLowerCase();
    const base = tutoresActivos.filter((t) => {
      if (onlyCompatible && !tutorCompatMap[t.id]?.compatible) return false;
      if (!term) return true;
      const nombre = String(t.nombre || '').toLowerCase();
      const especialidad = String(t.especialidad || '').toLowerCase();
      const email = String(t.email || '').toLowerCase();
      return nombre.includes(term) || especialidad.includes(term) || email.includes(term);
    });
    return base;
  }, [tutoresActivos, tutorSearch, onlyCompatible, tutorCompatMap]);

  const recommendedTutorId = useMemo(() => {
    const compatibles = tutoresActivos.filter((t) => tutorCompatMap[t.id]?.compatible);
    if (compatibles.length === 0) return null;
    return compatibles
      .slice()
      .sort((a, b) => String(a.nombre || '').localeCompare(String(b.nombre || ''), 'es', { sensitivity: 'base' }))[0]
      .id;
  }, [tutoresActivos, tutorCompatMap]);

  // Suscripción en tiempo real a cursos y tutores (para combos)
  useEffect(() => {
    if (!supabaseClient) return;
    const channel = supabaseClient
      .channel('realtime-cursos')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cursos' }, () => loadData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tutores' }, () => loadData())
      .subscribe();

    return () => {
      supabaseClient.removeChannel(channel);
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};

    if (!formData.nombre.trim()) newErrors.nombre = 'Nombre requerido';
    if (formData.dias.length === 0) newErrors.dias = 'Selecciona al menos un día';
    
    // Validar que todos los días tengan horas asignadas
    for (const dia of formData.dias) {
      if (!formData.dias_schedule[dia]?.hora_inicio || !formData.dias_schedule[dia]?.hora_fin) {
        newErrors.dias = 'Todos los días deben tener horas de inicio y fin';
        break;
      }
    }
    
    if (formData.tipo_clase === 'grupal' && formData.max_estudiantes <= 0) {
      newErrors.max_estudiantes = 'Límite debe ser mayor a 0 para cursos grupales';
    }

    if (!formData.costo_curso || formData.costo_curso <= 0) {
      newErrors.costo_curso = 'El costo del curso debe ser mayor a 0';
    }
    if (!formData.pago_tutor || formData.pago_tutor <= 0) {
      newErrors.pago_tutor = 'El pago a tutores debe ser mayor a 0';
    }

    if (formData.tutor_id && formData.tutor_id !== 0) {
      const compat = tutorCompatMap[formData.tutor_id];
      if (compat && !compat.compatible) {
        newErrors.tutor = compat.detalles;
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    try {
      let metodoValue: 'Virtual' | 'Presencial' | null = null;
      if (formData.metodo === 'Virtual' || formData.metodo === 'Presencial') {
        metodoValue = formData.metodo;
      }

      const tipoClaseValue: 'grupal' | 'tutoria' = formData.tipo_clase === 'tutoria' ? 'tutoria' : 'grupal';
      const tipoPagoValue: 'sesion' | 'mensual' = formData.tipo_pago === 'mensual' ? 'mensual' : 'sesion';

      const dataToSubmit = {
        nombre: formData.nombre.trim(),
        descripcion: formData.descripcion.trim(),
        metodo: metodoValue,
        nivel: formData.nivel,
        tipo_clase: tipoClaseValue,
        tipo_pago: tipoPagoValue,
        max_estudiantes: tipoClaseValue === 'tutoria' ? null : formData.max_estudiantes,
        dias: formData.dias,
        dias_schedule: formData.dias_schedule,
        costo_curso: formData.costo_curso,
        pago_tutor: formData.pago_tutor,
        tutor_id: formData.tutor_id || null,
        grado_activo: !!formData.grado_activo,
        grado_nombre: formData.grado_activo ? (formData.grado_nombre || null) : null,
        grado_color: formData.grado_activo ? (formData.grado_color || '#2563eb') : null
      };

      if (editingId) {
        await api.cursos.update(editingId, dataToSubmit);
      } else {
        await api.cursos.create(dataToSubmit);
      }

      setShowModal(false);
      resetForm();
      loadData();
    } catch (error: any) {
      if (error?.response?.status === 409) {
        setErrors(formatCurso409(error));
        return;
      }
      setErrors({ submit: getErrorMessage(error) });
    }
  };

  const downloadCursosTemplate = async () => {
    try {
      const blob = await api.bulk.downloadTemplate('cursos_bulk');
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'template_cursos_bulk.xlsx';
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (e: any) {
      window.alert(getErrorMessage(e));
    }
  };

  const uploadCursosBulk = async () => {
    if (!bulkFile) {
      window.alert('Selecciona un archivo .xlsx');
      return;
    }
    setBulkUploading(true);
    setBulkResult(null);
    try {
      const res = await api.bulk.uploadExcel(bulkFile);
      setBulkResult(res);
      if (res?.created > 0) {
        loadData();
      }
    } catch (e: any) {
      setBulkResult({ ok: false, failures: [{ rowNumber: 0, nombre: null, error: getErrorMessage(e) }] });
    } finally {
      setBulkUploading(false);
    }
  };

  const resetForm = () => {
    setEditingId(null);
    setFormData({
      nombre: '',
      descripcion: '',
      metodo: '',
      nivel: 'None',
      tipo_clase: 'grupal',
      tipo_pago: 'sesion',
      max_estudiantes: 10,
      dias: [],
      dias_schedule: {},
      costo_curso: 0,
      pago_tutor: 0,
      tutor_id: 0,
      grado_activo: false,
      grado_nombre: '',
      grado_color: '#2563eb'
    });
    setTutorSearch('');
    setOnlyCompatible(false);
    setTutorPreviewId(null);
    setErrors({});
  };

  const handleEdit = (curso: Curso) => {
    setEditingId(curso.id);
    setFormData({
      nombre: curso.nombre,
      descripcion: curso.descripcion || '',
      metodo: curso.metodo || '',
      nivel: curso.nivel || 'None',
      tipo_clase: curso.tipo_clase || 'grupal',
      tipo_pago: curso.tipo_pago || 'sesion',
      max_estudiantes: curso.max_estudiantes || 10,
      dias: Array.isArray(curso.dias) ? curso.dias : [],
      dias_schedule: curso.dias_schedule || {},
      costo_curso: curso.costo_curso || 0,
      pago_tutor: curso.pago_tutor || 0,
      tutor_id: curso.tutor_id || 0,
      grado_activo: !!curso.grado_activo,
      grado_nombre: curso.grado_nombre || '',
      grado_color: curso.grado_color || '#2563eb'
    });
    setTutorSearch('');
    setOnlyCompatible(false);
    setTutorPreviewId(curso.tutor_id || null);
    setShowModal(true);
  };

  const handleDelete = async (id: number) => {
    if (window.confirm('¿Estás seguro de eliminar este curso?')) {
      try {
        await api.cursos.delete(id);
        loadData();
      } catch (e: any) {
        const data = e?.response?.data;
        const blockers = data?.blockers;
        const parts: string[] = [];
        if (blockers?.matriculas_grupo) parts.push(`Grupos: ${blockers.matriculas_grupo}`);
        if (blockers?.matriculas) parts.push(`Matrículas: ${blockers.matriculas}`);
        if (blockers?.clases) parts.push(`Clases: ${blockers.clases}`);
        if (blockers?.movimientos_financieros) parts.push(`Movimientos: ${blockers.movimientos_financieros}`);

        const msg =
          data?.error
          || data?.message
          || (parts.length ? `No se puede eliminar. ${parts.join(' · ')}` : '')
          || e?.message
          || 'No se pudo eliminar el curso';

        // Si el backend reporta dependencias, ofrecer borrado en cascada (grupos + matrículas)
        if ((e?.response?.status === 409) && blockers && (blockers.matriculas_grupo || blockers.matriculas)) {
          const confirmMsg = `${msg}\n\n¿Deseas eliminar automáticamente esas dependencias (grupos/matrículas) y luego borrar el curso? Esto es PERMANENTE.`;
          if (window.confirm(confirmMsg)) {
            try {
              await api.cursos.deleteCascade(id);
              loadData();
              return;
            } catch (e2: any) {
              const data2 = e2?.response?.data;
              window.alert(data2?.error || data2?.message || e2?.message || 'No se pudo eliminar el curso con cascada');
              return;
            }
          }
        }

        window.alert(msg);
      }
    }
  };

  const toggleEstado = async (curso: Curso) => {
    const nuevoEstado = curso.estado === 1 ? 0 : 1;
    await api.cursos.update(curso.id, { estado: nuevoEstado });
    setCursos(prev => prev.map(c => c.id === curso.id ? { ...c, estado: nuevoEstado } : c));
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-[50vh]">
      <div className="w-10 h-10 border-4 border-slate-200 border-t-blue-600 rounded-full animate-spin mb-4" />
      <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Cargando cursos...</p>
    </div>
  );

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      <aside className="lg:w-[32%] space-y-4 sticky top-24 self-start">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="w-5 h-5" style={{ color: '#00AEEF' }} /> Filtros y vista
            </CardTitle>
            <CardDescription>Filtra y cambia entre tabla o tarjetas</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Búsqueda rápida</Label>
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Nombre, descripción o nivel"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>Nivel</Label>
                <Select value={nivelFiltro} onChange={(e) => setNivelFiltro(e.target.value)}>
                  <option value="">Todos</option>
                  {nivelesDisponibles.map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </Select>
              </div>
              <div>
                <Label>Estado</Label>
                <Select value={estadoFiltro} onChange={(e) => setEstadoFiltro(e.target.value as any)}>
                  <option value="todos">Todos</option>
                  <option value="activos">Activos</option>
                  <option value="inactivos">Inactivos</option>
                </Select>
              </div>
            </div>

            <div>
              <Label>Ordenar</Label>
              <Select value={sortMode} onChange={(e) => setSortMode(e.target.value as any)}>
                <option value="nombre_asc">Nombre A→Z</option>
                <option value="nombre_desc">Nombre Z→A</option>
                <option value="nivel_asc">Nivel A→Z</option>
                <option value="nivel_desc">Nivel Z→A</option>
                <option value="estado_activos">Activos primero</option>
                <option value="tipo_clase_asc">Tipo de clase A→Z</option>
                <option value="tipo_clase_desc">Tipo de clase Z→A</option>
                <option value="tipo_pago_asc">Tipo de pago A→Z</option>
                <option value="tipo_pago_desc">Tipo de pago Z→A</option>
                <option value="costo_desc">Costo: mayor primero</option>
                <option value="costo_asc">Costo: menor primero</option>
                <option value="pago_tutor_desc">Pago tutor: mayor primero</option>
                <option value="pago_tutor_asc">Pago tutor: menor primero</option>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Button
                size="sm"
                onClick={() => setViewMode('tabla')}
                className={`gap-2 font-bold transition-all ${viewMode === 'tabla'
                  ? 'bg-[#00AEEF] hover:bg-[#00AEEF]/80 text-[#051026]'
                  : 'bg-white/10 hover:bg-white/15 text-slate-200 border border-white/10'}`}
              >
                <TableIcon className="w-4 h-4" /> Tabla
              </Button>
              <Button
                size="sm"
                onClick={() => setViewMode('tarjetas')}
                className={`gap-2 font-bold transition-all ${viewMode === 'tarjetas'
                  ? 'bg-[#00AEEF] hover:bg-[#00AEEF]/80 text-[#051026]'
                  : 'bg-white/10 hover:bg-white/15 text-slate-200 border border-white/10'}`}
              >
                <Layers className="w-4 h-4" /> Tarjetas
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="border-white/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="w-5 h-5" style={{ color: '#FFC800' }} /> Carga masiva
            </CardTitle>
            <CardDescription>Descarga el template y sube cursos en lote</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Button size="sm" className="font-bold" onClick={downloadCursosTemplate}>
                Descargar template
              </Button>
              <Button
                size="sm"
                className="font-bold bg-white/10 hover:bg-white/15 text-slate-200 border border-white/10"
                onClick={() => bulkFileInputRef.current?.click()}
              >
                Elegir archivo
              </Button>
            </div>

            <input
              ref={bulkFileInputRef}
              type="file"
              accept=".xlsx"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0] ?? null;
                setBulkFile(f);
                setBulkResult(null);
              }}
            />

            <div className="text-xs text-slate-300">
              {bulkFile ? `Archivo: ${bulkFile.name}` : 'Ningún archivo seleccionado.'}
            </div>

            <Button
              size="sm"
              className="w-full font-bold"
              disabled={!bulkFile || bulkUploading}
              onClick={uploadCursosBulk}
            >
              {bulkUploading ? 'Procesando…' : 'Subir y procesar'}
            </Button>

            {bulkResult && (
              <div className="mt-2 rounded-xl border border-white/10 bg-[#0F2445] p-3 space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-bold text-white">Resultado</span>
                  <span className="text-slate-300">{bulkResult?.bulkType ?? ''}</span>
                </div>
                {'attempted' in bulkResult && (
                  <div className="text-xs text-slate-300">
                    Filas procesadas: <b className="text-slate-100">{bulkResult.attempted ?? 0}</b> · Creadas: <b className="text-slate-100">{bulkResult.created ?? 0}</b> · Fallidas: <b className="text-slate-100">{bulkResult.failed ?? 0}</b>
                  </div>
                )}

                {(bulkResult.failures?.length ?? 0) > 0 && (
                  <div className="space-y-1">
                    <div className="text-xs font-bold text-[#FFC800]">Errores (se omitieron esas filas)</div>
                    <ul className="text-xs text-slate-200 space-y-1 max-h-40 overflow-auto pr-1">
                      {(bulkResult.failures ?? []).slice(0, 20).map((f, idx) => (
                        <li key={`${f.rowNumber}-${idx}`} className="border border-white/10 rounded-lg p-2 bg-black/10">
                          <div className="font-bold">Fila {f.rowNumber}{f.nombre ? ` · ${f.nombre}` : ''}</div>
                          <div className="text-slate-300">{f.error}</div>
                        </li>
                      ))}
                    </ul>
                    {(bulkResult.failures ?? []).length > 20 && (
                      <div className="text-[11px] text-slate-400">Mostrando 20 de {(bulkResult.failures ?? []).length} errores.</div>
                    )}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-white/10">
          <CardHeader>
            <CardTitle className="text-lg">Resumen rápido</CardTitle>
            <CardDescription className="text-xs">Indicadores clave del catálogo</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {resumenCursos.map(card => (
                <button
                  key={card.titulo}
                  onClick={() => setResumenSeleccion({ titulo: card.titulo, detalle: card.detalle, lista: card.lista })}
                  className="relative text-left p-4 rounded-2xl border border-white/10 bg-[#0F2445] hover:border-[#00AEEF]/40 hover:shadow-cyan-500/10 transition-all overflow-hidden"
                >
                  <div className="absolute top-0 right-0 w-16 h-16 rounded-bl-full" style={{ backgroundColor: `${card.accent}22` }} />
                  <div className="flex items-center justify-between relative z-10 gap-2">
                    <div className="min-w-0">
                      <div className="text-[11px] font-bold uppercase text-slate-400 tracking-widest">{card.titulo}</div>
                      <div className="text-3xl font-black mt-1 text-white">{card.valor}</div>
                    </div>
                    <div className="w-10 h-10 rounded-2xl flex items-center justify-center" style={{ backgroundColor: `${card.accent}33`, color: '#051026' }}>
                      <Layers className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="mt-2 text-[12px] text-slate-400 leading-snug">{card.detalle}</div>
                </button>
              ))}
            </div>

            {resumenSeleccion && (
              <Card className="border-white/10 bg-[#0F2445]">
                <CardHeader className="border-white/10 pb-3">
                  <CardTitle className="text-white text-base">{resumenSeleccion.titulo}</CardTitle>
                  <CardDescription className="text-slate-400">{resumenSeleccion.detalle}</CardDescription>
                </CardHeader>
                {resumenSeleccion.lista && resumenSeleccion.lista.length > 0 && (
                  <div className="p-4 space-y-2 text-slate-100">
                    {resumenSeleccion.lista.map((item, idx) => (
                      <div key={idx} className="text-sm">• {item}</div>
                    ))}
                  </div>
                )}
              </Card>
            )}
          </CardContent>
        </Card>
      </aside>

      <div className="flex-1 space-y-10">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-white/10 pb-8">
          <div>
            <h1 className="text-3xl font-black text-white tracking-tight">Catálogo de Cursos</h1>
            <p className="text-slate-300 font-medium mt-2">Programas académicos y niveles</p>
          </div>
          <Button
            onClick={() => {
              resetForm();
              setShowModal(true);
            }}
            variant="primary"
            className="h-12 px-8 gap-3 bg-[#00AEEF] hover:bg-[#00AEEF]/80 text-[#051026] font-bold"
          >
            <Plus className="w-5 h-5" />
            Nuevo Curso
          </Button>
        </header>

        <section className="space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <h2 className="text-2xl font-black text-white tracking-tight">Cursos</h2>
              <p className="text-slate-300 text-sm font-medium">Programas académicos disponibles</p>
            </div>
            <div className="text-sm font-semibold text-slate-200">{cursosFiltrados.length} resultado(s)</div>
          </div>

          {/* Dialog de Detalle */}
          <Dialog isOpen={detailOpen} onClose={() => setDetailOpen(false)} title="Detalles del Curso">
        {selectedCurso && (
          <div className="space-y-4 text-slate-100">
            <div>
              <div className="font-bold text-2xl text-white">{selectedCurso.nombre}</div>
              {selectedCurso.descripcion && (
                <p className="text-sm text-slate-300 mt-2">{selectedCurso.descripcion}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-lg border border-white/10 bg-white/5">
                <div className="text-[11px] font-bold text-slate-300 uppercase">Nivel</div>
                <div className="text-sm font-semibold text-white">{selectedCurso.nivel}</div>
              </div>
              <div className="p-3 rounded-lg border border-cyan-400/40 bg-cyan-500/10">
                <div className="text-[11px] font-bold text-cyan-200 uppercase">Tipo</div>
                <div className="text-sm font-semibold text-white">{selectedCurso.tipo_clase === 'tutoria' ? 'Tutoría' : 'Grupal'}</div>
              </div>
              <div className="p-3 rounded-lg border border-white/10 bg-white/5">
                <div className="text-[11px] font-bold text-slate-300 uppercase">Método</div>
                <div className="text-sm font-semibold text-white">{selectedCurso.metodo || '—'}</div>
              </div>
              <div className="p-3 rounded-lg border border-amber-400/30 bg-amber-500/10">
                <div className="text-[11px] font-bold text-amber-200 uppercase">Pago</div>
                <div className="text-sm font-semibold text-white">
                  {selectedCurso.tipo_pago === 'mensual' ? 'Mensual' : 'Por sesión'}
                </div>
              </div>
              {selectedCurso.max_estudiantes && (
                <div className="p-3 rounded-lg border border-emerald-400/30 bg-emerald-500/10">
                  <div className="text-[11px] font-bold text-emerald-200 uppercase">Límite alumnos</div>
                  <div className="text-sm font-semibold text-white">{selectedCurso.max_estudiantes}</div>
                </div>
              )}
              {selectedCurso.costo_curso && (
                <div className="p-3 rounded-lg border border-green-400/30 bg-green-500/10">
                  <div className="text-[11px] font-bold text-green-200 uppercase">Costo</div>
                  <div className="text-sm font-semibold text-white">₡{selectedCurso.costo_curso.toLocaleString()}</div>
                </div>
              )}
            </div>

            {selectedCurso.dias_schedule && Object.keys(selectedCurso.dias_schedule).length > 0 && (
              <div>
                <div className="text-xs font-bold text-slate-300 uppercase mb-2">Horario del curso</div>
                <div className="space-y-2">
                  {Object.entries(selectedCurso.dias_schedule).map(([dia, info]: any) => (
                    <div key={dia} className="flex items-center justify-between p-2.5 rounded-lg bg-[#0F2445] border border-white/10">
                      <span className="font-semibold text-white">{dia}</span>
                      <span className="text-sm text-slate-200">{info.hora_inicio} - {info.hora_fin}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {selectedCurso.grado_activo && selectedCurso.grado_nombre && (
              <div className="p-3 rounded-lg border border-indigo-400/30 bg-indigo-500/10">
                <div className="text-[11px] font-bold text-indigo-200 uppercase">Grado escolar</div>
                <div className="text-sm font-semibold text-white">{selectedCurso.grado_nombre}</div>
              </div>
            )}
          </div>
        )}
      </Dialog>

      {/* Modal de Formulario */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-7xl min-h-[86vh] max-h-[96vh] overflow-y-auto">
            <CardHeader className="border-b border-slate-200 flex justify-between items-start">
              <div>
                <CardTitle>{editingId ? 'Editar Curso' : 'Nuevo Curso'}</CardTitle>
                <CardDescription>Configura los detalles del programa académico</CardDescription>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="text-slate-200 hover:text-white transition-colors p-2 rounded-full bg-white/10 border border-white/10 hover:bg-[#FFC800]/20 hover:border-[#FFC800]/50"
                aria-label="Cerrar"
                title="Cerrar"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </CardHeader>

            <form onSubmit={handleSubmit} className="p-8 space-y-6">
              {/* Nombre */}
              <div>
                <Label>Nombre del Curso *</Label>
                <Input
                  value={formData.nombre}
                  onChange={(e) => setFormData(prev => ({ ...prev, nombre: e.target.value }))}
                  placeholder="Ej: Inglés Avanzado"
                  className={errors.nombre ? 'border-red-500' : ''}
                />
                {errors.nombre && <p className="text-red-500 text-sm mt-1">{errors.nombre}</p>}
              </div>

              {/* Descripción */}
              <div>
                <Label>Descripción</Label>
                <textarea
                  value={formData.descripcion}
                  onChange={(e) => setFormData(prev => ({ ...prev, descripcion: e.target.value }))}
                  placeholder="Descripción del curso..."
                  className="w-full p-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/10"
                  rows={3}
                />
              </div>

              {/* Método (Virtual/Presencial) */}
              <div>
                <Label>Método (Virtual/Presencial)</Label>
                <Select value={formData.metodo} onChange={(e) => setFormData(prev => ({ ...prev, metodo: e.target.value }))}>
                  <option value="">(Sin especificar)</option>
                  <option value="Virtual">Virtual</option>
                  <option value="Presencial">Presencial</option>
                </Select>
                <p className="text-xs text-slate-500 mt-1">Nota: esto solo indica la modalidad (virtual o presencial) del curso.</p>
              </div>

              {/* Nivel y Tipo */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Nivel *</Label>
                  <Select value={formData.nivel} onChange={(e) => setFormData(prev => ({ ...prev, nivel: e.target.value }))}>
                    {NIVELES.map(nivel => (
                      <option key={nivel} value={nivel}>{nivel}</option>
                    ))}
                  </Select>
                </div>
                <div>
                  <Label>Tipo de Clase *</Label>
                  <Select 
                    value={formData.tipo_clase} 
                    onChange={(e) => {
                      setFormData(prev => ({ 
                        ...prev, 
                        tipo_clase: e.target.value,
                        max_estudiantes: e.target.value === 'tutoria' ? 1 : 10
                      }));
                    }}
                  >
                    <option value="grupal">Grupal</option>
                    <option value="tutoria">Tutoría (Infinito)</option>
                  </Select>
                </div>
              </div>

              {/* Límite de Estudiantes */}
              {formData.tipo_clase === 'grupal' && (
                <div>
                  <Label>Límite de Estudiantes *</Label>
                  <Input
                    type="number"
                    value={formData.max_estudiantes || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, max_estudiantes: parseInt(e.target.value) || 1 }))}
                    min="1"
                    max="50"
                    className={errors.max_estudiantes ? 'border-red-500' : ''}
                  />
                  {errors.max_estudiantes && <p className="text-red-500 text-sm mt-1">{errors.max_estudiantes}</p>}
                </div>
              )}

              {formData.tipo_clase === 'tutoria' && (
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm font-semibold text-blue-900">
                    ℹ️ Tutoría: Sin límite de estudiantes
                  </p>
                </div>
              )}

              {/* Días */}
              <div>
                <Label>Días Hábiles *</Label>
                <div className="grid grid-cols-4 gap-2 mt-2">
                  {DIAS_SEMANA.map(dia => (
                    <label key={dia} className="flex items-center gap-2 p-3 border border-slate-200 rounded-lg hover:bg-blue-50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.dias.includes(dia)}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          if (checked) {
                            setFormData(prev => ({ 
                              ...prev, 
                              dias: [...prev.dias, dia],
                              dias_schedule: {
                                ...prev.dias_schedule,
                                [dia]: { hora_inicio: '09:00', hora_fin: '11:00', duracion_horas: 2 }
                              }
                            }));
                          } else {
                            setFormData(prev => {
                              const newSchedule = { ...prev.dias_schedule };
                              delete newSchedule[dia];
                              return {
                                ...prev,
                                dias: prev.dias.filter(d => d !== dia),
                                dias_schedule: newSchedule
                              };
                            });
                          }
                        }}
                        className="rounded"
                      />
                      <span className="text-sm font-semibold text-slate-700">{dia.slice(0, 3)}</span>
                    </label>
                  ))}
                </div>
                {errors.dias && <p className="text-red-500 text-sm mt-2">{errors.dias}</p>}
              </div>

              {/* Horarios específicos por día */}
              {formData.dias.length > 0 && (
                <div>
                  <Label>Horarios por Día *</Label>
                  <div className="space-y-4 mt-2">
                    {formData.dias.map(dia => (
                      <div key={dia} className="p-4 bg-slate-50 rounded-lg border border-slate-200 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-semibold text-slate-700">{dia}</span>
                          {formData.dias_schedule[dia]?.duracion_horas && (
                            <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded">
                              {formData.dias_schedule[dia].duracion_horas}h
                            </span>
                          )}
                        </div>
                        
                        {/* Selección de horas */}
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-xs font-semibold text-slate-300 mb-1">Hora Inicio</label>
                            <Input
                              type="time"
                              value={formData.dias_schedule[dia]?.hora_inicio || '14:00'}
                              onChange={(e) => {
                                const horaInicio = e.target.value;
                                const horaFin = formData.dias_schedule[dia]?.hora_fin || '17:00';
                                const duracion = calcularDuracionHoras(horaInicio, horaFin);
                                setFormData(prev => ({
                                  ...prev,
                                  dias_schedule: {
                                    ...prev.dias_schedule,
                                    [dia]: {
                                      ...prev.dias_schedule[dia],
                                      hora_inicio: horaInicio,
                                      duracion_horas: duracion
                                    }
                                  }
                                }));
                              }}
                              className="h-9 text-sm"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-slate-300 mb-1">Hora Fin</label>
                            <Input
                              type="time"
                              value={formData.dias_schedule[dia]?.hora_fin || '17:00'}
                              onChange={(e) => {
                                const horaFin = e.target.value;
                                const horaInicio = formData.dias_schedule[dia]?.hora_inicio || '14:00';
                                const duracion = calcularDuracionHoras(horaInicio, horaFin);
                                setFormData(prev => ({
                                  ...prev,
                                  dias_schedule: {
                                    ...prev.dias_schedule,
                                    [dia]: {
                                      ...prev.dias_schedule[dia],
                                      hora_fin: horaFin,
                                      duracion_horas: duracion
                                    }
                                  }
                                }));
                              }}
                              className="h-9 text-sm"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Tutor Asignado */}
              <div>
                <Label>Asignar Tutor (opcional)</Label>
                <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_380px] gap-4 mt-3">
                  <Card className="border-white/10 bg-[#0B1B33] rounded-md">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm">Lista de tutores</CardTitle>
                      <CardDescription className="text-xs">Selecciona uno para ver detalles completos</CardDescription>
                    </CardHeader>
                    <CardContent className="pt-0 space-y-3">
                      <Input
                        value={tutorSearch}
                        onChange={(e) => setTutorSearch(e.target.value)}
                        placeholder="Buscar por nombre, especialidad o email"
                      />
                      <label className="flex items-center gap-2 text-xs text-slate-300">
                        <input
                          type="checkbox"
                          checked={onlyCompatible}
                          onChange={(e) => setOnlyCompatible(e.target.checked)}
                          className="w-4 h-4"
                        />
                        Solo compatibles con el horario
                      </label>
                      <div className="text-xs text-slate-500">
                        {tutoresFiltrados.length} resultado(s)
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-72 overflow-auto pr-1">
                        <label
                          className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition ${formData.tutor_id === 0 ? 'border-[#00AEEF] bg-[#00AEEF]/10' : 'border-white/10 bg-[#0B1B33] hover:bg-[#102847]'}`}
                          onClick={() => setTutorPreviewId(null)}
                        >
                          <input
                            type="radio"
                            name="tutor_id"
                            value={0}
                            checked={formData.tutor_id === 0}
                            onChange={() => setFormData(prev => ({ ...prev, tutor_id: 0 }))}
                            className="mt-1"
                          />
                          <div>
                            <div className="font-semibold text-slate-100">Sin tutor asignado</div>
                            <div className="text-xs text-slate-300">Se asignará manualmente después</div>
                          </div>
                        </label>

                        {tutoresFiltrados.map(tutor => {
                          const diasHorarios = tutor.dias_horarios || {};
                          const diasEntries = Object.entries(diasHorarios);
                          const tieneDias = diasEntries.length > 0;
                          const visibleDias = diasEntries.slice(0, 3);
                          const compat = tutorCompatMap[tutor.id];
                          return (
                            <label
                              key={tutor.id}
                              className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition ${formData.tutor_id === tutor.id ? 'border-[#00AEEF] bg-[#00AEEF]/10' : 'border-white/10 bg-[#0B1B33] hover:bg-[#102847]'}`}
                              onClick={() => setTutorPreviewId(tutor.id)}
                            >
                              <input
                                type="radio"
                                name="tutor_id"
                                value={tutor.id}
                                checked={formData.tutor_id === tutor.id}
                                onChange={(e) => setFormData(prev => ({ ...prev, tutor_id: parseInt(e.target.value) }))}
                                className="mt-1"
                              />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <div
                                    className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center font-bold text-sm"
                                    style={{ color: (tutor as any).color || '#0f172a' }}
                                  >
                                    {tutor.nombre?.charAt(0) || 'T'}
                                  </div>
                                  <div className="min-w-0">
                                    <div className="font-semibold text-slate-100 truncate">{tutor.nombre}</div>
                                    <div className="text-xs text-slate-300 truncate">{tutor.especialidad || 'Sin especialidad'}</div>
                                  </div>
                                </div>

                                <div className="mt-2 flex items-center gap-2 flex-wrap">
                                  <span className={`text-[11px] font-bold px-2 py-1 rounded border ${compat?.compatible ? 'bg-emerald-500/15 text-emerald-200 border-emerald-400/30' : 'bg-amber-500/15 text-amber-200 border-amber-400/30'}`}>
                                    {compat?.compatible ? 'Disponible' : 'No compatible'}
                                  </span>
                                  {tieneDias ? (
                                    <div className="flex flex-wrap gap-1">
                                      {visibleDias.map(([dia, horario]: [string, any]) => (
                                        <span key={dia} className="text-[11px] bg-[#122B52] text-blue-100 border border-blue-400/30 px-2 py-1 rounded">
                                          {dia.slice(0, 3)} {horario.hora_inicio}-{horario.hora_fin}
                                        </span>
                                      ))}
                                      {diasEntries.length > visibleDias.length && (
                                        <span className="text-[11px] bg-white/10 text-slate-200 border border-white/10 px-2 py-1 rounded">
                                          +{diasEntries.length - visibleDias.length} más
                                        </span>
                                      )}
                                    </div>
                                  ) : (
                                    <span className="text-[11px] text-amber-200">⚠️ Sin horarios definidos</span>
                                  )}
                                </div>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border-white/10 bg-[#0B1B33]">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm">Detalle del tutor</CardTitle>
                      <CardDescription className="text-xs">Horario completo y compatibilidad</CardDescription>
                    </CardHeader>
                    <CardContent className="pt-0">
                      {(() => {
                        const previewTutorId = tutorPreviewId ?? (formData.tutor_id || null);
                        const previewTutor = previewTutorId ? tutoresActivos.find(t => t.id === previewTutorId) : null;
                        if (!previewTutor) {
                          return (
                            <div className="text-xs text-slate-600">
                              Selecciona un tutor para ver su horario completo.
                            </div>
                          );
                        }

                        const diasHorarios = previewTutor.dias_horarios || {};
                        const diasEntries = Object.entries(diasHorarios);
                        const compat = tutorCompatMap[previewTutor.id];

                        return (
                          <div className="space-y-3">
                            <div>
                              <div className="text-sm font-bold text-slate-100 truncate">{previewTutor.nombre}</div>
                              <div className="text-xs text-slate-300 truncate">{previewTutor.especialidad || 'Sin especialidad'}</div>
                            </div>

                            <div className={`text-xs font-bold px-2 py-1 rounded border ${compat?.compatible ? 'bg-emerald-500/15 text-emerald-200 border-emerald-400/30' : 'bg-amber-500/15 text-amber-200 border-amber-400/30'}`}>
                              {compat?.compatible ? 'Disponible para este curso' : 'No compatible con el horario'}
                            </div>

                            {compat && !compat.compatible && (
                              <div className="text-[11px] text-amber-200">
                                {compat.detalles}
                              </div>
                            )}

                            <div>
                              <div className="text-[11px] font-bold text-slate-500 uppercase">Horario completo</div>
                              {diasEntries.length > 0 ? (
                                <div className="mt-2 space-y-1">
                                  {diasEntries.map(([dia, horario]: [string, any]) => (
                                    <div key={dia} className="flex items-center justify-between text-xs border border-white/10 rounded px-2 py-1 bg-[#0F2445]">
                                      <span className="font-semibold text-slate-100">{dia}</span>
                                      <span className="text-slate-300">{horario.hora_inicio}-{horario.hora_fin}</span>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <div className="text-[11px] text-amber-200 mt-1">⚠️ Sin horarios definidos</div>
                              )}
                            </div>
                          </div>
                        );
                      })()}
                    </CardContent>
                  </Card>
                </div>
                {errors.tutor && (
                  <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-sm text-red-700 font-semibold">❌ {errors.tutor}</p>
                  </div>
                )}
              </div>

              {/* Costos del Curso */}
              <div>
                <Label className="text-lg font-semibold">💰 Costos</Label>
                <div className="mt-3">
                  <Label>Tipo de pago *</Label>
                  <Select
                    value={formData.tipo_pago}
                    onChange={(e) => setFormData(prev => ({ ...prev, tipo_pago: e.target.value as any }))}
                    className="bg-slate-50 border-slate-200"
                  >
                    <option value="sesion">Por sesión (se registra al marcar “dada”)</option>
                    <option value="mensual">Mensual (cobro mensual por estudiante)</option>
                  </Select>
                  <p className="text-xs text-slate-500 mt-1">
                    {formData.tipo_pago === 'mensual'
                      ? 'En “mensual” se cobra por mes a cada estudiante.'
                      : 'En “por sesión” se generan movimientos al marcar cada sesión como dada.'}
                  </p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
                  <div>
                    <Label>Costo del Curso (₡) *</Label>
                    <Input
                      type="number"
                      value={formData.costo_curso || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, costo_curso: parseFloat(e.target.value) || 0 }))}
                      placeholder="Precio para estudiantes"
                      min="0"
                      step="0.01"
                      className={errors.costo_curso ? 'border-red-500' : ''}
                    />
                    {errors.costo_curso && <p className="text-red-500 text-sm mt-1">{errors.costo_curso}</p>}
                    <p className="text-xs text-slate-500 mt-1">Precio que pagan los estudiantes</p>
                  </div>
                  <div>
                    <Label>Pago a Tutores (₡) *</Label>
                    <Input
                      type="number"
                      value={formData.pago_tutor || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, pago_tutor: parseFloat(e.target.value) || 0 }))}
                      placeholder="Monto que recibe el tutor"
                      min="0"
                      step="0.01"
                      className={errors.pago_tutor ? 'border-red-500' : ''}
                    />
                    {errors.pago_tutor && <p className="text-red-500 text-sm mt-1">{errors.pago_tutor}</p>}
                    <p className="text-xs text-slate-500 mt-1">Monto que recibe cada tutor por enseñar</p>
                  </div>
                </div>
              </div>

              {/* Etiqueta de Grado / Color */}
              <div className="p-4 border border-slate-200 rounded-lg bg-slate-50">
                <div className="flex items-center gap-3">
                  <input
                    id="grado_activo"
                    type="checkbox"
                    checked={!!formData.grado_activo}
                    onChange={(e) => setFormData(prev => ({ ...prev, grado_activo: e.target.checked }))}
                    className="w-4 h-4"
                  />
                  <Label htmlFor="grado_activo" className="m-0">Mostrar etiqueta de grado en tarjetas</Label>
                </div>
                {formData.grado_activo && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-3">
                    <div className="md:col-span-2">
                      <Label>Nombre de la etiqueta</Label>
                      <Input
                        value={formData.grado_nombre}
                        onChange={(e) => setFormData(prev => ({ ...prev, grado_nombre: e.target.value }))}
                        placeholder="Ej: Primaria, Bachillerato, C1, etc."
                      />
                    </div>
                    <div>
                      <Label>Color</Label>
                      <Input
                        type="color"
                        value={formData.grado_color}
                        onChange={(e) => setFormData(prev => ({ ...prev, grado_color: e.target.value }))}
                        className="h-12 p-1"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Mensaje de error general */}
              {errors.submit && (
                <div className="p-4 bg-red-50 border-2 border-red-300 rounded-lg">
                  <p className="text-sm text-red-800 font-bold leading-relaxed">{errors.submit}</p>
                </div>
              )}

              {/* Botones */}
              <div className="flex gap-4 justify-end pt-6 border-t border-slate-200">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setShowModal(false);
                    resetForm();
                  }}
                  className="px-8"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  className="px-8 bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {editingId ? 'Actualizar' : 'Crear'}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {viewMode === 'tarjetas' ? (
        <>
          {/* Grid de Cursos */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
        {cursosFiltrados.map((curso) => (
          <Card 
            key={curso.id} 
            className="group relative overflow-hidden border-white/10 hover:border-[#00AEEF]/30 flex flex-col h-full min-h-[560px]"
          >
            <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-[#FFC800] to-[#00AEEF] opacity-60" />
            
            <CardHeader className="pb-4 border-none">
              <div className="flex justify-between items-start gap-3">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="w-12 h-12 rounded-2xl bg-white/10 border border-white/15 flex items-center justify-center text-white font-black shadow-inner flex-shrink-0">
                    <BookOpen className="w-6 h-6" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <CardTitle className="text-lg text-white truncate">{curso.nombre}</CardTitle>
                    <div className="flex gap-2 mt-2 flex-wrap">
                      <Badge variant="secondary" className="font-bold">{curso.nivel || 'None'}</Badge>
                      <Badge className={`${curso.tipo_clase === 'tutoria' ? 'bg-purple-500/15 text-purple-200 border border-purple-400/40' : 'bg-emerald-500/15 text-emerald-200 border border-emerald-400/40'} font-bold`}>
                        {curso.tipo_clase === 'tutoria' ? '1:1' : 'Grupal'}
                      </Badge>
                      {curso.metodo && (
                        <Badge className="bg-cyan-500/15 text-cyan-100 border border-cyan-400/40 font-bold">
                          {curso.metodo}
                        </Badge>
                      )}
                      {curso.tipo_pago && (
                        <Badge className={`${curso.tipo_pago === 'mensual' ? 'bg-amber-500/15 text-amber-200 border border-amber-400/40' : 'bg-emerald-500/15 text-emerald-200 border border-emerald-400/40'} font-bold`}>
                          {curso.tipo_pago === 'mensual' ? 'Mensual' : 'Por sesión'}
                        </Badge>
                      )}
                      {curso.grado_activo && curso.grado_nombre && (
                        <span
                          className="text-[11px] font-bold px-3 py-1 rounded-full border truncate max-w-[100px]"
                          style={{
                            backgroundColor: (curso.grado_color || '#00AEEF') + '22',
                            color: curso.grado_color || '#FFC800',
                            borderColor: (curso.grado_color || '#00AEEF')
                          }}
                        >
                          {curso.grado_nombre}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="relative flex-shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setMenuOpen(menuOpen === curso.id ? null : curso.id)}
                    className="h-9 w-9 text-slate-300 hover:bg-white/10"
                  >
                    <MoreVertical className="w-5 h-5" />
                  </Button>
                  {menuOpen === curso.id && (
                    <div className="absolute right-0 top-10 z-50 bg-[#0F2445] rounded-2xl shadow-2xl border border-white/10 py-1 min-w-[180px]">
                      <button
                        onClick={() => { setSelectedCurso(curso); setDetailOpen(true); setMenuOpen(null); }}
                        className="w-full text-left px-4 py-2 text-sm text-slate-100 hover:bg-white/5 flex items-center gap-2"
                      >
                        <BookOpen className="w-4 h-4" />
                        Ver detalles
                      </button>
                      <button
                        onClick={() => { handleEdit(curso); setMenuOpen(null); }}
                        className="w-full text-left px-4 py-2 text-sm text-slate-100 hover:bg-white/5 flex items-center gap-2"
                      >
                        <Edit className="w-4 h-4" />
                        Editar
                      </button>
                      <button
                        onClick={() => { handleDelete(curso.id); setMenuOpen(null); }}
                        className="w-full text-left px-4 py-2 text-sm text-rose-400 hover:bg-rose-500/10 flex items-center gap-2"
                      >
                        <Trash2 className="w-4 h-4" />
                        Eliminar
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </CardHeader>

            {curso.descripcion && (
              <div className="px-6 mb-4 flex-shrink-0">
                <p className="text-sm text-slate-300 line-clamp-2">{curso.descripcion}</p>
              </div>
            )}

            <div className="px-6 pb-6 flex-1 flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-slate-300">
                  <UsersIcon className="w-4 h-4 text-cyan-300 flex-shrink-0" />
                  <span className="text-sm font-semibold">
                    {curso.tipo_clase === 'tutoria' ? 'Sin límite' : `Máx: ${curso.max_estudiantes}`}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-slate-300 min-w-0">
                  <Clock className="w-4 h-4 text-cyan-300 flex-shrink-0" />
                  <span className="text-sm font-semibold truncate">
                    {curso.dias_schedule && typeof curso.dias_schedule === 'object' && Object.keys(curso.dias_schedule).length > 0
                      ? Object.entries(curso.dias_schedule).slice(0,2).map(([dia, schedule]: [string, any]) => 
                          `${dia.slice(0,3)} ${schedule.hora_inicio}-${schedule.hora_fin}`
                        ).join(', ') + (Object.keys(curso.dias_schedule).length > 2 ? '...' : '')
                      : 'Sin horario'}
                  </span>
                </div>
              </div>

              {/* Tutor Asignado */}
              {curso.tutor_id && (
                <div className="bg-indigo-500/10 p-3 rounded-lg border border-indigo-400/30">
                  <p className="text-xs text-indigo-100 font-bold uppercase mb-1">Tutor asignado</p>
                  <p className="text-sm font-black text-white">
                    {tutores.find(t => t.id === curso.tutor_id)?.nombre || `Tutor #${curso.tutor_id}`}
                  </p>
                </div>
              )}

              {/* Costos */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-white/5">
                <div className="bg-emerald-500/10 p-3 rounded-lg border border-emerald-400/30">
                  <p className="text-xs text-emerald-100 font-semibold mb-1">Costo del curso</p>
                  <p className="text-lg font-black text-white">₡{curso.costo_curso?.toLocaleString() || '0'}</p>
                </div>
                <div className="bg-cyan-500/10 p-3 rounded-lg border border-cyan-400/30">
                  <p className="text-xs text-cyan-100 font-semibold mb-1">Pago a tutores</p>
                  <p className="text-lg font-black text-white">₡{curso.pago_tutor?.toLocaleString() || '0'}</p>
                </div>
                <div className="bg-amber-500/10 p-3 rounded-lg border border-amber-400/30">
                  <p className="text-xs text-amber-100 font-semibold mb-1">Método de pago</p>
                  <p className="text-lg font-black text-white">
                    {curso.tipo_pago === 'mensual' ? 'Mensual' : 'Por sesión'}
                  </p>
                </div>
              </div>

              {Array.isArray(curso.dias) && curso.dias.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {curso.dias.map((dia) => {
                    const schedule = curso.dias_schedule?.[dia];
                    return (
                      <span key={dia} className="text-xs bg-cyan-500/10 text-cyan-100 border border-cyan-400/30 font-semibold px-2 py-1 rounded">
                        {dia.slice(0, 3)}: {schedule?.hora_inicio || '?'}-{schedule?.hora_fin || '?'}
                      </span>
                    );
                  })}
                </div>
              )}

              <div className="mt-auto">
                <Button
                  size="sm"
                  onClick={() => toggleEstado(curso)}
                  className={`w-full gap-2 font-bold border ${curso.estado === 1 
                    ? 'bg-emerald-500/20 hover:bg-emerald-500/25 border-emerald-400/40 text-emerald-50' 
                    : 'bg-rose-500/15 hover:bg-rose-500/25 border-rose-400/40 text-rose-50'}`}
                >
                  {curso.estado === 1 ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                  {curso.estado === 1 ? 'Activo' : 'Inactivo'}
                </Button>
              </div>
            </div>
          </Card>
        ))}
        </div>
        </>
      ) : (
          <Card className="border-slate-200">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Nivel</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Pago</TableHead>
                    <TableHead>Método</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Tutor</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cursosFiltrados.map((curso) => (
                    <TableRow key={curso.id}>
                      <TableCell className="font-semibold text-slate-900">{curso.nombre}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{curso.nivel}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={curso.tipo_clase === 'grupal' ? 'info' : 'warning'}>
                          {curso.tipo_clase === 'grupal' ? 'Grupal' : 'Tutoría'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={curso.tipo_pago === 'mensual' ? 'warning' : 'info'}>
                          {curso.tipo_pago === 'mensual' ? 'Mensual' : 'Por sesión'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {curso.metodo ? <Badge variant="secondary">{curso.metodo}</Badge> : <span className="text-slate-400">—</span>}
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          onClick={() => toggleEstado(curso)}
                          className={`gap-2 border ${curso.estado === 1
                            ? 'bg-emerald-500/20 hover:bg-emerald-500/25 border-emerald-400/40 text-emerald-50'
                            : 'bg-rose-500/15 hover:bg-rose-500/25 border-rose-400/40 text-rose-50'}`}
                        >
                          {curso.estado === 1 ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                          {curso.estado === 1 ? 'Activo' : 'Inactivo'}
                        </Button>
                      </TableCell>
                      <TableCell className="text-sm text-slate-600">
                        {curso.tutor_id ? tutores.find(t => t.id === curso.tutor_id)?.nombre || `Tutor #${curso.tutor_id}` : 'Sin asignar'}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button size="sm" variant="ghost" onClick={() => { setSelectedCurso(curso); setDetailOpen(true); }} className="text-slate-700">Detalle</Button>
                          <Button size="sm" variant="ghost" onClick={() => handleEdit(curso)} className="text-blue-700">Editar</Button>
                          <Button size="sm" variant="ghost" onClick={() => handleDelete(curso.id)} className="text-red-600">Eliminar</Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
        </section>
      </div>
    </div>
  );
};

export default Cursos;
