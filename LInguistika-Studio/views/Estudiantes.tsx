import React, { useState, useEffect, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { api } from '../services/api';
import { supabaseClient } from '../lib/supabaseClient';
import { usePersistentState } from '../lib/usePersistentState';
import { Estudiante } from '../types';
import { Button, Card, CardHeader, CardTitle, CardDescription, CardContent, Input, Label, Select, Badge, Dialog, Table, TableHead, TableHeader, TableRow, TableCell, TableBody } from '../components/UI';
import { PhoneInput } from '../components/PhoneInput';
import { Plus, Edit, Trash2, Mail, Phone, User, X, MoreVertical, Filter, Layers, Table as TableIcon, CheckCircle2, XCircle, Upload, FolderKanban, Wand2, GraduationCap, ArrowLeft, Users } from 'lucide-react';

const GRADOS = ['1ro', '2do', '3ro', '4to', '5to', '6to', '7mo', '8vo', '9no', '10mo', '11mo', 'No aplica'];
const DIAS_SEMANA = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
const TURNOS = ['Tarde', 'Noche'];
const GRADO_COLORES: Record<string, string> = {
  '1ro': '#2563eb',
  '2do': '#7c3aed',
  '3ro': '#0f766e',
  '4to': '#d97706',
  '5to': '#db2777',
  '6to': '#0ea5e9',
  '7mo': '#22c55e',
  '8vo': '#a855f7',
  '9no': '#0284c7',
  '10mo': '#f59e0b',
  '11mo': '#ef4444',
  'No aplica': '#94a3b8',
};

const getErrorMessage = (error: any) =>
  error?.response?.data?.message || error?.response?.data?.error || error?.message || 'Error al guardar estudiante';

const hexToRgba = (hex: string, alpha: number) => {
  const normalized = hex.replace('#', '');
  const bigint = parseInt(normalized, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

type Bandeja = 'estudiantes' | 'grupos';

type BulkEstudiante = {
  id: number;
  nombre: string;
  // Campos legacy (ya no se usan en UI)
  correo?: string | null;
  telefono?: string | null;

  // Contacto del encargado (nuevo estándar)
  nombre_encargado?: string | null;
  email_encargado?: string | null;
  telefono_encargado?: string | null;

  grado?: string | null;
  dias?: string[] | null;
  dias_turno?: Record<string, 'Tarde' | 'Noche'> | null;
  requiere_perfil_completo?: boolean;
  estado: boolean | number;
  created_at?: string;
  updated_at?: string;
  matricula_grupo_id?: string | null;
};

type BulkGrupo = {
  id: string;
  curso_id: number;
  tutor_id: number;
  nombre_grupo?: string | null;
  cantidad_estudiantes_esperados?: number | null;
  estado?: string | null;
  fecha_inicio?: string | null;
  fecha_fin?: string | null;
  turno?: string | null;
  notas?: string | null;
  created_at?: string;
  updated_at?: string;
  curso_nombre?: string | null;
  tutor_nombre?: string | null;
  linked_count?: number;
};

type UnifiedStudent = {
  key: string;
  kind: 'normal' | 'bulk';
  id: number;
  nombre: string;
  grado?: string | null;
  estado: number;
  email?: string | null;
  nombre_encargado?: string | null;
  email_encargado?: string | null;
  telefono?: string | null;
  telefono_encargado?: string | null;
  dias?: string[] | null;
  dias_turno?: Record<string, 'Tarde' | 'Noche'> | null;
  requiere_perfil_completo?: boolean;
  matricula_grupo_id?: string | null;
};

const Estudiantes: React.FC = () => {
  const [estudiantes, setEstudiantes] = useState<Estudiante[]>([]);
  const [bulkEstudiantes, setBulkEstudiantes] = useState<BulkEstudiante[]>([]);
  const [bulkGrupos, setBulkGrupos] = useState<BulkGrupo[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formData, setFormData] = useState({
    nombre: '',
    nombre_encargado: '',
    email_encargado: '',
    telefono_encargado: '',
    grado: '',
    grupo_id: '',
    dias: [] as string[],
    dias_turno: {} as Record<string, 'Tarde' | 'Noche'>
  });
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedEstudiante, setSelectedEstudiante] = useState<UnifiedStudent | null>(null);
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [search, setSearch] = usePersistentState<string>('ui:estudiantes:search', '', {
    version: 1,
    validate: (v): v is string => typeof v === 'string',
  });
  const [gradoFiltro, setGradoFiltro] = usePersistentState<string>('ui:estudiantes:gradoFiltro', '', {
    version: 1,
    validate: (v): v is string => typeof v === 'string',
  });
  const [grupoFiltro, setGrupoFiltro] = usePersistentState<string>('ui:estudiantes:grupoFiltro', '', {
    version: 1,
    validate: (v): v is string => typeof v === 'string',
  });
  const [estadoFiltro, setEstadoFiltro] = usePersistentState<'todos' | 'activos' | 'inactivos'>(
    'ui:estudiantes:estadoFiltro',
    'todos',
    {
      version: 1,
      validate: (v: unknown): v is 'todos' | 'activos' | 'inactivos' => v === 'todos' || v === 'activos' || v === 'inactivos',
    }
  );
  const [viewMode, setViewMode] = usePersistentState<'tabla' | 'tarjetas'>('ui:estudiantes:viewMode', 'tabla', {
    version: 1,
    validate: (v: unknown): v is 'tabla' | 'tarjetas' => v === 'tabla' || v === 'tarjetas',
  });
  const [sortMode, setSortMode] = usePersistentState<
    'nombre_asc' | 'nombre_desc'
    | 'grado_asc' | 'grado_desc'
    | 'estado_activos'
    | 'tipo_normal_primero' | 'tipo_bulk_primero'
    | 'grupo_asc' | 'grupo_desc'
    | 'perfil_incompleto_primero'
  >(
    'ui:estudiantes:sortMode',
    'nombre_asc',
    {
      version: 1,
      validate: (v: unknown): v is
        | 'nombre_asc' | 'nombre_desc'
        | 'grado_asc' | 'grado_desc'
        | 'estado_activos'
        | 'tipo_normal_primero' | 'tipo_bulk_primero'
        | 'grupo_asc' | 'grupo_desc'
        | 'perfil_incompleto_primero' =>
        v === 'nombre_asc' || v === 'nombre_desc'
        || v === 'grado_asc' || v === 'grado_desc'
        || v === 'estado_activos'
        || v === 'tipo_normal_primero' || v === 'tipo_bulk_primero'
        || v === 'grupo_asc' || v === 'grupo_desc'
        || v === 'perfil_incompleto_primero',
    }
  );
  const [groupByMode, setGroupByMode] = usePersistentState<'none' | 'grado' | 'grupo'>(
    'ui:estudiantes:groupByMode',
    'none',
    {
      version: 1,
      validate: (v: unknown): v is 'none' | 'grado' | 'grupo' => v === 'none' || v === 'grado' || v === 'grupo',
    }
  );

  const [bandeja, setBandeja] = useState<Bandeja>('estudiantes');
  const [actionsOpen, setActionsOpen] = useState(false);
  const [actionTab, setActionTab] = useState<'crear_grupo' | 'nuevo_estudiante'>('crear_grupo');

  const [bulkEditOpen, setBulkEditOpen] = useState(false);
  const [bulkEditing, setBulkEditing] = useState<BulkEstudiante | null>(null);
  const [bulkForm, setBulkForm] = useState({ nombre: '', nombre_encargado: '', email_encargado: '', telefono_encargado: '', requiere_perfil_completo: false, estado: true });
  const [bulkEditErr, setBulkEditErr] = useState<string | null>(null);

  const [grupoAdminOpen, setGrupoAdminOpen] = useState(false);
  const [grupoAdminId, setGrupoAdminId] = useState<string | null>(null);
  const [grupoAddSearch, setGrupoAddSearch] = useState('');
  const [grupoMembersSearch, setGrupoMembersSearch] = useState('');
  const [grupoSelectedToAdd, setGrupoSelectedToAdd] = useState<number[]>([]);
  const [grupoSelectedToAddNormales, setGrupoSelectedToAddNormales] = useState<number[]>([]);

  const [grupoCreateBusy, setGrupoCreateBusy] = useState(false);
  const [grupoCreateMsg, setGrupoCreateMsg] = useState<string | null>(null);
  const [cursosCatalog, setCursosCatalog] = useState<any[]>([]);
  const [tutoresCatalog, setTutoresCatalog] = useState<any[]>([]);
  const [grupoForm, setGrupoForm] = useState({
    nombre_grupo: '',
    curso_id: '',
    tutor_id: '',
    turno: '',
    cantidad_estudiantes_esperados: '',
  });

  const [bulkTipo, setBulkTipo] = useState<'estudiantes_bulk' | 'grupo_matricula'>('estudiantes_bulk');
  const [bulkFile, setBulkFile] = useState<File | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkMsg, setBulkMsg] = useState<string | null>(null);
  const [bulkResult, setBulkResult] = useState<any | null>(null);

  const [bulkPreviewOpen, setBulkPreviewOpen] = useState(false);
  const [bulkPreviewBusy, setBulkPreviewBusy] = useState(false);
  const [bulkPreview, setBulkPreview] = useState<any | null>(null);
  const [bulkPreviewErr, setBulkPreviewErr] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    const [data, bulkData, gruposData] = await Promise.all([
      api.estudiantes.getAll(),
      api.bulk.listEstudiantesBulk(),
      api.bulk.listGrupos(),
    ]);
    setEstudiantes(data);
    setBulkEstudiantes(bulkData as any);
    setBulkGrupos(gruposData as any);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  // Open detail if URL has ?open=<id>
  const location = useLocation();
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const openId = params.get('open');
    if (openId) {
      const id = Number(openId);
      if (!Number.isNaN(id)) {
        api.estudiantes.getById(id)
          .then((e) => {
            if (e) {
              setSelectedEstudiante({
                key: `est-${e.id}`,
                kind: 'normal',
                id: e.id,
                nombre: e.nombre,
                grado: e.grado ?? null,
                estado: typeof e.estado === 'number' ? e.estado : e.estado ? 1 : 0,
                email: e.correo ?? e.email ?? null,
                nombre_encargado: e.nombre_encargado ?? null,
                email_encargado: e.email_encargado ?? null,
                telefono: e.telefono ?? null,
              });
              setDetailOpen(true);
            }
          })
          .catch(() => {});
      }
    }
  }, [location.search]);

  const downloadBulkTemplate = async () => {
    setBulkMsg(null);
    setBulkBusy(true);
    try {
      const blob = await api.bulk.downloadTemplate(bulkTipo);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = bulkTipo === 'grupo_matricula' ? 'template_grupo_matricula.xlsx' : 'template_estudiantes_bulk.xlsx';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setBulkMsg('Template descargado. Llénalo y luego súbelo para procesar.');
    } catch (e: any) {
      setBulkMsg(e?.response?.data?.error || 'No se pudo descargar el template');
    } finally {
      setBulkBusy(false);
    }
  };

  const uploadBulkExcel = async () => {
    if (!bulkFile) {
      setBulkMsg('Selecciona un archivo .xlsx');
      return;
    }

    // Primero: previsualización/validación (sin insertar)
    setBulkMsg(null);
    setBulkResult(null);
    setBulkPreviewErr(null);
    setBulkPreview(null);
    setBulkPreviewBusy(true);
    try {
      const prev = await api.bulk.previewExcel(bulkFile);
      setBulkPreview(prev);
      setBulkPreviewOpen(true);
    } catch (e: any) {
      setBulkPreviewErr(e?.response?.data?.error || e?.message || 'No se pudo previsualizar el archivo');
      setBulkPreviewOpen(true);
    } finally {
      setBulkPreviewBusy(false);
    }
  };

  const confirmImportBulkExcel = async () => {
    if (!bulkFile) return;
    setBulkMsg(null);
    setBulkResult(null);
    setBulkBusy(true);
    try {
      const res = await api.bulk.uploadExcel(bulkFile);
      const inserted = res?.inserted ?? res?.inserted_estudiantes_bulk ?? 0;
      const createdGrupos = res?.created_grupos ?? 0;
      const linked = res?.linked ?? 0;
      const extra = res?.matricula_grupo_id ? ` (grupo #${res.matricula_grupo_id})` : '';

      const parts = [`Procesado: ${res.bulkType}.`];
      if (createdGrupos) parts.push(`Grupos: ${createdGrupos}.`);
      parts.push(`Insertados: ${inserted}${extra}.`);
      if (linked) parts.push(`Vinculados a grupo: ${linked}.`);
      parts.push('Revisa la bandeja “Grupos” para organizarlos.');
      setBulkMsg(parts.join(' '));
      if (res?.failures?.length) {
        setBulkResult(res);
      }

      setBulkPreviewOpen(false);
      setBulkFile(null);

      const [bulkData, gruposData] = await Promise.all([api.bulk.listEstudiantesBulk(), api.bulk.listGrupos()]);
      setBulkEstudiantes(bulkData as any);
      setBulkGrupos(gruposData as any);
    } catch (e: any) {
      setBulkMsg(e?.response?.data?.error || 'No se pudo procesar el archivo');
    } finally {
      setBulkBusy(false);
    }
  };

  const openBulkEdit = (s: BulkEstudiante) => {
    setBulkEditing(s);
    setBulkForm({
      nombre: s.nombre ?? '',
      nombre_encargado: (s as any).nombre_encargado ?? '',
      email_encargado: ((s as any).email_encargado ?? (s as any).correo ?? '') as any,
      telefono_encargado: ((s as any).telefono_encargado ?? (s as any).telefono ?? '') as any,
      requiere_perfil_completo: !!s.requiere_perfil_completo,
      estado: s.estado === true || s.estado === 1,
    });
    setBulkEditErr(null);
    setBulkEditOpen(true);
  };

  const saveBulkEdit = async () => {
    if (!bulkEditing) return;
    setBulkEditErr(null);
    try {
      await api.bulk.updateEstudianteBulk(bulkEditing.id, {
        nombre: bulkForm.nombre,
        nombre_encargado: bulkForm.nombre_encargado || null,
        email_encargado: bulkForm.email_encargado || null,
        telefono_encargado: bulkForm.telefono_encargado || null,
        requiere_perfil_completo: !!bulkForm.requiere_perfil_completo,
        estado: !!bulkForm.estado,
      });
      const bulkData = await api.bulk.listEstudiantesBulk();
      setBulkEstudiantes(bulkData as any);
      setBulkEditOpen(false);
    } catch (e: any) {
      setBulkEditErr(e?.response?.data?.error || 'No se pudo actualizar');
    }
  };

  const deleteBulk = async (id: number) => {
    if (!window.confirm('¿Eliminar este estudiante? (Se quitará de cualquier grupo)')) return;
    await api.bulk.deleteEstudianteBulk(id);
    const bulkData = await api.bulk.listEstudiantesBulk();
    setBulkEstudiantes(bulkData as any);
  };

  const toggleBulkEstado = async (s: BulkEstudiante) => {
    const nuevo = !(s.estado === true || s.estado === 1);
    await api.bulk.updateEstudianteBulk(s.id, { estado: nuevo });
    setBulkEstudiantes((prev) => prev.map((x) => (x.id === s.id ? { ...x, estado: nuevo } : x)));
  };

  const ensureCatalogos = async () => {
    if (cursosCatalog.length && tutoresCatalog.length) return;
    const [cursos, tutores] = await Promise.all([api.cursos.getAll(), api.tutores.getAll()]);
    setCursosCatalog(cursos as any);
    setTutoresCatalog(tutores as any);
  };

  const createGrupo = async () => {
    setGrupoCreateMsg(null);
    setGrupoCreateBusy(true);
    try {
      const cursoId = parseInt(grupoForm.curso_id, 10);
      const tutorId = parseInt(grupoForm.tutor_id, 10);
      if (!Number.isFinite(cursoId) || !Number.isFinite(tutorId)) {
        setGrupoCreateMsg('Selecciona curso y tutor.');
        return;
      }
      const cant = grupoForm.cantidad_estudiantes_esperados.trim() ? parseInt(grupoForm.cantidad_estudiantes_esperados, 10) : null;
      await api.bulk.createGrupo({
        curso_id: cursoId,
        tutor_id: tutorId,
        nombre_grupo: grupoForm.nombre_grupo.trim() || null,
        cantidad_estudiantes_esperados: Number.isFinite(cant as any) ? (cant as any) : null,
        turno: grupoForm.turno.trim() || null,
      });
      const gruposData = await api.bulk.listGrupos();
      setBulkGrupos(gruposData as any);
      setGrupoCreateMsg('Grupo creado.');
      setGrupoForm({ nombre_grupo: '', curso_id: '', tutor_id: '', turno: '', cantidad_estudiantes_esperados: '' });
      setBandeja('grupos');
    } catch (e: any) {
      setGrupoCreateMsg(e?.response?.data?.error || 'No se pudo crear el grupo');
    } finally {
      setGrupoCreateBusy(false);
    }
  };

  // Suscripción en tiempo real a cambios en estudiantes
  useEffect(() => {
    if (!supabaseClient) return;
    const channel = supabaseClient
      .channel('realtime-estudiantes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'estudiantes' }, () => {
        loadData();
      })
      .subscribe();

    return () => {
      supabaseClient.removeChannel(channel);
    };
  }, []);

  // Recargar datos cuando la pestaña se vuelve visible
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        loadData();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  const validateEmail = (email: string): boolean => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const validatePhone = (phone: string): boolean => {
    // Acepta cualquier código de país; requiere al menos 6 dígitos
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 6) return false;
    return /^\+?[\d\s().-]{0,}$/.test(phone.trim());
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};

    const creatingBulkInGrupo = !editingId && !!formData.grupo_id;

    if (!formData.nombre.trim()) newErrors.nombre = 'Nombre requerido';
    if (formData.email_encargado && !validateEmail(formData.email_encargado)) {
      newErrors.email_encargado = 'Email inválido';
    }
    if (formData.telefono_encargado && !validatePhone(formData.telefono_encargado)) {
      newErrors.telefono_encargado = 'Teléfono inválido';
    }
    if (!creatingBulkInGrupo && !formData.grado) newErrors.grado = 'Selecciona un grado';

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    try {
      if (!editingId && formData.grupo_id) {
        const created = await api.bulk.createEstudianteBulk({
          nombre: formData.nombre.trim(),
          nombre_encargado: formData.nombre_encargado.trim() || null,
          email_encargado: formData.email_encargado.trim() || null,
          telefono_encargado: formData.telefono_encargado.trim() || null,
          requiere_perfil_completo: false,
          estado: true,
        });
        await api.bulk.assignEstudiantesToGrupo(String(formData.grupo_id), [created.id]);

        setShowModal(false);
        resetForm();
        await loadData();
        setBandeja('grupos');
        return;
      }

      const dataToSubmit = {
        nombre: formData.nombre.trim(),
        nombre_encargado: formData.nombre_encargado.trim() || null,
        // Regla de negocio: contacto del estudiante ya no se usa
        email: null,
        telefono: null,
        email_encargado: formData.email_encargado.trim() || null,
        telefono_encargado: formData.telefono_encargado.trim() || null,
        grado: formData.grado,
        dias: formData.dias.length > 0 ? formData.dias : null,
        dias_turno: Object.keys(formData.dias_turno).length > 0 ? formData.dias_turno : null
      };

      if (editingId) {
        await api.estudiantes.update(editingId, dataToSubmit);
      } else {
        await api.estudiantes.create(dataToSubmit);
      }

      setShowModal(false);
      resetForm();
      loadData();
    } catch (error) {
      setErrors({ submit: getErrorMessage(error) });
    }
  };

  const resetForm = () => {
    setEditingId(null);
    setFormData({
      nombre: '',
      nombre_encargado: '',
      email_encargado: '',
      telefono_encargado: '',
      grado: '',
      grupo_id: '',
      dias: [],
      dias_turno: {}
    });
    setErrors({});
  };

  const handleEdit = (est: Estudiante) => {
    setEditingId(est.id);
    setFormData({
      nombre: est.nombre,
      nombre_encargado: est.nombre_encargado || '',
      email_encargado: est.email_encargado || '',
      telefono_encargado: est.telefono_encargado || '',
      grado: est.grado || '',
      grupo_id: '',
      dias: Array.isArray(est.dias) ? est.dias : [],
      dias_turno: (est as any).dias_turno || {}
    });
    setShowModal(true);
  };

  const handleDelete = async (id: number) => {
    if (window.confirm('¿Estás seguro de eliminar este estudiante?')) {
      await api.estudiantes.delete(id);
      loadData();
    }
  };

  const toggleEstado = async (est: Estudiante) => {
    const nuevoEstado = est.estado === 1 ? 0 : 1;
    await api.estudiantes.update(est.id, { estado: nuevoEstado });
    setEstudiantes(prev => prev.map(e => e.id === est.id ? { ...e, estado: nuevoEstado } : e));
  };

  const getGradoColor = (grado?: string | null) => {
    if (!grado) return '#475569';
    return GRADO_COLORES[grado] || '#475569';
  };

  const gradoChipStyle = (grado?: string | null) => {
    const color = getGradoColor(grado);
    return {
      backgroundColor: hexToRgba(color, 0.12),
      borderColor: hexToRgba(color, 0.4),
      color,
      boxShadow: `0 6px 16px ${hexToRgba(color, 0.12)}`,
    } as React.CSSProperties;
  };

  const unifiedStudents: UnifiedStudent[] = useMemo(() => {
    const normal: UnifiedStudent[] = estudiantes.map((e) => ({
      key: `n:${e.id}`,
      kind: 'normal',
      id: e.id,
      nombre: e.nombre,
      grado: e.grado ?? null,
      estado: e.estado,
      email: e.email ?? null,
      nombre_encargado: e.nombre_encargado ?? null,
      email_encargado: e.email_encargado ?? null,
      telefono: e.telefono ?? null,
      telefono_encargado: e.telefono_encargado ?? null,
      dias: Array.isArray(e.dias) ? e.dias : null,
      dias_turno: (e as any).dias_turno ?? null,
      matricula_grupo_id: (e as any).matricula_grupo_id ?? null,
    }));

    const bulk: UnifiedStudent[] = bulkEstudiantes.map((b) => ({
      key: `b:${b.id}`,
      kind: 'bulk',
      id: b.id,
      nombre: b.nombre,
      grado: null,
      estado: (b.estado === true || b.estado === 1) ? 1 : 0,
      nombre_encargado: (b as any).nombre_encargado ?? null,
      email_encargado: ((b as any).email_encargado ?? (b as any).correo ?? null) as any,
      telefono_encargado: ((b as any).telefono_encargado ?? (b as any).telefono ?? null) as any,
      email: null,
      telefono: null,
      requiere_perfil_completo: !!b.requiere_perfil_completo,
      dias: null,
      dias_turno: null,
      matricula_grupo_id: (b as any).matricula_grupo_id ?? null,
    }));

    return [...normal, ...bulk];
  }, [estudiantes, bulkEstudiantes]);

  const filteredEstudiantes = useMemo(() => {
    const filtered = unifiedStudents.filter((e) => {
      const matchesSearch = `${e.nombre} ${e.nombre_encargado ?? ''} ${e.email_encargado ?? ''} ${e.telefono_encargado ?? ''}`
        .toLowerCase()
        .includes(search.toLowerCase());
      const matchesGrado = gradoFiltro ? (e.grado === gradoFiltro) : true;
      const matchesEstado = estadoFiltro === 'todos'
        ? true
        : estadoFiltro === 'activos'
          ? e.estado === 1
          : e.estado !== 1;

      const matchesGrupo = grupoFiltro === ''
        ? true
        : grupoFiltro === 'sin_grupo'
          ? !e.matricula_grupo_id
          : String(e.matricula_grupo_id ?? '') === String(grupoFiltro);
      return matchesSearch && matchesGrado && matchesEstado && matchesGrupo;
    });

    const compareText = (a: string | null | undefined, b: string | null | undefined) =>
      (a || '').localeCompare((b || ''), 'es', { sensitivity: 'base' });

    const grupoNameByIdLocal = new Map<string, string>();
    for (const g of bulkGrupos) {
      grupoNameByIdLocal.set(String(g.id), g.nombre_grupo || `Grupo #${g.id}`);
    }

    const getGrupoNombre = (e: UnifiedStudent) => {
      const gid = String(e.matricula_grupo_id ?? '');
      if (!gid) return '';
      return grupoNameByIdLocal.get(gid) || `Grupo #${gid}`;
    };

    const sorted = [...filtered].sort((a, b) => {
      switch (sortMode) {
        case 'nombre_asc':
          return compareText(a.nombre, b.nombre);
        case 'nombre_desc':
          return compareText(b.nombre, a.nombre);
        case 'grado_asc':
          return compareText(a.grado || '', b.grado || '') || compareText(a.nombre, b.nombre);
        case 'grado_desc':
          return compareText(b.grado || '', a.grado || '') || compareText(a.nombre, b.nombre);
        case 'estado_activos':
          return (b.estado === 1 ? 1 : 0) - (a.estado === 1 ? 1 : 0) || compareText(a.nombre, b.nombre);
        case 'tipo_normal_primero':
          return (a.kind === 'normal' ? 0 : 1) - (b.kind === 'normal' ? 0 : 1) || compareText(a.nombre, b.nombre);
        case 'tipo_bulk_primero':
          return (a.kind === 'bulk' ? 0 : 1) - (b.kind === 'bulk' ? 0 : 1) || compareText(a.nombre, b.nombre);
        case 'grupo_asc':
          return compareText(getGrupoNombre(a), getGrupoNombre(b)) || compareText(a.nombre, b.nombre);
        case 'grupo_desc':
          return compareText(getGrupoNombre(b), getGrupoNombre(a)) || compareText(a.nombre, b.nombre);
        case 'perfil_incompleto_primero':
          return (b.requiere_perfil_completo ? 1 : 0) - (a.requiere_perfil_completo ? 1 : 0) || compareText(a.nombre, b.nombre);
        default:
          return 0;
      }
    });

    return sorted;
  }, [unifiedStudents, bulkGrupos, search, gradoFiltro, estadoFiltro, grupoFiltro, sortMode]);

  const selectedGrupoAdmin = useMemo(() => {
    if (!grupoAdminId) return null;
    return bulkGrupos.find((g) => String(g.id) === String(grupoAdminId)) ?? null;
  }, [grupoAdminId, bulkGrupos]);

  const grupoNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const g of bulkGrupos) {
      map.set(String(g.id), g.nombre_grupo || `Grupo #${g.id}`);
    }
    return map;
  }, [bulkGrupos]);

  const grupoMembers = useMemo(() => {
    if (!grupoAdminId) return [];
    const id = String(grupoAdminId);
    return bulkEstudiantes.filter((s) => String((s as any).matricula_grupo_id ?? '') === id);
  }, [grupoAdminId, bulkEstudiantes]);

  const grupoMembersNormales = useMemo(() => {
    if (!grupoAdminId) return [];
    const id = String(grupoAdminId);
    return estudiantes.filter((s: any) => String((s as any).matricula_grupo_id ?? '') === id);
  }, [grupoAdminId, estudiantes]);

  const grupoCandidates = useMemo(() => {
    if (!grupoAdminId) return [];
    const id = String(grupoAdminId);
    return bulkEstudiantes.filter((s) => String((s as any).matricula_grupo_id ?? '') !== id);
  }, [grupoAdminId, bulkEstudiantes]);

  const grupoCandidatesNormales = useMemo(() => {
    if (!grupoAdminId) return [];
    const id = String(grupoAdminId);
    return estudiantes.filter((s: any) => String((s as any).matricula_grupo_id ?? '') !== id);
  }, [grupoAdminId, estudiantes]);

  const openGrupoAdmin = (id: string) => {
    setGrupoAdminId(String(id));
    setGrupoAdminOpen(true);
    setGrupoAddSearch('');
    setGrupoMembersSearch('');
    setGrupoSelectedToAdd([]);
    setGrupoSelectedToAddNormales([]);
  };

  const addSelectedToGrupo = async () => {
    if (!grupoAdminId || (grupoSelectedToAdd.length === 0 && grupoSelectedToAddNormales.length === 0)) return;
    try {
      await api.bulk.assignEstudiantesToGrupo(String(grupoAdminId), grupoSelectedToAdd, grupoSelectedToAddNormales);
      const [gruposData, bulkData, normalData] = await Promise.all([
        api.bulk.listGrupos(),
        api.bulk.listEstudiantesBulk(),
        api.estudiantes.getAll(),
      ]);
      setBulkGrupos(gruposData as any);
      setBulkEstudiantes(bulkData as any);
      setEstudiantes(normalData as any);
      setGrupoSelectedToAdd([]);
      setGrupoSelectedToAddNormales([]);
    } catch (e: any) {
      window.alert(e?.response?.data?.error || e?.response?.data?.message || e?.message || 'No se pudo agregar al grupo');
    }
  };

  const removeFromGrupo = async (estudianteBulkId: number) => {
    try {
      await api.bulk.unassignEstudiantes([estudianteBulkId], []);
      const [gruposData, bulkData] = await Promise.all([api.bulk.listGrupos(), api.bulk.listEstudiantesBulk()]);
      setBulkGrupos(gruposData as any);
      setBulkEstudiantes(bulkData as any);
    } catch (e: any) {
      window.alert(e?.response?.data?.error || e?.response?.data?.message || e?.message || 'No se pudo quitar del grupo');
    }
  };

  const removeFromGrupoNormal = async (estudianteId: number) => {
    try {
      await api.bulk.unassignEstudiantes([], [estudianteId]);
      const [gruposData, normalData] = await Promise.all([api.bulk.listGrupos(), api.estudiantes.getAll()]);
      setBulkGrupos(gruposData as any);
      setEstudiantes(normalData as any);
    } catch (e: any) {
      window.alert(e?.response?.data?.error || e?.response?.data?.message || e?.message || 'No se pudo quitar del grupo');
    }
  };

  const deleteGrupo = async () => {
    if (!grupoAdminId) return;
    if (!window.confirm('¿Eliminar este grupo? Se desasignarán estudiantes y se quitará el vínculo en finanzas (si aplica).')) return;
    try {
      await api.bulk.deleteGrupo(String(grupoAdminId));
      const [gruposData, bulkData, normalData] = await Promise.all([
        api.bulk.listGrupos(),
        api.bulk.listEstudiantesBulk(),
        api.estudiantes.getAll(),
      ]);
      setBulkGrupos(gruposData as any);
      setBulkEstudiantes(bulkData as any);
      setEstudiantes(normalData as any);
      setGrupoAdminOpen(false);
      setGrupoAdminId(null);
    } catch (e: any) {
      window.alert(e?.response?.data?.error || e?.response?.data?.message || e?.message || 'No se pudo eliminar el grupo');
    }
  };

  const stats = useMemo(() => {
    const total = unifiedStudents.length;
    const activos = unifiedStudents.filter(e => e.estado === 1).length;
    const inactivos = total - activos;
    const grados = new Set(unifiedStudents.map(e => e.grado).filter(Boolean)).size;
    return { total, activos, inactivos, grados };
  }, [unifiedStudents]);

  const gradoStats = useMemo(() => {
    const map = new Map<string, { total: number; activos: number; inactivos: number }>();
    unifiedStudents.forEach((e) => {
      const key = e.grado || 'Sin grado';
      const current = map.get(key) || { total: 0, activos: 0, inactivos: 0 };
      current.total += 1;
      if (e.estado === 1) current.activos += 1; else current.inactivos += 1;
      map.set(key, current);
    });
    return Array.from(map.entries()).map(([grado, data]) => ({ grado, ...data })).sort((a, b) => a.grado.localeCompare(b.grado));
  }, [unifiedStudents]);

  const gradosDisponibles = useMemo(() => {
    return Array.from(new Set(unifiedStudents.map(e => e.grado).filter(Boolean))) as string[];
  }, [unifiedStudents]);

  const agrupadosPorGrado = useMemo(() => {
    if (groupByMode !== 'grado') return [];
    const groups = new Map<string, UnifiedStudent[]>();
    filteredEstudiantes.forEach((e) => {
      const key = e.grado || 'Sin grado';
      const list = groups.get(key) || [];
      list.push(e);
      groups.set(key, list);
    });
    const orderOf = (g: string) => {
      if (g === 'Sin grado') return Number.MAX_SAFE_INTEGER;
      const idx = GRADOS.indexOf(g);
      return idx === -1 ? Number.MAX_SAFE_INTEGER - 1 : idx;
    };

    return Array.from(groups.entries())
      .map(([grado, lista]) => ({ grado, lista }))
      .sort((a, b) => {
        const ao = orderOf(a.grado);
        const bo = orderOf(b.grado);
        if (ao !== bo) return ao - bo;
        return a.grado.localeCompare(b.grado);
      });
  }, [filteredEstudiantes, groupByMode]);

  const agrupadosPorGrupo = useMemo(() => {
    if (groupByMode !== 'grupo') return [];
    const groups = new Map<string, UnifiedStudent[]>();
    filteredEstudiantes.forEach((e) => {
      const gid = String(e.matricula_grupo_id ?? '');
      const list = groups.get(gid) || [];
      list.push(e);
      groups.set(gid, list);
    });
    return Array.from(groups.entries())
      .map(([gid, lista]) => ({
        gid,
        grupo: gid ? (grupoNameById.get(gid) || `Grupo #${gid}`) : 'Sin grupo',
        lista,
      }))
      .sort((a, b) => {
        const aSin = !a.gid;
        const bSin = !b.gid;
        if (aSin !== bSin) return aSin ? 1 : -1;
        return a.grupo.localeCompare(b.grupo);
      });
  }, [filteredEstudiantes, groupByMode, grupoNameById]);

  const filteredStats = useMemo(() => {
    const total = filteredEstudiantes.length;
    const activos = filteredEstudiantes.filter(e => e.estado === 1).length;
    const inactivos = total - activos;
    return { total, activos, inactivos };
  }, [filteredEstudiantes]);

  const getGrupoLabel = (e: UnifiedStudent) => {
    const gid = String(e.matricula_grupo_id ?? '');
    return gid ? (grupoNameById.get(gid) || `Grupo #${gid}`) : 'Sin grupo';
  };

  const StudentCardItem: React.FC<{ est: UnifiedStudent }> = ({ est }) => (
    <Card className="group relative overflow-hidden border-white/10 hover:border-[#00AEEF]/30 flex flex-col h-full">
      <div className="absolute top-0 left-0 w-full h-1.5 opacity-80" style={{ backgroundColor: getGradoColor(est.grado) }} />

      <CardHeader className="pb-4 border-none">
        <div className="flex justify-between items-start gap-3">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="w-12 h-12 rounded-2xl border flex items-center justify-center font-black shadow-inner flex-shrink-0" style={gradoChipStyle(est.grado)}>
              {est.nombre.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <CardTitle className="text-lg text-white truncate">{est.nombre}</CardTitle>
              <div className="flex flex-wrap items-center gap-2 mt-2">
                <Badge variant="secondary" className="font-bold" style={gradoChipStyle(est.grado)}>
                  {est.grado || 'N/A'}
                </Badge>
                {!!est.matricula_grupo_id && (
                  <Badge variant="secondary" className="font-bold bg-white/10 border-white/10 text-slate-100">
                    {getGrupoLabel(est)}
                  </Badge>
                )}
              </div>
            </div>
          </div>
          <div className="relative flex-shrink-0">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setMenuOpen(menuOpen === est.key ? null : est.key)}
              className="h-9 w-9 text-slate-300 hover:bg-white/10"
            >
              <MoreVertical className="w-5 h-5" />
            </Button>
            {menuOpen === est.key && (
              <div className="absolute right-0 top-10 z-50 bg-[#0F2445] rounded-2xl shadow-2xl border border-white/10 py-1 min-w-[180px]">
                {est.kind === 'normal' ? (
                  <>
                    <button
                      onClick={() => { setSelectedEstudiante(est as any); setDetailOpen(true); setMenuOpen(null); }}
                      className="w-full text-left px-4 py-2 text-sm text-slate-100 hover:bg-white/5 flex items-center gap-2"
                    >
                      <User className="w-4 h-4" />
                      Ver detalles
                    </button>
                    <button
                      onClick={() => { handleEdit(est as any); setMenuOpen(null); }}
                      className="w-full text-left px-4 py-2 text-sm text-slate-100 hover:bg-white/5 flex items-center gap-2"
                    >
                      <Edit className="w-4 h-4" />
                      Editar
                    </button>
                    <button
                      onClick={() => { handleDelete(est.id); setMenuOpen(null); }}
                      className="w-full text-left px-4 py-2 text-sm text-rose-400 hover:bg-rose-500/10 flex items-center gap-2"
                    >
                      <Trash2 className="w-4 h-4" />
                      Eliminar
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => { openBulkEdit({ id: est.id, nombre: est.nombre, nombre_encargado: est.nombre_encargado ?? null, email_encargado: est.email_encargado ?? null, telefono_encargado: est.telefono_encargado ?? null, requiere_perfil_completo: !!est.requiere_perfil_completo, estado: est.estado === 1 } as any); setMenuOpen(null); }}
                      className="w-full text-left px-4 py-2 text-sm text-slate-100 hover:bg-white/5 flex items-center gap-2"
                    >
                      <Edit className="w-4 h-4" />
                      Editar
                    </button>
                    <button
                      onClick={() => { deleteBulk(est.id); setMenuOpen(null); }}
                      className="w-full text-left px-4 py-2 text-sm text-rose-400 hover:bg-rose-500/10 flex items-center gap-2"
                    >
                      <Trash2 className="w-4 h-4" />
                      Eliminar
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="px-6 pb-6 flex-1 flex flex-col gap-3">

        {est.nombre_encargado && (
          <div className="flex items-center gap-3 text-sm">
            <User className="w-4 h-4 text-[#FFC800] flex-shrink-0" />
            <span className="text-slate-200 truncate">{est.nombre_encargado}</span>
          </div>
        )}

        {est.email_encargado && (
          <div className="flex items-center gap-3 text-sm">
            <Mail className="w-4 h-4 text-[#00AEEF] flex-shrink-0" />
            <span className="text-slate-200 truncate">{est.email_encargado}</span>
          </div>
        )}

        {est.telefono_encargado && (
          <div className="flex items-center gap-3 text-sm">
            <Phone className="w-4 h-4 text-emerald-400" />
            <span className="text-slate-200">{est.telefono_encargado}</span>
          </div>
        )}

        {Array.isArray(est.dias) && est.dias.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-2 border-t border-white/10">
            {est.dias.map((dia) => (
              <span key={dia} className="text-xs bg-emerald-500/15 text-emerald-200 font-semibold px-2 py-1 rounded-full">
                {dia.slice(0, 3)}{(est as any).dias_turno && (est as any).dias_turno[dia] ? ` • ${(est as any).dias_turno[dia]}` : ''}
              </span>
            ))}
          </div>
        )}

        <div className="mt-auto pt-2">
          <Button
            size="sm"
            onClick={() => {
              if (est.kind === 'normal') return toggleEstado(est as any);
              return toggleBulkEstado({ id: est.id, nombre: est.nombre, estado: est.estado === 1 } as any);
            }}
            className={`w-full gap-2 border ${est.estado === 1
              ? 'bg-emerald-500/20 hover:bg-emerald-500/25 border-emerald-400/40 text-emerald-50'
              : 'bg-rose-500/15 hover:bg-rose-500/25 border-rose-400/40 text-rose-50'}`}
          >
            {est.estado === 1 ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
            {est.estado === 1 ? 'Activo' : 'Inactivo'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  const bulkByGrupo = useMemo(() => {
    const map = new Map<string, BulkEstudiante[]>();
    for (const s of bulkEstudiantes) {
      const gid = String((s as any).matricula_grupo_id ?? '');
      const list = map.get(gid) || [];
      list.push(s);
      map.set(gid, list);
    }
    return map;
  }, [bulkEstudiantes]);

  const unifiedByGrupoCount = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of unifiedStudents) {
      const gid = String((s as any).matricula_grupo_id ?? '');
      map.set(gid, (map.get(gid) || 0) + 1);
    }
    return map;
  }, [unifiedStudents]);

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-[50vh]">
      <div className="w-10 h-10 border-4 border-slate-200 border-t-blue-600 rounded-full animate-spin mb-4" />
      <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Cargando alumnado...</p>
    </div>
  );

  return (
    <div className="flex gap-6">
      {/* Sidebar izquierda - 30% */}
      <aside className="w-[30%] space-y-6 sticky top-24 self-start">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="w-5 h-5" style={{color: '#00AEEF'}} /> Filtros y vista
            </CardTitle>
            <CardDescription>Filtra, agrupa y cambia entre tabla o tarjetas</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Búsqueda rápida</Label>
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Nombre o encargado"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>Grado</Label>
                <Select value={gradoFiltro} onChange={(e) => setGradoFiltro(e.target.value)}>
                  <option value="">Todos</option>
                  {gradosDisponibles.map((g) => (
                    <option key={g} value={g}>{g}</option>
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
              <Label>Grupo</Label>
              <Select value={grupoFiltro} onChange={(e) => setGrupoFiltro(e.target.value)}>
                <option value="">Todos</option>
                <option value="sin_grupo">Sin grupo</option>
                {bulkGrupos.map((g) => (
                  <option key={g.id} value={String(g.id)}>{g.nombre_grupo || `Grupo #${g.id}`}</option>
                ))}
              </Select>
            </div>

            <div>
              <Label>Ordenar</Label>
              <Select value={sortMode} onChange={(e) => setSortMode(e.target.value as any)}>
                <option value="nombre_asc">Nombre A→Z</option>
                <option value="nombre_desc">Nombre Z→A</option>
                <option value="grado_asc">Grado A→Z</option>
                <option value="grado_desc">Grado Z→A</option>
                <option value="estado_activos">Activos primero</option>
                <option value="grupo_asc">Grupo A→Z</option>
                <option value="grupo_desc">Grupo Z→A</option>
                <option value="tipo_normal_primero">Regulares primero</option>
                <option value="tipo_bulk_primero">Bulk primero</option>
                <option value="perfil_incompleto_primero">Perfil incompleto primero</option>
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
              <Button
                size="sm"
                onClick={() => setGroupByMode((prev) => (prev === 'grado' ? 'none' : 'grado'))}
                className={`col-span-2 gap-2 font-bold transition-all ${groupByMode === 'grado' 
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-md' 
                  : 'bg-white/10 hover:bg-white/15 text-slate-200 border border-white/10'}`}
              >
                <Layers className="w-4 h-4" /> Agrupar por grado
              </Button>
              <Button
                size="sm"
                onClick={() => setGroupByMode((prev) => (prev === 'grupo' ? 'none' : 'grupo'))}
                className={`col-span-2 gap-2 font-bold transition-all ${groupByMode === 'grupo'
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-md'
                  : 'bg-white/10 hover:bg-white/15 text-slate-200 border border-white/10'}`}
              >
                <Users className="w-4 h-4" /> Agrupar por grupo
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="border-white/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="w-5 h-5" style={{ color: '#FFC800' }} /> Carga masiva
            </CardTitle>
            <CardDescription>Descarga el template y sube estudiantes en lote</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {bulkMsg && (
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-slate-100">
                {bulkMsg}
              </div>
            )}

            <div>
              <Label>Tipo de bulk</Label>
              <Select value={bulkTipo} onChange={(e) => setBulkTipo(e.target.value as any)}>
                <option value="estudiantes_bulk">Estudiantes (bulk)</option>
                <option value="grupo_matricula">Grupo matricula</option>
              </Select>
            </div>

            <div className="flex gap-2">
              <Button size="sm" className="font-bold" onClick={downloadBulkTemplate} disabled={bulkBusy}>
                Descargar template
              </Button>
              <div className="text-xs text-slate-400 font-semibold">Formato .xlsx</div>
            </div>

            <div className="space-y-2">
              <Label>Subir archivo</Label>
              <Input
                type="file"
                accept=".xlsx"
                onChange={(e) => {
                  setBulkFile(e.target.files?.[0] ?? null);
                  setBulkResult(null);
                }}
              />
              <Button size="sm" onClick={uploadBulkExcel} disabled={bulkBusy || bulkPreviewBusy || !bulkFile} className="font-bold">
                {bulkPreviewBusy ? 'Previsualizando…' : (bulkBusy ? 'Procesando…' : 'Previsualizar')}
              </Button>
              <div className="text-xs text-slate-400 font-semibold">
                La importacion real se ejecuta solo despues de confirmar la previsualizacion.
              </div>
            </div>

            {bulkResult && (
              <div className="mt-2 rounded-xl border border-white/10 bg-[#0F2445] p-3 space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-bold text-white">Resultado</span>
                  <span className="text-slate-300">{bulkResult?.bulkType ?? ''}</span>
                </div>
                {'attempted' in bulkResult && (
                  <div className="text-xs text-slate-300">
                    Filas procesadas: <b className="text-slate-100">{bulkResult.attempted ?? 0}</b> · Creadas: <b className="text-slate-100">{bulkResult.created ?? bulkResult.inserted ?? 0}</b> · Fallidas: <b className="text-slate-100">{bulkResult.failed ?? 0}</b>
                  </div>
                )}

                {(bulkResult.failures?.length ?? 0) > 0 && (
                  <div className="space-y-1">
                    <div className="text-xs font-bold text-[#FFC800]">Errores (se omitieron esas filas)</div>
                    <ul className="text-xs text-slate-200 space-y-1 max-h-40 overflow-auto pr-1">
                      {(bulkResult.failures ?? []).slice(0, 20).map((f: any, idx: number) => (
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

        {/* Grados - distribución */}
        <Card className="border-slate-200">
          <CardHeader>
            <CardTitle className="text-lg">Por Grado</CardTitle>
            <CardDescription className="text-xs">Distribución de estudiantes</CardDescription>
          </CardHeader>
          <CardContent>
            {filteredEstudiantes.length === 0 ? (
              <div className="text-xs text-slate-400 font-bold uppercase tracking-widest py-6 text-center">Sin datos</div>
            ) : (
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {(() => {
                  const gradoMap = new Map<string, number>();
                  filteredEstudiantes.forEach(e => {
                    if (e.grado) {
                      gradoMap.set(e.grado, (gradoMap.get(e.grado) || 0) + 1);
                    }
                  });
                  return Array.from(gradoMap).sort().map(([grado, count]) => (
                    <div key={grado} className="flex items-center justify-between p-2.5 rounded-lg border border-slate-200 hover:border-cyan-300 hover:bg-cyan-50/50 transition-all">
                      <div className="flex items-center gap-2.5">
                        <div 
                          className="w-7 h-7 rounded-lg border flex items-center justify-center font-bold text-xs text-white"
                          style={{ backgroundColor: GRADO_COLORES[grado] || '#e5e7eb' }}
                        >
                          {grado.charAt(0)}
                        </div>
                        <span className="font-semibold text-slate-800 text-sm">{grado}</span>
                      </div>
                      <span className="text-xs font-bold text-cyan-700 bg-cyan-50 px-2.5 py-1 rounded-full border border-cyan-200">
                        {count}
                      </span>
                    </div>
                  ));
                })()}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Grupos - distribución */}
        <Card className="border-slate-200">
          <CardHeader>
            <CardTitle className="text-lg">Por Grupo</CardTitle>
            <CardDescription className="text-xs">Distribución de estudiantes</CardDescription>
          </CardHeader>
          <CardContent>
            {filteredEstudiantes.length === 0 ? (
              <div className="text-xs text-slate-400 font-bold uppercase tracking-widest py-6 text-center">Sin datos</div>
            ) : (
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {(() => {
                  const groupMap = new Map<string, number>();
                  filteredEstudiantes.forEach((e) => {
                    const gid = String(e.matricula_grupo_id ?? '');
                    groupMap.set(gid, (groupMap.get(gid) || 0) + 1);
                  });

                  return Array.from(groupMap.entries())
                    .map(([gid, count]) => ({
                      gid,
                      nombre: gid ? (grupoNameById.get(gid) || `Grupo #${gid}`) : 'Sin grupo',
                      count,
                    }))
                    .sort((a, b) => {
                      const aSin = !a.gid;
                      const bSin = !b.gid;
                      if (aSin !== bSin) return aSin ? 1 : -1;
                      return a.nombre.localeCompare(b.nombre);
                    })
                    .map(({ gid, nombre, count }) => (
                      <div key={gid || 'sin_grupo'} className="flex items-center justify-between p-2.5 rounded-lg border border-slate-200 hover:border-cyan-300 hover:bg-cyan-50/50 transition-all">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <Users className="w-4 h-4 text-[#FFC800] flex-shrink-0" />
                          <span className="font-semibold text-slate-800 text-sm truncate">{nombre}</span>
                        </div>
                        <span className="text-xs font-bold text-cyan-700 bg-cyan-50 px-2.5 py-1 rounded-full border border-cyan-200">
                          {count}
                        </span>
                      </div>
                    ));
                })()}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Estado de Matrícula */}
        <Card className="border-slate-200">
          <CardHeader>
            <CardTitle className="text-lg">Estado Matrícula</CardTitle>
            <CardDescription className="text-xs">Estudiantes activos vs inactivos</CardDescription>
          </CardHeader>
          <CardContent>
            {filteredEstudiantes.length === 0 ? (
              <div className="text-xs text-slate-400 font-bold uppercase tracking-widest py-6 text-center">Sin datos</div>
            ) : (
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {(() => {
                  const estadoMap = new Map<boolean, number>();
                  filteredEstudiantes.forEach(e => {
                    const estado = e.estado === 1;
                    estadoMap.set(estado, (estadoMap.get(estado) || 0) + 1);
                  });
                  return [true, false].map((isActive) => {
                    const count = estadoMap.get(isActive) || 0;
                    if (count === 0) return null;
                    return (
                      <div key={isActive ? 'activo' : 'inactivo'} className="flex items-center justify-between p-2.5 rounded-lg border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/50 transition-all">
                        <div className="flex items-center gap-2.5 flex-1">
                          <div className={`w-7 h-7 rounded-lg border flex items-center justify-center font-bold text-xs text-white ${isActive ? 'bg-emerald-500 border-emerald-300' : 'bg-slate-400 border-slate-300'}`}>
                            {isActive ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                          </div>
                          <span className="font-semibold text-slate-800 text-sm">{isActive ? 'Activos' : 'Inactivos'}</span>
                        </div>
                        <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${isActive ? 'text-emerald-700 bg-emerald-50 border-emerald-200' : 'text-slate-700 bg-slate-50 border-slate-200'}`}>
                          {count}
                        </span>
                      </div>
                    );
                  }).filter(Boolean);
                })()}
              </div>
            )}
          </CardContent>
        </Card>
      </aside>

      {/* Contenido principal - 70% */}
      <div className="flex-1 space-y-10">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-white/10 pb-8">
          <div>
            <h1 className="text-3xl font-black text-white tracking-tight">Alumnado</h1>
            <p className="text-slate-300 font-medium mt-2">Registro de estudiantes matriculados</p>
          </div>
          <Button
            onClick={async () => {
              setActionsOpen(true);
              setActionTab('crear_grupo');
              await ensureCatalogos();
            }}
            variant="primary"
            className="h-12 px-8 gap-3 bg-[#00AEEF] hover:bg-[#00AEEF]/80 text-[#051026] font-bold"
          >
            <Wand2 className="w-5 h-5" />
            Acciones
          </Button>
        </header>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={() => setBandeja('estudiantes')}
            className={`gap-2 font-bold transition-all ${bandeja === 'estudiantes'
              ? 'bg-[#FFC800] hover:bg-[#FFC800]/90 text-[#051026]'
              : 'bg-white/10 hover:bg-white/15 text-slate-200 border border-white/10'}`}
          >
            <GraduationCap className="w-4 h-4" /> Estudiantes
          </Button>
          <Button
            size="sm"
            onClick={() => setBandeja('grupos')}
            className={`gap-2 font-bold transition-all ${bandeja === 'grupos'
              ? 'bg-[#FFC800] hover:bg-[#FFC800]/90 text-[#051026]'
              : 'bg-white/10 hover:bg-white/15 text-slate-200 border border-white/10'}`}
          >
            <FolderKanban className="w-4 h-4" /> Grupos
          </Button>
        </div>

      {bandeja === 'estudiantes' ? (
      <section className="space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h2 className="text-2xl font-black text-white tracking-tight">Estudiantes</h2>
            <p className="text-slate-300 text-sm font-medium">Tabla administrativa con activación y agrupamiento</p>
          </div>
          <div className="text-sm font-semibold text-slate-200">
            Mostrando {filteredStats.total} / {stats.total} · Activos {filteredStats.activos} · Inactivos {filteredStats.inactivos}
          </div>
        </div>

        {filteredEstudiantes.length === 0 && (
          <Card className="border border-dashed border-slate-200 bg-slate-50">
            <CardContent className="py-10 text-center text-sm font-semibold text-slate-500">No hay alumnos que coincidan con los filtros aplicados.</CardContent>
          </Card>
        )}

        <div className="space-y-6">
          {/* Sección de Estudiantes */}
          {viewMode === 'tabla' ? (
            <>
              {groupByMode === 'grado' ? (
                agrupadosPorGrado.map(({ grado, lista }) => (
                  <Card key={grado} className="border-slate-200">
                    <CardHeader className="flex-row items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg border flex items-center justify-center font-black" style={gradoChipStyle(grado)}>
                          {grado.charAt(0)}
                        </div>
                        <div>
                          <CardTitle className="text-lg">{grado}</CardTitle>
                          <CardDescription>{lista.length} alumno(s) en este grado</CardDescription>
                        </div>
                      </div>
                      <Badge variant="secondary">Activos: {lista.filter(e => e.estado === 1).length} · Inactivos: {lista.filter(e => e.estado !== 1).length}</Badge>
                    </CardHeader>
                    <CardContent className="p-0">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Nombre</TableHead>
                            <TableHead>Grado</TableHead>
                            <TableHead>Grupo</TableHead>
                            <TableHead>Estado</TableHead>
                            <TableHead>Contacto</TableHead>
                            <TableHead>Días</TableHead>
                            <TableHead className="text-right">Acciones</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {lista.map((est) => (
                            <TableRow key={`${grado}-${est.key}`}>
                              <TableCell className="font-semibold text-slate-900">{est.nombre}</TableCell>
                              <TableCell>
                                <span className="px-3 py-1 rounded-full border text-xs font-bold" style={gradoChipStyle(est.grado)}>
                                  {est.grado || '—'}
                                </span>
                              </TableCell>
                              <TableCell>
                                <span className="text-xs font-semibold text-slate-700">{getGrupoLabel(est)}</span>
                              </TableCell>
                              <TableCell>
                                <Button
                                  size="sm"
                                  onClick={() => {
                                    if (est.kind === 'normal') return toggleEstado(est as any);
                                    return toggleBulkEstado({ id: est.id, nombre: est.nombre, estado: est.estado === 1 } as any);
                                  }}
                                  className={`gap-2 border ${est.estado === 1
                                    ? 'bg-emerald-500/20 hover:bg-emerald-500/25 border-emerald-400/40 text-emerald-50'
                                    : 'bg-rose-500/15 hover:bg-rose-500/25 border-rose-400/40 text-rose-50'}`}
                                >
                                  {est.estado === 1 ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                                  {est.estado === 1 ? 'Activo' : 'Inactivo'}
                                </Button>
                              </TableCell>
                              <TableCell className="space-y-1">
                                {est.nombre_encargado && <div className="flex items-center gap-2 text-xs text-slate-600"><User className="w-3 h-3 text-emerald-500" />{est.nombre_encargado}</div>}
                                {est.email_encargado && <div className="flex items-center gap-2 text-xs text-slate-600"><Mail className="w-3 h-3 text-blue-500" />{est.email_encargado}</div>}
                                {est.telefono_encargado && <div className="flex items-center gap-2 text-xs text-slate-600"><Phone className="w-3 h-3 text-emerald-500" />{est.telefono_encargado}</div>}
                                {!est.nombre_encargado && !est.email_encargado && !est.telefono_encargado ? <span className="text-xs text-slate-400">Sin contacto</span> : null}
                              </TableCell>
                              <TableCell>
                                  {Array.isArray(est.dias) && est.dias.length > 0 ? (
                                  <div className="flex flex-wrap gap-1">
                                    {est.dias.map((dia) => (
                                      <Badge key={dia} variant="secondary" className="text-[11px]">
                                          {dia.slice(0, 3)}{(est as any).dias_turno && (est as any).dias_turno[dia] ? ` • ${(est as any).dias_turno[dia]}` : ''}
                                      </Badge>
                                    ))}
                                  </div>
                                ) : (
                                  <span className="text-xs text-slate-400">Sin horario</span>
                                )}
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex justify-end gap-2">
                                    {est.kind === 'normal' ? (
                                      <>
                                        <Button size="sm" variant="ghost" onClick={() => { setSelectedEstudiante(est as any); setDetailOpen(true); }} className="text-slate-700">Detalle</Button>
                                        <Button size="sm" variant="ghost" onClick={() => handleEdit(est as any)} className="text-blue-700">Editar</Button>
                                        <Button size="sm" variant="ghost" onClick={() => handleDelete(est.id)} className="text-red-600">Eliminar</Button>
                                      </>
                                    ) : (
                                      <>
                                        <Button size="sm" variant="ghost" onClick={() => openBulkEdit({ id: est.id, nombre: est.nombre, nombre_encargado: est.nombre_encargado ?? null, email_encargado: est.email_encargado ?? null, telefono_encargado: est.telefono_encargado ?? null, requiere_perfil_completo: !!est.requiere_perfil_completo, estado: est.estado === 1 } as any)} className="text-blue-700">Editar</Button>
                                        <Button size="sm" variant="ghost" onClick={() => deleteBulk(est.id)} className="text-red-600">Eliminar</Button>
                                      </>
                                    )}
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                ))
              ) : groupByMode === 'grupo' ? (
                agrupadosPorGrupo.map(({ gid, grupo, lista }) => (
                  <Card key={gid || 'sin_grupo'} className="border-slate-200">
                    <CardHeader className="flex-row items-center justify-between">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-lg border flex items-center justify-center font-black bg-white/10 border-white/10 text-white">
                          <Users className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                          <CardTitle className="text-lg truncate">{grupo}</CardTitle>
                          <CardDescription>{lista.length} alumno(s) en este grupo</CardDescription>
                        </div>
                      </div>
                      <Badge variant="secondary">Activos: {lista.filter(e => e.estado === 1).length} · Inactivos: {lista.filter(e => e.estado !== 1).length}</Badge>
                    </CardHeader>
                    <CardContent className="p-0">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Nombre</TableHead>
                            <TableHead>Grado</TableHead>
                            <TableHead>Grupo</TableHead>
                            <TableHead>Estado</TableHead>
                            <TableHead>Contacto</TableHead>
                            <TableHead>Días</TableHead>
                            <TableHead className="text-right">Acciones</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {lista.map((est) => (
                            <TableRow key={`${gid || 'sin'}-${est.key}`}>
                              <TableCell className="font-semibold text-slate-900">{est.nombre}</TableCell>
                              <TableCell>
                                <span className="px-3 py-1 rounded-full border text-xs font-bold" style={gradoChipStyle(est.grado)}>
                                  {est.grado || '—'}
                                </span>
                              </TableCell>
                              <TableCell>
                                <span className="text-xs font-semibold text-slate-700">{getGrupoLabel(est)}</span>
                              </TableCell>
                              <TableCell>
                                <Button
                                  size="sm"
                                  onClick={() => {
                                    if (est.kind === 'normal') return toggleEstado(est as any);
                                    return toggleBulkEstado({ id: est.id, nombre: est.nombre, estado: est.estado === 1 } as any);
                                  }}
                                  className={`gap-2 border ${est.estado === 1
                                    ? 'bg-emerald-500/20 hover:bg-emerald-500/25 border-emerald-400/40 text-emerald-50'
                                    : 'bg-rose-500/15 hover:bg-rose-500/25 border-rose-400/40 text-rose-50'}`}
                                >
                                  {est.estado === 1 ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                                  {est.estado === 1 ? 'Activo' : 'Inactivo'}
                                </Button>
                              </TableCell>
                              <TableCell className="space-y-1">
                                {est.nombre_encargado && <div className="flex items-center gap-2 text-xs text-slate-600"><User className="w-3 h-3 text-emerald-500" />{est.nombre_encargado}</div>}
                                {est.email_encargado && <div className="flex items-center gap-2 text-xs text-slate-600"><Mail className="w-3 h-3 text-blue-500" />{est.email_encargado}</div>}
                                {est.telefono_encargado && <div className="flex items-center gap-2 text-xs text-slate-600"><Phone className="w-3 h-3 text-emerald-500" />{est.telefono_encargado}</div>}
                                {!est.nombre_encargado && !est.email_encargado && !est.telefono_encargado ? <span className="text-xs text-slate-400">Sin contacto</span> : null}
                              </TableCell>
                              <TableCell>
                                {Array.isArray(est.dias) && est.dias.length > 0 ? (
                                  <div className="flex flex-wrap gap-1">
                                    {est.dias.map((dia) => (
                                      <Badge key={dia} variant="secondary" className="text-[11px]">
                                        {dia.slice(0, 3)}{(est as any).dias_turno && (est as any).dias_turno[dia] ? ` • ${(est as any).dias_turno[dia]}` : ''}
                                      </Badge>
                                    ))}
                                  </div>
                                ) : (
                                  <span className="text-xs text-slate-400">Sin horario</span>
                                )}
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex justify-end gap-2">
                                  {est.kind === 'normal' ? (
                                    <>
                                      <Button size="sm" variant="ghost" onClick={() => { setSelectedEstudiante(est as any); setDetailOpen(true); }} className="text-slate-700">Detalle</Button>
                                      <Button size="sm" variant="ghost" onClick={() => handleEdit(est as any)} className="text-blue-700">Editar</Button>
                                      <Button size="sm" variant="ghost" onClick={() => handleDelete(est.id)} className="text-red-600">Eliminar</Button>
                                    </>
                                  ) : (
                                    <>
                                      <Button size="sm" variant="ghost" onClick={() => openBulkEdit({ id: est.id, nombre: est.nombre, nombre_encargado: est.nombre_encargado ?? null, email_encargado: est.email_encargado ?? null, telefono_encargado: est.telefono_encargado ?? null, requiere_perfil_completo: !!est.requiere_perfil_completo, estado: est.estado === 1 } as any)} className="text-blue-700">Editar</Button>
                                      <Button size="sm" variant="ghost" onClick={() => deleteBulk(est.id)} className="text-red-600">Eliminar</Button>
                                    </>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                ))
              ) : (
                <Card className="border-slate-200">
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Nombre</TableHead>
                          <TableHead>Grado</TableHead>
                          <TableHead>Grupo</TableHead>
                          <TableHead>Estado</TableHead>
                          <TableHead>Contacto</TableHead>
                          <TableHead>Días</TableHead>
                          <TableHead className="text-right">Acciones</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredEstudiantes.map((est) => (
                          <TableRow key={est.key}>
                            <TableCell className="font-semibold text-slate-900">{est.nombre}</TableCell>
                            <TableCell>
                              <span className="px-3 py-1 rounded-full border text-xs font-bold" style={gradoChipStyle(est.grado)}>
                                {est.grado || '—'}
                              </span>
                            </TableCell>
                            <TableCell>
                              <span className="text-xs font-semibold text-slate-700">{getGrupoLabel(est)}</span>
                            </TableCell>
                            <TableCell>
                              <Button
                                size="sm"
                                onClick={() => {
                                  if (est.kind === 'normal') return toggleEstado(est as any);
                                  return toggleBulkEstado({ id: est.id, nombre: est.nombre, estado: est.estado === 1 } as any);
                                }}
                                className={`gap-2 border ${est.estado === 1
                                  ? 'bg-emerald-500/20 hover:bg-emerald-500/25 border-emerald-400/40 text-emerald-50'
                                  : 'bg-rose-500/15 hover:bg-rose-500/25 border-rose-400/40 text-rose-50'}`}
                              >
                                {est.estado === 1 ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                                {est.estado === 1 ? 'Activo' : 'Inactivo'}
                              </Button>
                            </TableCell>
                            <TableCell className="space-y-1">
                              {est.nombre_encargado && <div className="flex items-center gap-2 text-xs text-slate-600"><User className="w-3 h-3 text-emerald-500" />{est.nombre_encargado}</div>}
                              {est.email_encargado && <div className="flex items-center gap-2 text-xs text-slate-600"><Mail className="w-3 h-3 text-blue-500" />{est.email_encargado}</div>}
                              {est.telefono_encargado && <div className="flex items-center gap-2 text-xs text-slate-600"><Phone className="w-3 h-3 text-emerald-500" />{est.telefono_encargado}</div>}
                              {!est.nombre_encargado && !est.email_encargado && !est.telefono_encargado ? <span className="text-xs text-slate-400">Sin contacto</span> : null}
                            </TableCell>
                            <TableCell>
                              {Array.isArray(est.dias) && est.dias.length > 0 ? (
                                <div className="flex flex-wrap gap-1">
                                  {est.dias.map((dia) => (
                                    <Badge key={dia} variant="secondary" className="text-[11px]">
                                      {dia.slice(0, 3)}{(est as any).dias_turno && (est as any).dias_turno[dia] ? ` • ${(est as any).dias_turno[dia]}` : ''}
                                    </Badge>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-xs text-slate-400">Sin horario</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                {est.kind === 'normal' ? (
                                  <>
                                    <Button size="sm" variant="ghost" onClick={() => { setSelectedEstudiante(est as any); setDetailOpen(true); }} className="text-slate-700">Detalle</Button>
                                    <Button size="sm" variant="ghost" onClick={() => handleEdit(est as any)} className="text-blue-700">Editar</Button>
                                    <Button size="sm" variant="ghost" onClick={() => handleDelete(est.id)} className="text-red-600">Eliminar</Button>
                                  </>
                                ) : (
                                  <>
                                    <Button size="sm" variant="ghost" onClick={() => openBulkEdit({ id: est.id, nombre: est.nombre, nombre_encargado: est.nombre_encargado ?? null, email_encargado: est.email_encargado ?? null, telefono_encargado: est.telefono_encargado ?? null, requiere_perfil_completo: !!est.requiere_perfil_completo, estado: est.estado === 1 } as any)} className="text-blue-700">Editar</Button>
                                    <Button size="sm" variant="ghost" onClick={() => deleteBulk(est.id)} className="text-red-600">Eliminar</Button>
                                  </>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}
            </>
          ) : (
            groupByMode === 'none' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {filteredEstudiantes.map((est) => (
                  <StudentCardItem key={est.key} est={est} />
                ))}
              </div>
            ) : (
              <div className="space-y-8">
                {groupByMode === 'grado' ? (
                  agrupadosPorGrado.map(({ grado, lista }) => (
                    <div key={`grado-${grado}`} className="space-y-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-lg border flex items-center justify-center font-black" style={gradoChipStyle(grado)}>
                            {grado.charAt(0)}
                          </div>
                          <div className="min-w-0">
                            <div className="text-white font-black text-lg truncate">{grado}</div>
                            <div className="text-slate-300 text-sm font-semibold">{lista.length} estudiante(s)</div>
                          </div>
                        </div>
                        <Badge variant="secondary">Activos: {lista.filter(e => e.estado === 1).length} · Inactivos: {lista.filter(e => e.estado !== 1).length}</Badge>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                        {lista.map((est) => (
                          <StudentCardItem key={`${grado}-${est.key}`} est={est} />
                        ))}
                      </div>
                    </div>
                  ))
                ) : (
                  agrupadosPorGrupo.map(({ gid, grupo, lista }) => (
                    <div key={`grupo-${gid || 'sin'}`} className="space-y-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-lg border flex items-center justify-center font-black bg-white/10 border-white/10 text-white">
                            <Users className="w-5 h-5" />
                          </div>
                          <div className="min-w-0">
                            <div className="text-white font-black text-lg truncate">{grupo}</div>
                            <div className="text-slate-300 text-sm font-semibold">{lista.length} estudiante(s)</div>
                          </div>
                        </div>
                        <Badge variant="secondary">Activos: {lista.filter(e => e.estado === 1).length} · Inactivos: {lista.filter(e => e.estado !== 1).length}</Badge>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                        {lista.map((est) => (
                          <StudentCardItem key={`${gid || 'sin'}-${est.key}`} est={est} />
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )
          )}
        </div>
      </section>
      ) : (
        <section className="space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <h2 className="text-2xl font-black text-white tracking-tight">Grupos</h2>
              <p className="text-slate-300 text-sm font-medium">Toca un grupo para agregar/quitar estudiantes.</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="text-sm font-semibold text-slate-200 ml-2">{bulkGrupos.length} grupo(s)</div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            <Card className="border-white/10">
              <CardHeader>
                <CardTitle className="text-base text-white">Sin grupo</CardTitle>
                <CardDescription className="text-slate-300">{(unifiedByGrupoCount.get('') ?? 0)} estudiante(s)</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-xs text-slate-400">Estos estudiantes aún no pertenecen a un grupo.</div>
              </CardContent>
            </Card>

            {bulkGrupos.map((g) => (
              <Card
                key={`g:${g.id}`}
                className="border-white/10 hover:border-[#00AEEF]/30 cursor-pointer"
                onClick={() => openGrupoAdmin(String(g.id))}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') openGrupoAdmin(String(g.id));
                }}
              >
                <CardHeader>
                  <CardTitle className="text-base text-white truncate">{g.nombre_grupo || `Grupo #${g.id}`}</CardTitle>
                  <CardDescription className="text-slate-300">
                    {g.curso_nombre ? `${g.curso_nombre}` : '—'}{g.tutor_nombre ? ` · ${g.tutor_nombre}` : ''}{g.turno ? ` · ${g.turno}` : ''}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-slate-200">
                    <Users className="w-4 h-4 text-[#FFC800]" />
                    <span className="font-bold">{(g.linked_count ?? unifiedByGrupoCount.get(String(g.id)) ?? (bulkByGrupo.get(String(g.id)) ?? []).length)}</span>
                    <span className="text-sm text-slate-400">estudiante(s)</span>
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={(e) => {
                      e.stopPropagation();
                      openGrupoAdmin(String(g.id));
                    }}
                    className="font-bold"
                  >
                    Administrar
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* Modal detalles estudiante */}
      <Dialog
        isOpen={detailOpen && !!selectedEstudiante}
        onClose={() => { setDetailOpen(false); setSelectedEstudiante(null); }}
        title={selectedEstudiante ? `Detalles: ${selectedEstudiante.nombre}` : 'Detalles'}
        maxWidthClass="max-w-2xl"
      >
        {!selectedEstudiante ? (
          <div className="text-sm text-slate-300">Selecciona un estudiante para ver detalles.</div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">{selectedEstudiante.kind === 'normal' ? 'Manual' : 'Bulk'}</Badge>
              <Badge variant={selectedEstudiante.estado === 1 ? 'success' : 'destructive'}>
                {selectedEstudiante.estado === 1 ? 'Activo' : 'Inactivo'}
              </Badge>
              {selectedEstudiante.grado && <Badge variant="secondary">Grado: {selectedEstudiante.grado}</Badge>}
              <Badge variant="secondary">
                Grupo: {selectedEstudiante.matricula_grupo_id ? (grupoNameById.get(String(selectedEstudiante.matricula_grupo_id)) || `Grupo #${selectedEstudiante.matricula_grupo_id}`) : 'Sin grupo'}
              </Badge>
            </div>

            <div className="grid grid-cols-1 gap-4">
              <div className="space-y-2">
                <div className="text-xs font-bold uppercase tracking-widest text-slate-400">Encargado</div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-slate-200">
                    <User className="w-4 h-4 text-[#FFC800]" />
                    <span className="truncate">{selectedEstudiante.nombre_encargado || 'Sin nombre de encargado'}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-slate-200">
                    <Mail className="w-4 h-4 text-[#00AEEF]" />
                    <span className="truncate">{selectedEstudiante.email_encargado || 'Sin correo de encargado'}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-slate-200">
                    <Phone className="w-4 h-4 text-emerald-400" />
                    <span className="truncate">{selectedEstudiante.telefono_encargado || 'Sin teléfono de encargado'}</span>
                  </div>
                </div>
              </div>
            </div>

            {Array.isArray(selectedEstudiante.dias) && selectedEstudiante.dias.length > 0 && (
              <div className="space-y-2">
                <div className="text-xs font-bold uppercase tracking-widest text-slate-400">Días</div>
                <div className="flex flex-wrap gap-2">
                  {selectedEstudiante.dias.map((dia) => (
                    <span key={dia} className="text-xs bg-emerald-500/15 text-emerald-200 font-semibold px-2 py-1 rounded-full">
                      {dia}{selectedEstudiante.dias_turno && selectedEstudiante.dias_turno[dia] ? ` · ${selectedEstudiante.dias_turno[dia]}` : ''}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Dialog>

      {/* Modal administrar grupo */}
      <Dialog
        isOpen={!!grupoAdminId && grupoAdminOpen}
        onClose={() => { setGrupoAdminOpen(false); setGrupoAdminId(null); setGrupoSelectedToAdd([]); setGrupoSelectedToAddNormales([]); }}
        title={selectedGrupoAdmin ? (selectedGrupoAdmin.nombre_grupo || `Grupo #${selectedGrupoAdmin.id}`) : 'Grupo'}
        maxWidthClass="max-w-5xl"
      >
        {!selectedGrupoAdmin ? (
          <div className="text-sm text-slate-300">Selecciona un grupo para administrar.</div>
        ) : (
          <div className="space-y-6">
            <div className="text-sm text-slate-300">
              {selectedGrupoAdmin.curso_nombre ? `${selectedGrupoAdmin.curso_nombre}` : '—'}
              {selectedGrupoAdmin.tutor_nombre ? ` · ${selectedGrupoAdmin.tutor_nombre}` : ''}
              {selectedGrupoAdmin.turno ? ` · ${selectedGrupoAdmin.turno}` : ''}
            </div>

            <div className="flex items-center justify-end">
              <Button variant="ghost" size="sm" onClick={deleteGrupo} className="text-rose-300 hover:text-rose-200">
                Eliminar grupo
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Miembros */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="font-black text-white">Miembros</div>
                  <Badge variant="secondary">{grupoMembers.length + grupoMembersNormales.length}</Badge>
                </div>
                <Input
                  value={grupoMembersSearch}
                  onChange={(e) => setGrupoMembersSearch(e.target.value)}
                  placeholder="Buscar en miembros..."
                />
                <div className="space-y-2 max-h-[45vh] overflow-y-auto pr-1">
                  {grupoMembersNormales
                    .filter((s: any) => {
                      const q = grupoMembersSearch.trim().toLowerCase();
                      if (!q) return true;
                      return `${s.nombre} ${s.nombre_encargado ?? ''} ${s.email_encargado ?? ''} ${s.telefono_encargado ?? ''}`.toLowerCase().includes(q);
                    })
                    .map((s: any) => (
                      <div key={`mn-${s.id}`} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-bold text-white truncate">{s.nombre}</div>
                          <div className="text-xs text-slate-300 truncate">
                            {s.nombre_encargado ? s.nombre_encargado : 'Sin encargado'}
                            {s.email_encargado ? ` · ${s.email_encargado}` : ''}
                            {s.telefono_encargado ? ` · ${s.telefono_encargado}` : ''}
                          </div>
                          <div className="text-[11px] text-slate-400 mt-1">Manual</div>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => removeFromGrupoNormal(s.id)} className="text-rose-300 hover:text-rose-200">
                          Quitar
                        </Button>
                      </div>
                    ))}

                  {grupoMembers
                    .filter((s) => {
                      const q = grupoMembersSearch.trim().toLowerCase();
                      if (!q) return true;
                      return `${s.nombre} ${(s as any).nombre_encargado ?? ''} ${(s as any).email_encargado ?? (s as any).correo ?? ''} ${(s as any).telefono_encargado ?? (s as any).telefono ?? ''}`.toLowerCase().includes(q);
                    })
                    .map((s) => (
                      <div key={`m-${s.id}`} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-bold text-white truncate">{s.nombre}</div>
                          <div className="text-xs text-slate-300 truncate">
                            {(s as any).nombre_encargado ? (s as any).nombre_encargado : 'Sin encargado'}
                            {(s as any).email_encargado ? ` · ${(s as any).email_encargado}` : ((s as any).correo ? ` · ${(s as any).correo}` : '')}
                            {(s as any).telefono_encargado ? ` · ${(s as any).telefono_encargado}` : ((s as any).telefono ? ` · ${(s as any).telefono}` : '')}
                          </div>
                          <div className="text-[11px] text-slate-400 mt-1">Bulk</div>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => removeFromGrupo(s.id)} className="text-rose-300 hover:text-rose-200">
                          Quitar
                        </Button>
                      </div>
                    ))}
                  {(grupoMembers.length + grupoMembersNormales.length) === 0 && (
                    <div className="text-xs text-slate-400 font-bold uppercase tracking-widest py-6 text-center">Sin miembros</div>
                  )}
                </div>
              </div>

              {/* Agregar */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="font-black text-white">Agregar estudiantes</div>
                  <Badge variant="secondary">Seleccionados: {grupoSelectedToAdd.length + grupoSelectedToAddNormales.length}</Badge>
                </div>
                <Input
                  value={grupoAddSearch}
                  onChange={(e) => setGrupoAddSearch(e.target.value)}
                  placeholder="Buscar por nombre/encargado..."
                />
                <div className="space-y-2 max-h-[45vh] overflow-y-auto pr-1">
                  {grupoCandidatesNormales
                    .filter((s: any) => {
                      const q = grupoAddSearch.trim().toLowerCase();
                      if (!q) return true;
                      return `${s.nombre} ${s.nombre_encargado ?? ''} ${s.email_encargado ?? ''} ${s.telefono_encargado ?? ''}`.toLowerCase().includes(q);
                    })
                    .slice(0, 200)
                    .map((s: any) => {
                      const checked = grupoSelectedToAddNormales.includes(s.id);
                      const currentGrupo = String((s as any).matricula_grupo_id ?? '');
                      const currentGrupoName = currentGrupo ? (grupoNameById.get(currentGrupo) || `Grupo #${currentGrupo}`) : 'Sin grupo';
                      return (
                        <label key={`cn-${s.id}`} className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 cursor-pointer hover:bg-white/10">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => {
                              const next = e.target.checked;
                              setGrupoSelectedToAddNormales((prev) => {
                                if (next) return Array.from(new Set([...prev, s.id]));
                                return prev.filter((x) => x !== s.id);
                              });
                            }}
                          />
                          <div className="min-w-0">
                            <div className="font-bold text-white truncate">{s.nombre}</div>
                            <div className="text-xs text-slate-300 truncate">
                              {s.nombre_encargado ? s.nombre_encargado : 'Sin encargado'}
                              {s.email_encargado ? ` · ${s.email_encargado}` : ''}
                              {s.telefono_encargado ? ` · ${s.telefono_encargado}` : ''}
                            </div>
                            <div className="text-[11px] text-slate-400 mt-1">Manual · Actualmente: {currentGrupoName}</div>
                          </div>
                        </label>
                      );
                    })}

                  {grupoCandidates
                    .filter((s) => {
                      const q = grupoAddSearch.trim().toLowerCase();
                      if (!q) return true;
                      return `${s.nombre} ${(s as any).nombre_encargado ?? ''} ${(s as any).email_encargado ?? (s as any).correo ?? ''} ${(s as any).telefono_encargado ?? (s as any).telefono ?? ''}`.toLowerCase().includes(q);
                    })
                    .slice(0, 200)
                    .map((s) => {
                      const checked = grupoSelectedToAdd.includes(s.id);
                      const currentGrupo = String((s as any).matricula_grupo_id ?? '');
                      const currentGrupoName = currentGrupo ? (grupoNameById.get(currentGrupo) || `Grupo #${currentGrupo}`) : 'Sin grupo';
                      return (
                        <label key={`c-${s.id}`} className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 cursor-pointer hover:bg-white/10">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => {
                              const next = e.target.checked;
                              setGrupoSelectedToAdd((prev) => {
                                if (next) return Array.from(new Set([...prev, s.id]));
                                return prev.filter((x) => x !== s.id);
                              });
                            }}
                          />
                          <div className="min-w-0">
                            <div className="font-bold text-white truncate">{s.nombre}</div>
                            <div className="text-xs text-slate-300 truncate">
                              {(s as any).nombre_encargado ? (s as any).nombre_encargado : 'Sin encargado'}
                              {(s as any).email_encargado ? ` · ${(s as any).email_encargado}` : ((s as any).correo ? ` · ${(s as any).correo}` : '')}
                              {(s as any).telefono_encargado ? ` · ${(s as any).telefono_encargado}` : ((s as any).telefono ? ` · ${(s as any).telefono}` : '')}
                            </div>
                            <div className="text-[11px] text-slate-400 mt-1">Bulk · Actualmente: {currentGrupoName}</div>
                          </div>
                        </label>
                      );
                    })}
                  {(grupoCandidates.length + grupoCandidatesNormales.length) === 0 && (
                    <div className="text-xs text-slate-400 font-bold uppercase tracking-widest py-6 text-center">No hay candidatos</div>
                  )}
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-white/10">
                  <Button variant="secondary" size="sm" onClick={() => { setGrupoSelectedToAdd([]); setGrupoSelectedToAddNormales([]); }}>
                    Limpiar
                  </Button>
                  <Button size="sm" onClick={addSelectedToGrupo} disabled={(grupoSelectedToAdd.length + grupoSelectedToAddNormales.length) === 0} className="font-bold">
                    Agregar al grupo
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </Dialog>

      {/* Modal Acciones */}
      <Dialog isOpen={actionsOpen} onClose={() => { setActionsOpen(false); setActionTab('crear_grupo'); }} title="Acciones">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setActionsOpen(false); setActionTab('crear_grupo'); }}
              className="gap-2"
            >
              <ArrowLeft className="w-4 h-4" /> Atrás
            </Button>
            <div className="text-xs text-slate-400 font-semibold">Click afuera cierra</div>
          </div>
          <div className="text-sm text-slate-300">Crea grupos y gestiona el alumnado.</div>

          <div className="flex gap-2 flex-wrap">
            <Button
              size="sm"
              onClick={async () => { await ensureCatalogos(); setActionTab('crear_grupo'); }}
              className={`gap-2 font-bold transition-all ${actionTab === 'crear_grupo'
                ? 'bg-[#00AEEF] hover:bg-[#00AEEF]/80 text-[#051026]'
                : 'bg-white/10 hover:bg-white/15 text-slate-200 border border-white/10'}`}
            >
              <FolderKanban className="w-4 h-4" /> Crear grupo
            </Button>
            <Button
              size="sm"
              onClick={() => { setActionTab('nuevo_estudiante'); resetForm(); setShowModal(true); setActionsOpen(false); }}
              className="gap-2 font-bold bg-white/10 hover:bg-white/15 text-slate-200 border border-white/10"
            >
              <Plus className="w-4 h-4" /> Nuevo estudiante
            </Button>
          </div>

          {actionTab === 'crear_grupo' && (
            <Card className="border-white/10 bg-white/5">
              <CardHeader>
                <CardTitle className="text-white">Nuevo grupo</CardTitle>
                <CardDescription className="text-slate-300">Crea un grupo para organizar estudiantes.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {grupoCreateMsg && (
                  <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-slate-100">
                    {grupoCreateMsg}
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>Nombre del grupo</Label>
                    <Input value={grupoForm.nombre_grupo} onChange={(e) => setGrupoForm((p) => ({ ...p, nombre_grupo: e.target.value }))} />
                  </div>
                  <div>
                    <Label>Turno</Label>
                    <Select value={grupoForm.turno} onChange={(e) => setGrupoForm((p) => ({ ...p, turno: e.target.value }))}>
                      <option value="">(Opcional)</option>
                      <option value="Tarde">Tarde</option>
                      <option value="Noche">Noche</option>
                    </Select>
                  </div>
                  <div>
                    <Label>Curso</Label>
                    <Select value={grupoForm.curso_id} onChange={(e) => setGrupoForm((p) => ({ ...p, curso_id: e.target.value }))}>
                      <option value="">Selecciona</option>
                      {cursosCatalog.map((c) => (
                        <option key={c.id} value={String(c.id)}>{c.nombre}</option>
                      ))}
                    </Select>
                  </div>
                  <div>
                    <Label>Tutor</Label>
                    <Select value={grupoForm.tutor_id} onChange={(e) => setGrupoForm((p) => ({ ...p, tutor_id: e.target.value }))}>
                      <option value="">Selecciona</option>
                      {tutoresCatalog.map((t) => (
                        <option key={t.id} value={String(t.id)}>{t.nombre}</option>
                      ))}
                    </Select>
                  </div>
                  <div>
                    <Label>Estudiantes esperados</Label>
                    <Input value={grupoForm.cantidad_estudiantes_esperados} onChange={(e) => setGrupoForm((p) => ({ ...p, cantidad_estudiantes_esperados: e.target.value }))} />
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button onClick={createGrupo} disabled={grupoCreateBusy} className="font-bold">
                    {grupoCreateBusy ? 'Creando…' : 'Crear grupo'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </Dialog>

      <Dialog
        isOpen={bulkPreviewOpen}
        onClose={() => setBulkPreviewOpen(false)}
        title="Previsualización de importación"
        maxWidthClass="max-w-5xl"
      >
        {bulkPreviewErr ? (
          <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm font-bold text-rose-100">
            {bulkPreviewErr}
          </div>
        ) : null}

        {!bulkPreviewErr && bulkPreview ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="info" className="font-extrabold">{String(bulkPreview.bulkType || 'bulk')}</Badge>
              {bulkPreview?.warnings?.duplicate_nombre_grado_in_file?.length ? (
                <Badge className="bg-rose-500/15 text-rose-200 border border-rose-400/40 font-extrabold">
                  Duplicados (Nombre + Grado) en Excel: {bulkPreview.warnings.duplicate_nombre_grado_in_file.length}
                </Badge>
              ) : null}
              {bulkPreview?.warnings?.missing_contacto_encargado?.length ? (
                <Badge className="bg-amber-500/15 text-amber-200 border border-amber-400/40 font-extrabold">
                  Sin contacto de encargado: {bulkPreview.warnings.missing_contacto_encargado.length}
                </Badge>
              ) : null}
              {bulkPreview?.truncated ? (
                <Badge variant="warning" className="font-extrabold">Vista truncada</Badge>
              ) : null}
            </div>

            {/* Preview de grupos (si aplica) */}
            {bulkPreview?.grupos?.preview ? (
              <div className="space-y-2">
                <div className="text-sm font-black text-white uppercase tracking-widest">Grupos</div>
                <Table>
                  <TableHeader>
                    <TableRow className="bg-white/5">
                      <TableHead>#</TableHead>
                      <TableHead>Grupo</TableHead>
                      <TableHead>Curso</TableHead>
                      <TableHead>Tutor</TableHead>
                      <TableHead>Validación</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(bulkPreview.grupos.preview || []).slice(0, 20).map((g: any) => {
                      const hasErr = !!g.curso_error || !!g.tutor_error;
                      return (
                        <TableRow key={String(g.rowNumber)}>
                          <TableCell className="text-slate-300 font-bold">{g.rowNumber}</TableCell>
                          <TableCell className="font-black text-white">{g.nombre_grupo}</TableCell>
                          <TableCell className="text-slate-200">{g.curso_ref} {g.curso_id ? <span className="text-slate-400">(#{g.curso_id})</span> : null}</TableCell>
                          <TableCell className="text-slate-200">{g.tutor_nombre} {g.tutor_id ? <span className="text-slate-400">(#{g.tutor_id})</span> : null}</TableCell>
                          <TableCell>
                            {hasErr ? (
                              <Badge className="bg-rose-500/15 text-rose-200 border border-rose-400/40 font-extrabold">{g.curso_error || g.tutor_error}</Badge>
                            ) : (
                              <Badge variant="success" className="font-extrabold">OK</Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
                {bulkPreview?.grupos?.errors?.length ? (
                  <div className="text-xs text-rose-200 font-bold">Errores de parseo: {bulkPreview.grupos.errors.length}</div>
                ) : null}
              </div>
            ) : null}

            {/* Preview de estudiantes */}
            {bulkPreview?.estudiantes?.preview || bulkPreview?.preview ? (
              <div className="space-y-2">
                <div className="text-sm font-black text-white uppercase tracking-widest">Estudiantes</div>
                <Table>
                  <TableHeader>
                    <TableRow className="bg-white/5">
                      <TableHead>#</TableHead>
                      <TableHead>Nombre</TableHead>
                      <TableHead>Encargado</TableHead>
                      <TableHead>Correo encargado</TableHead>
                      <TableHead>Teléfono encargado</TableHead>
                      <TableHead>Grupo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(((bulkPreview.estudiantes?.preview ?? bulkPreview.preview) || []) as any[]).slice(0, 20).map((s: any) => (
                      <TableRow key={String(s.rowNumber)}>
                        <TableCell className="text-slate-300 font-bold">{s.rowNumber}</TableCell>
                        <TableCell className="font-black text-white">{s.nombre}</TableCell>
                        <TableCell className="text-slate-200">{s.nombre_encargado || '—'}</TableCell>
                        <TableCell className="text-slate-200">{s.email_encargado || s.correo || '—'}</TableCell>
                        <TableCell className="text-slate-200">{s.telefono_encargado || s.telefono || '—'}</TableCell>
                        <TableCell className="text-slate-200">{s.grupo_nombre || '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="flex items-center justify-between gap-3 mt-6">
          <Button variant="secondary" onClick={() => setBulkPreviewOpen(false)} className="font-bold">Cancelar</Button>
          <Button
            variant="primary"
            onClick={confirmImportBulkExcel}
            disabled={
              bulkBusy
              || !bulkFile
              || !!bulkPreviewErr
              || ((bulkPreview?.grupos?.preview || []).some((g: any) => !!g.curso_error || !!g.tutor_error))
            }
            className="font-black"
          >
            {bulkBusy ? 'Importando…' : 'Confirmar e importar'}
          </Button>
        </div>

        {bulkPreview?.grupos?.preview && ((bulkPreview?.grupos?.preview || []).some((g: any) => !!g.curso_error || !!g.tutor_error)) ? (
          <div className="mt-3 text-xs text-slate-300 font-semibold">
            Corrige los errores de Curso/Tutor en el Excel para poder importar.
          </div>
        ) : null}
      </Dialog>

      {/* Modal edición estudiante bulk */}
      {bulkEditOpen && bulkEditing && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setBulkEditOpen(false);
          }}
        >
          <Card className="w-full max-w-xl max-h-[90vh] overflow-y-auto">
            <CardHeader className="border-b border-slate-200 flex justify-between items-start">
              <div>
                <CardTitle>Editar estudiante</CardTitle>
                <CardDescription>Edición rápida</CardDescription>
              </div>
              <button onClick={() => setBulkEditOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-6 h-6" />
              </button>
            </CardHeader>
            <div className="p-6 space-y-4">
              {bulkEditErr && <div className="text-sm font-bold text-rose-600">{bulkEditErr}</div>}
              <div>
                <Label>Nombre</Label>
                <Input value={bulkForm.nombre} onChange={(e) => setBulkForm((p) => ({ ...p, nombre: e.target.value }))} />
              </div>
              <div>
                <Label>Nombre del encargado</Label>
                <Input value={bulkForm.nombre_encargado} onChange={(e) => setBulkForm((p) => ({ ...p, nombre_encargado: e.target.value }))} />
              </div>
              <div>
                <Label>Correo del encargado</Label>
                <Input value={bulkForm.email_encargado} onChange={(e) => setBulkForm((p) => ({ ...p, email_encargado: e.target.value }))} />
              </div>
              <div>
                <Label>Teléfono del encargado</Label>
                <Input value={bulkForm.telefono_encargado} onChange={(e) => setBulkForm((p) => ({ ...p, telefono_encargado: e.target.value }))} />
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={bulkForm.requiere_perfil_completo}
                  onChange={(e) => setBulkForm((p) => ({ ...p, requiere_perfil_completo: e.target.checked }))}
                />
                <span className="text-sm font-semibold text-slate-200">Requiere perfil completo</span>
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={bulkForm.estado}
                  onChange={(e) => setBulkForm((p) => ({ ...p, estado: e.target.checked }))}
                />
                <span className="text-sm font-semibold text-slate-200">Activo</span>
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
                <Button variant="secondary" onClick={() => setBulkEditOpen(false)}>Cancelar</Button>
                <Button onClick={saveBulkEdit} className="font-bold">Guardar</Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Modal de Formulario */}
      {showModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) {
              setShowModal(false);
              resetForm();
            }
          }}
        >
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <CardHeader className="border-b border-slate-200 flex justify-between items-start">
              <div>
                <CardTitle>{editingId ? 'Editar Estudiante' : 'Registrar Nuevo Estudiante'}</CardTitle>
                <CardDescription>Completa los datos del alumno</CardDescription>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="text-slate-200 hover:text-white transition-colors p-2 rounded-full bg-white/10 border border-white/10 hover:bg-[#FFC800]/20 hover:border-[#FFC800]/50"
                aria-label="Cerrar"
                title="Cerrar"
              >
                <X className="w-6 h-6" />
              </button>
            </CardHeader>

            <form onSubmit={handleSubmit} className="p-8 space-y-6">
              {/* Nombre del Estudiante */}
              <div>
                <Label>Nombre del Estudiante *</Label>
                <Input
                  value={formData.nombre}
                  onChange={(e) => setFormData(prev => ({ ...prev, nombre: e.target.value }))}
                  placeholder="Ej: Juan Pérez"
                  className={errors.nombre ? 'border-red-500' : ''}
                />
                {errors.nombre && <p className="text-red-500 text-sm mt-1">{errors.nombre}</p>}
              </div>

              {/* Nombre del Encargado */}
              <div>
                <Label>Nombre del Encargado</Label>
                <Input
                  value={formData.nombre_encargado}
                  onChange={(e) => setFormData(prev => ({ ...prev, nombre_encargado: e.target.value }))}
                  placeholder="Ej: María López"
                />
              </div>

              {/* Grado */}
              <div>
                <Label>{(!editingId && formData.grupo_id) ? 'Grado (opcional si va en grupo)' : 'Grado *'}</Label>
                <Select 
                  value={formData.grado} 
                  onChange={(e) => setFormData(prev => ({ ...prev, grado: e.target.value }))}
                  className={errors.grado ? 'border-red-500' : ''}
                >
                  <option value="">Selecciona un grado</option>
                  {GRADOS.map(grado => (
                    <option key={grado} value={grado}>{grado}</option>
                  ))}
                </Select>
                {errors.grado && <p className="text-red-500 text-sm mt-1">{errors.grado}</p>}
              </div>

              {!editingId && (
                <div>
                  <Label>Agregar a grupo (opcional)</Label>
                  <Select
                    value={formData.grupo_id}
                    onChange={(e) => setFormData(prev => ({ ...prev, grupo_id: e.target.value }))}
                  >
                    <option value="">(Sin grupo)</option>
                    {bulkGrupos.map((g) => (
                      <option key={g.id} value={String(g.id)}>{g.nombre_grupo || `Grupo #${g.id}`}</option>
                    ))}
                  </Select>
                  <p className="text-xs text-slate-400 mt-2">
                    Si eliges un grupo, el estudiante quedará asociado al grupo para matricular después.
                  </p>
                </div>
              )}

              {/* Datos del Encargado */}
              <div className="p-6 bg-white/5 border border-cyan-400/20 rounded-2xl">
                <p className="text-sm font-black text-cyan-200 mb-4 uppercase tracking-wide">Datos del Encargado</p>
                
                <div className="space-y-4">
                  <div>
                    <Label>Email del Encargado</Label>
                    <Input
                      type="email"
                      value={formData.email_encargado}
                      onChange={(e) => setFormData(prev => ({ ...prev, email_encargado: e.target.value }))}
                      placeholder="encargado@ejemplo.com"
                      className={errors.email_encargado ? 'border-red-500' : ''}
                    />
                    {errors.email_encargado && <p className="text-red-500 text-sm mt-1">{errors.email_encargado}</p>}
                  </div>

                  <div>
                    <Label>Teléfono del Encargado</Label>
                    <PhoneInput
                      value={formData.telefono_encargado}
                      onChange={(value) => setFormData(prev => ({ ...prev, telefono_encargado: value }))}
                      placeholder="8888-8888"
                      error={errors.telefono_encargado}
                    />
                    {errors.telefono_encargado && <p className="text-red-500 text-sm mt-1">{errors.telefono_encargado}</p>}
                  </div>
                </div>
              </div>

              {/* Horario Preferido (Opcional) */}
              <div className="p-6 bg-white/5 border border-emerald-400/20 rounded-2xl">
                <p className="text-sm font-black text-emerald-200 mb-4 uppercase tracking-wide">Horario Preferido (Opcional)</p>
                
                <div className="space-y-4">
                  <div>
                    <Label>Días Disponibles</Label>
                    <div className="grid grid-cols-4 gap-2 mt-2">
                      {DIAS_SEMANA.map(dia => (
                        <label key={dia} className="flex items-center gap-2 p-3 border border-white/10 rounded-2xl hover:bg-white/10 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={formData.dias.includes(dia)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setFormData(prev => ({
                                  ...prev,
                                  dias: [...prev.dias, dia],
                                  dias_turno: { ...prev.dias_turno, [dia]: prev.dias_turno[dia] || 'Tarde' }
                                }));
                              } else {
                                const { [dia]: _, ...rest } = formData.dias_turno;
                                setFormData(prev => ({
                                  ...prev,
                                  dias: prev.dias.filter(d => d !== dia),
                                  dias_turno: rest
                                }));
                              }
                            }}
                            className="rounded"
                          />
                          <span className="text-sm font-semibold text-slate-200">{dia.slice(0, 3)}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {formData.dias.length > 0 && (
                    <div>
                      <Label>Turno por Día</Label>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-2">
                        {formData.dias.map((dia) => (
                            <div key={dia} className="p-3 border border-white/10 rounded-2xl bg-white/5">
                              <p className="text-xs font-bold text-slate-200 mb-2">{dia.slice(0,3)}</p>
                            <div className="flex gap-3">
                              {TURNOS.map((t) => (
                                <label key={t} className="flex items-center gap-2 cursor-pointer">
                                  <input
                                    type="radio"
                                    name={`turno-${dia}`}
                                    value={t}
                                    checked={formData.dias_turno[dia] === t}
                                    onChange={(e) => setFormData(prev => ({
                                      ...prev,
                                      dias_turno: { ...prev.dias_turno, [dia]: e.target.value as 'Tarde' | 'Noche' }
                                    }))}
                                    className="w-4 h-4"
                                  />
                                  <span className="text-xs font-semibold text-slate-200">{t}</span>
                                </label>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

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
                  className="px-8 bg-[#00AEEF] hover:bg-[#00AEEF]/80 text-[#051026] font-bold"
                >
                  {editingId ? 'Actualizar' : 'Registrar'}
                </Button>
              </div>
              {errors.submit && <p className="text-red-500 text-sm">{errors.submit}</p>}
            </form>
          </Card>
        </div>
      )}
      </div>
    </div>
  );
};

export default Estudiantes;

