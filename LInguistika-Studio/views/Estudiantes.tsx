import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../services/api';
import { supabaseClient } from '../lib/supabaseClient';
import { Estudiante } from '../types';
import { Button, Card, CardHeader, CardTitle, CardDescription, CardContent, Input, Label, Select, Badge, Dialog, Table, TableHead, TableHeader, TableRow, TableCell, TableBody } from '../components/UI';
import { Plus, Edit, Trash2, Mail, Phone, User, X, MoreVertical, Filter, Layers, Table as TableIcon, CheckCircle2, XCircle } from 'lucide-react';

const GRADOS = ['1ro', '2do', '3ro', '4to', '5to', '6to', '7mo', '8vo', '9no', '10mo', '11mo'];
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

const Estudiantes: React.FC = () => {
  const [estudiantes, setEstudiantes] = useState<Estudiante[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formData, setFormData] = useState({
    nombre: '',
    email: '',
    email_encargado: '',
    telefono_encargado: '',
    grado: '',
    dias: [] as string[],
    dias_turno: {} as Record<string, 'Tarde' | 'Noche'>
  });
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedEstudiante, setSelectedEstudiante] = useState<Estudiante | null>(null);
  const [menuOpen, setMenuOpen] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [gradoFiltro, setGradoFiltro] = useState('');
  const [estadoFiltro, setEstadoFiltro] = useState<'todos' | 'activos' | 'inactivos'>('todos');
  const [viewMode, setViewMode] = useState<'tabla' | 'tarjetas'>('tabla');
  const [groupByGrado, setGroupByGrado] = useState(false);

  const loadData = async () => {
    setLoading(true);
    const data = await api.estudiantes.getAll();
    setEstudiantes(data);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

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

    if (!formData.nombre.trim()) newErrors.nombre = 'Nombre requerido';
    if (formData.email && !validateEmail(formData.email)) newErrors.email = 'Email inválido';
    if (formData.email_encargado && !validateEmail(formData.email_encargado)) {
      newErrors.email_encargado = 'Email inválido';
    }
    if (formData.telefono_encargado && !validatePhone(formData.telefono_encargado)) {
      newErrors.telefono_encargado = 'Teléfono inválido';
    }
    if (!formData.grado) newErrors.grado = 'Selecciona un grado';

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    try {
      const dataToSubmit = {
        nombre: formData.nombre.trim(),
        email: formData.email.trim() || null,
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
      email: '',
      email_encargado: '',
      telefono_encargado: '',
      grado: '',
      dias: [],
      dias_turno: {}
    });
    setErrors({});
  };

  const handleEdit = (est: Estudiante) => {
    setEditingId(est.id);
    setFormData({
      nombre: est.nombre,
      email: est.email || '',
      email_encargado: est.email_encargado || '',
      telefono_encargado: est.telefono_encargado || '',
      grado: est.grado || '',
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

  const filteredEstudiantes = useMemo(() => {
    return estudiantes.filter((e) => {
      const matchesSearch = `${e.nombre} ${e.email ?? ''} ${e.email_encargado ?? ''}`
        .toLowerCase()
        .includes(search.toLowerCase());
      const matchesGrado = gradoFiltro ? e.grado === gradoFiltro : true;
      const matchesEstado = estadoFiltro === 'todos'
        ? true
        : estadoFiltro === 'activos'
          ? e.estado === 1
          : e.estado !== 1;
      return matchesSearch && matchesGrado && matchesEstado;
    });
  }, [estudiantes, search, gradoFiltro, estadoFiltro]);

  const stats = useMemo(() => {
    const total = estudiantes.length;
    const activos = estudiantes.filter(e => e.estado === 1).length;
    const inactivos = total - activos;
    const grados = new Set(estudiantes.map(e => e.grado).filter(Boolean)).size;
    return { total, activos, inactivos, grados };
  }, [estudiantes]);

  const gradoStats = useMemo(() => {
    const map = new Map<string, { total: number; activos: number; inactivos: number }>();
    estudiantes.forEach((e) => {
      const key = e.grado || 'Sin grado';
      const current = map.get(key) || { total: 0, activos: 0, inactivos: 0 };
      current.total += 1;
      if (e.estado === 1) current.activos += 1; else current.inactivos += 1;
      map.set(key, current);
    });
    return Array.from(map.entries()).map(([grado, data]) => ({ grado, ...data })).sort((a, b) => a.grado.localeCompare(b.grado));
  }, [estudiantes]);

  const gradosDisponibles = useMemo(() => {
    return Array.from(new Set(estudiantes.map(e => e.grado).filter(Boolean))) as string[];
  }, [estudiantes]);

  const agrupadosPorGrado = useMemo(() => {
    if (!groupByGrado) return [];
    const groups = new Map<string, Estudiante[]>();
    filteredEstudiantes.forEach((e) => {
      const key = e.grado || 'Sin grado';
      const list = groups.get(key) || [];
      list.push(e);
      groups.set(key, list);
    });
    return Array.from(groups.entries()).map(([grado, lista]) => ({ grado, lista }));
  }, [filteredEstudiantes, groupByGrado]);

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
                placeholder="Nombre, email o encargado"
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
                onClick={() => setGroupByGrado((prev) => !prev)}
                className={`col-span-2 gap-2 font-bold transition-all ${groupByGrado 
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-md' 
                  : 'bg-white/10 hover:bg-white/15 text-slate-200 border border-white/10'}`}
              >
                <Layers className="w-4 h-4" /> Agrupar por grado
              </Button>
            </div>
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
                    const estado = e.estado === 'activo';
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
            onClick={() => {
              resetForm();
              setShowModal(true);
            }}
            variant="primary"
            className="h-12 px-8 gap-3 bg-[#00AEEF] hover:bg-[#00AEEF]/80 text-[#051026] font-bold"
          >
            <Plus className="w-5 h-5" />
            Nuevo Estudiante
          </Button>
        </header>

      <section className="space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h2 className="text-2xl font-black text-white tracking-tight">Estudiantes</h2>
            <p className="text-slate-300 text-sm font-medium">Tabla administrativa con activación y agrupamiento</p>
          </div>
          <div className="text-sm font-semibold text-slate-200">{filteredEstudiantes.length} resultado(s)</div>
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
              {groupByGrado ? (
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
                            <TableHead>Estado</TableHead>
                            <TableHead>Contacto</TableHead>
                            <TableHead>Días</TableHead>
                            <TableHead className="text-right">Acciones</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {lista.map((est) => (
                            <TableRow key={`${grado}-${est.id}`}>
                              <TableCell className="font-semibold text-slate-900">{est.nombre}</TableCell>
                              <TableCell>
                                <span className="px-3 py-1 rounded-full border text-xs font-bold" style={gradoChipStyle(est.grado)}>
                                  {est.grado || '—'}
                                </span>
                              </TableCell>
                              <TableCell>
                                <Button
                                  size="sm"
                                  onClick={() => toggleEstado(est)}
                                  className={`gap-2 border ${est.estado === 1
                                    ? 'bg-emerald-500/20 hover:bg-emerald-500/25 border-emerald-400/40 text-emerald-50'
                                    : 'bg-rose-500/15 hover:bg-rose-500/25 border-rose-400/40 text-rose-50'}`}
                                >
                                  {est.estado === 1 ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                                  {est.estado === 1 ? 'Activo' : 'Inactivo'}
                                </Button>
                              </TableCell>
                              <TableCell className="space-y-1">
                                {est.email && <div className="flex items-center gap-2 text-sm text-slate-700"><Mail className="w-4 h-4 text-blue-500" />{est.email}</div>}
                                {est.email_encargado && <div className="flex items-center gap-2 text-xs text-slate-600"><User className="w-3 h-3 text-emerald-500" />{est.email_encargado}</div>}
                                {est.telefono_encargado && <div className="flex items-center gap-2 text-xs text-slate-600"><Phone className="w-3 h-3 text-emerald-500" />{est.telefono_encargado}</div>}
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
                                  <Button size="sm" variant="ghost" onClick={() => { setSelectedEstudiante(est); setDetailOpen(true); }} className="text-slate-700">Detalle</Button>
                                  <Button size="sm" variant="ghost" onClick={() => handleEdit(est)} className="text-blue-700">Editar</Button>
                                  <Button size="sm" variant="ghost" onClick={() => handleDelete(est.id)} className="text-red-600">Eliminar</Button>
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
                          <TableHead>Estado</TableHead>
                          <TableHead>Contacto</TableHead>
                          <TableHead>Días</TableHead>
                          <TableHead className="text-right">Acciones</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredEstudiantes.map((est) => (
                          <TableRow key={est.id}>
                            <TableCell className="font-semibold text-slate-900">{est.nombre}</TableCell>
                            <TableCell>
                              <span className="px-3 py-1 rounded-full border text-xs font-bold" style={gradoChipStyle(est.grado)}>
                                {est.grado || '—'}
                              </span>
                            </TableCell>
                            <TableCell>
                              <Button
                                size="sm"
                                onClick={() => toggleEstado(est)}
                                className={`gap-2 border ${est.estado === 1
                                  ? 'bg-emerald-500/20 hover:bg-emerald-500/25 border-emerald-400/40 text-emerald-50'
                                  : 'bg-rose-500/15 hover:bg-rose-500/25 border-rose-400/40 text-rose-50'}`}
                              >
                                {est.estado === 1 ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                                {est.estado === 1 ? 'Activo' : 'Inactivo'}
                              </Button>
                            </TableCell>
                            <TableCell className="space-y-1">
                              {est.email && <div className="flex items-center gap-2 text-sm text-slate-700"><Mail className="w-4 h-4 text-blue-500" />{est.email}</div>}
                              {est.email_encargado && <div className="flex items-center gap-2 text-xs text-slate-600"><User className="w-3 h-3 text-emerald-500" />{est.email_encargado}</div>}
                              {est.telefono_encargado && <div className="flex items-center gap-2 text-xs text-slate-600"><Phone className="w-3 h-3 text-emerald-500" />{est.telefono_encargado}</div>}
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
                                <Button size="sm" variant="ghost" onClick={() => { setSelectedEstudiante(est); setDetailOpen(true); }} className="text-slate-700">Detalle</Button>
                                <Button size="sm" variant="ghost" onClick={() => handleEdit(est)} className="text-blue-700">Editar</Button>
                                <Button size="sm" variant="ghost" onClick={() => handleDelete(est.id)} className="text-red-600">Eliminar</Button>
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
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {filteredEstudiantes.map((est) => (
                <Card key={est.id} className="group relative overflow-hidden border-white/10 hover:border-[#00AEEF]/30">
                  <div className="absolute top-0 left-0 w-full h-1.5 opacity-80" style={{ backgroundColor: getGradoColor(est.grado) }} />
                  
                  <CardHeader className="pb-4 border-none">
                    <div className="flex justify-between items-start gap-3">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="w-12 h-12 rounded-2xl border flex items-center justify-center font-black shadow-inner flex-shrink-0" style={gradoChipStyle(est.grado)}>
                          {est.nombre.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <CardTitle className="text-lg text-white truncate">{est.nombre}</CardTitle>
                          <Badge variant="secondary" className="mt-2 font-bold" style={gradoChipStyle(est.grado)}>
                            {est.grado || 'N/A'}
                          </Badge>
                        </div>
                      </div>
                      <div className="relative flex-shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setMenuOpen(menuOpen === est.id ? null : est.id)}
                          className="h-9 w-9 text-slate-300 hover:bg-white/10"
                        >
                          <MoreVertical className="w-5 h-5" />
                        </Button>
                        {menuOpen === est.id && (
                          <div className="absolute right-0 top-10 z-50 bg-[#0F2445] rounded-2xl shadow-2xl border border-white/10 py-1 min-w-[180px]">
                            <button
                              onClick={() => { setSelectedEstudiante(est); setDetailOpen(true); setMenuOpen(null); }}
                              className="w-full text-left px-4 py-2 text-sm text-slate-100 hover:bg-white/5 flex items-center gap-2"
                            >
                              <User className="w-4 h-4" />
                              Ver detalles
                            </button>
                            <button
                              onClick={() => { handleEdit(est); setMenuOpen(null); }}
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
                          </div>
                        )}
                      </div>
                    </div>
                  </CardHeader>

                    <div className="px-6 space-y-3 pb-6">
                    <div className="flex items-center gap-2 text-sm font-semibold">
                      <Button
                        size="sm"
                        onClick={() => toggleEstado(est)}
                        className={`gap-2 border ${est.estado === 1
                          ? 'bg-emerald-500/20 hover:bg-emerald-500/25 border-emerald-400/40 text-emerald-50'
                          : 'bg-rose-500/15 hover:bg-rose-500/25 border-rose-400/40 text-rose-50'}`}
                      >
                        {est.estado === 1 ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4 text-red-600" />}
                        {est.estado === 1 ? 'Activo' : 'Inactivo'}
                      </Button>
                    </div>

                    {est.email && (
                      <div className="flex items-center gap-3 text-sm">
                          <Mail className="w-4 h-4 text-[#00AEEF] flex-shrink-0" />
                          <span className="text-slate-200 truncate">{est.email}</span>
                      </div>
                    )}
                    
                    {est.email_encargado && (
                      <div className="flex items-center gap-3 text-sm">
                          <User className="w-4 h-4 text-[#FFC800] flex-shrink-0" />
                          <span className="text-slate-300 truncate text-xs">{est.email_encargado}</span>
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
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Modal de Formulario */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <CardHeader className="border-b border-slate-200 flex justify-between items-start">
              <div>
                <CardTitle>{editingId ? 'Editar Estudiante' : 'Registrar Nuevo Estudiante'}</CardTitle>
                <CardDescription>Completa los datos del alumno</CardDescription>
              </div>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600">
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

              {/* Email del Estudiante */}
              <div>
                <Label>Email del Estudiante</Label>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="estudiante@ejemplo.com"
                  className={errors.email ? 'border-red-500' : ''}
                />
                {errors.email && <p className="text-red-500 text-sm mt-1">{errors.email}</p>}
              </div>

              {/* Grado */}
              <div>
                <Label>Grado *</Label>
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

              {/* Datos del Encargado */}
              <div className="p-6 bg-cyan-50 border-2 border-cyan-200 rounded-lg">
                <p className="text-sm font-black text-cyan-900 mb-4 uppercase tracking-wide">👨‍👩‍👧 Datos del Encargado</p>
                
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
                    <Input
                      value={formData.telefono_encargado}
                      onChange={(e) => setFormData(prev => ({ ...prev, telefono_encargado: e.target.value }))}
                      placeholder="+506 8888-8888"
                      className={errors.telefono_encargado ? 'border-red-500' : ''}
                    />
                    {errors.telefono_encargado && <p className="text-red-500 text-sm mt-1">{errors.telefono_encargado}</p>}
                  </div>
                </div>
              </div>

              {/* Horario Preferido (Opcional) */}
              <div className="p-6 bg-green-50 border-2 border-green-200 rounded-lg">
                <p className="text-sm font-black text-green-900 mb-4 uppercase tracking-wide">🕐 Horario Preferido (Opcional)</p>
                
                <div className="space-y-4">
                  <div>
                    <Label>Días Disponibles</Label>
                    <div className="grid grid-cols-4 gap-2 mt-2">
                      {DIAS_SEMANA.map(dia => (
                        <label key={dia} className="flex items-center gap-2 p-3 border border-green-200 rounded-lg hover:bg-green-100 cursor-pointer">
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
                          <span className="text-sm font-semibold text-green-700">{dia.slice(0, 3)}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {formData.dias.length > 0 && (
                    <div>
                      <Label>Turno por Día</Label>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-2">
                        {formData.dias.map((dia) => (
                          <div key={dia} className="p-3 border-2 border-emerald-200 rounded-lg">
                            <p className="text-xs font-bold text-emerald-800 mb-2">{dia.slice(0,3)}</p>
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
                                  <span className="text-xs font-semibold text-emerald-900">{t}</span>
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
