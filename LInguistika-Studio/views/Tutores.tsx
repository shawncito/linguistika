import React, { useState, useEffect, useMemo } from "react";
import { useLocation } from "react-router-dom";
import { api } from "../services/api";
import { supabaseClient } from "../lib/supabaseClient";
import { usePersistentState } from "../lib/usePersistentState";
import { Tutor } from "../types";
import {
  Button, Card, CardHeader, CardTitle, CardDescription, CardContent,
  Badge, Input, Label, Select, Dialog, Table, TableHead, TableHeader, TableRow, TableCell, TableBody
} from "../components/UI";
import { PhoneInput } from "../components/PhoneInput";
import { Plus, Edit, Trash2, Mail, Phone, Briefcase, MoreVertical, CheckCircle2, XCircle, Filter, Layers, Table as TableIcon } from "lucide-react";

const DIAS_SEMANA = ["Lunes", "Martes", "Miercoles", "Jueves", "Viernes", "Sabado", "Domingo"];
const ESPECIALIDADES = ["Ingles", "Frances", "Aleman", "Portugues", "Chino", "Japones", "Espanol"];

const NIVELES = ["A1","A2","B1","B2","C1","C2"];

const hexToRgba = (hex: string, alpha: number) => {
  const normalized = hex.replace('#', '');
  const bigint = parseInt(normalized, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const sortDias = (dias: string[]) => dias.slice().sort((a, b) => DIAS_SEMANA.indexOf(a) - DIAS_SEMANA.indexOf(b));
const sortDiaEntries = <T,>(dias_horarios: Record<string, T> = {}) =>
  Object.entries(dias_horarios).sort((a, b) => DIAS_SEMANA.indexOf(a[0]) - DIAS_SEMANA.indexOf(b[0]));
const getErrorMessage = (error: any) =>
  error?.response?.data?.message || error?.response?.data?.error || error?.message || "Error al guardar";
const toWhatsAppUrl = (telefono?: string | null) => {
  if (!telefono) return "";
  const digits = telefono.replace(/[^\d+]/g, "");
  return `https://wa.me/${digits.replace(/^\+/, "")}`;
};

const getTutorColor = (color?: string | null) => (color && color.trim() ? color : "#94a3b8");

const tutorChipStyle = (color?: string | null) => {
  const resolved = getTutorColor(color);
  return {
    backgroundColor: hexToRgba(resolved, 0.12),
    borderColor: hexToRgba(resolved, 0.4),
    color: resolved,
    boxShadow: `0 6px 16px ${hexToRgba(resolved, 0.12)}`,
  } as React.CSSProperties;
};

const Tutores: React.FC = () => {
  const [tutores, setTutores] = useState<Tutor[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    nombre: "",
    email: "",
    telefono: "",
    especialidades: ["Ingles"] as string[],
    color: "#ffffff",
    horario_tipo: "personalizado",
    dias: [] as string[],
    dias_turno: {} as Record<string, "Tarde" | "Noche">,
    dias_horarios: {} as Record<string, { hora_inicio: string; hora_fin: string }>,
    es_especializado: false,
    niveles_apto: [] as string[]
  });
  const [customHoras, setCustomHoras] = useState({ hora_inicio: "", hora_fin: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [resumenSeleccion, setResumenSeleccion] = useState<{ titulo: string; detalle: string; lista?: string[] } | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedTutor, setSelectedTutor] = useState<Tutor | null>(null);
  const [menuOpen, setMenuOpen] = useState<number | null>(null);
  const [estadoFiltro, setEstadoFiltro] = usePersistentState<"todos" | "activos" | "inactivos">(
    'ui:tutores:estadoFiltro',
    "todos",
    {
      version: 1,
      validate: (v: unknown): v is "todos" | "activos" | "inactivos" => v === "todos" || v === "activos" || v === "inactivos",
    }
  );
  const [search, setSearch] = usePersistentState<string>('ui:tutores:search', "", { version: 1, validate: (v): v is string => typeof v === 'string' });
  const [viewMode, setViewMode] = usePersistentState<"tabla" | "tarjetas">(
    'ui:tutores:viewMode',
    "tarjetas",
    {
      version: 1,
      validate: (v: unknown): v is "tabla" | "tarjetas" => v === "tabla" || v === "tarjetas",
    }
  );
  const [especialidadFiltro, setEspecialidadFiltro] = usePersistentState<string>(
    'ui:tutores:especialidadFiltro',
    "",
    {
      version: 1,
      validate: (v): v is string => typeof v === 'string',
    }
  );
  const [sortMode, setSortMode] = usePersistentState<
    'nombre_asc' | 'nombre_desc'
    | 'estado_activos'
    | 'especialidad_asc' | 'especialidad_desc'
    | 'email_asc' | 'email_desc'
    | 'dias_disponibles_desc' | 'dias_disponibles_asc'
  >(
    'ui:tutores:sortMode',
    'nombre_asc',
    {
      version: 1,
      validate: (v: unknown): v is
        | 'nombre_asc' | 'nombre_desc'
        | 'estado_activos'
        | 'especialidad_asc' | 'especialidad_desc'
        | 'email_asc' | 'email_desc'
        | 'dias_disponibles_desc' | 'dias_disponibles_asc' =>
        v === 'nombre_asc' || v === 'nombre_desc'
        || v === 'estado_activos'
        || v === 'especialidad_asc' || v === 'especialidad_desc'
        || v === 'email_asc' || v === 'email_desc'
        || v === 'dias_disponibles_desc' || v === 'dias_disponibles_asc',
    }
  );

  const loadData = async () => {
    setLoading(true);
    const data = await api.tutores.getAll();
    setTutores(data);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const location = useLocation();

  // Open detail if URL has ?open=<id> (works with HashRouter via location.search)
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const openId = params.get('open');
    if (openId) {
      const id = Number(openId);
      if (!Number.isNaN(id)) {
        api.tutores.getById(id)
          .then((t) => {
            if (t) {
              setSelectedTutor(t);
              setDetailOpen(true);
            }
          })
          .catch(() => {
            // ignore
          });
      }
    }
  }, [location.search]);

  const especialidadesDisponibles = useMemo(() => {
    const set = new Set<string>();
    tutores.forEach((t) => {
      if (t.especialidad) {
        t.especialidad.split(",").map((s) => s.trim()).filter(Boolean).forEach((e) => set.add(e));
      }
    });
    return Array.from(set);
  }, [tutores]);

  const tutoresFiltrados = useMemo(() => {
    const filtered = tutores.filter((t) => {
      const matchesEstado = estadoFiltro === "todos" ? true : estadoFiltro === "activos" ? t.estado === 1 : t.estado !== 1;
      const especialidadesTutor = t.especialidad ? t.especialidad.split(",").map((s) => s.trim()) : [];
      const matchesEspecialidad = especialidadFiltro ? especialidadesTutor.includes(especialidadFiltro) : true;
      const term = search.trim().toLowerCase();
      const matchesSearch = term
        ? `${t.nombre} ${t.email || ""} ${t.telefono || ""} ${t.especialidad}`.toLowerCase().includes(term)
        : true;
      return matchesEstado && matchesEspecialidad && matchesSearch;
    });

    const compareText = (a: string | null | undefined, b: string | null | undefined) =>
      (a || '').localeCompare((b || ''), 'es', { sensitivity: 'base' });

    const diasCount = (t: Tutor) => {
      const dh = (t as any)?.dias_horarios;
      if (dh && typeof dh === 'object' && !Array.isArray(dh)) return Object.keys(dh).length;
      const dt = (t as any)?.dias_turno;
      if (dt && typeof dt === 'object' && !Array.isArray(dt)) return Object.keys(dt).length;
      const dias = (t as any)?.dias;
      if (Array.isArray(dias)) return dias.length;
      return 0;
    };

    const sorted = [...filtered].sort((a, b) => {
      switch (sortMode) {
        case 'nombre_asc':
          return compareText(a.nombre, b.nombre);
        case 'nombre_desc':
          return compareText(b.nombre, a.nombre);
        case 'estado_activos':
          return (b.estado === 1 ? 1 : 0) - (a.estado === 1 ? 1 : 0) || compareText(a.nombre, b.nombre);
        case 'especialidad_asc':
          return compareText(a.especialidad, b.especialidad) || compareText(a.nombre, b.nombre);
        case 'especialidad_desc':
          return compareText(b.especialidad, a.especialidad) || compareText(a.nombre, b.nombre);
        case 'email_asc':
          return compareText(a.email, b.email) || compareText(a.nombre, b.nombre);
        case 'email_desc':
          return compareText(b.email, a.email) || compareText(a.nombre, b.nombre);
        case 'dias_disponibles_desc':
          return diasCount(b) - diasCount(a) || compareText(a.nombre, b.nombre);
        case 'dias_disponibles_asc':
          return diasCount(a) - diasCount(b) || compareText(a.nombre, b.nombre);
        default:
          return 0;
      }
    });

    return sorted;
  }, [tutores, estadoFiltro, especialidadFiltro, search, sortMode]);

  const resumenCards = useMemo(() => {
    const activos = tutoresFiltrados.filter((t) => t.estado === 1);
    const inactivos = tutoresFiltrados.filter((t) => t.estado !== 1);
    const especializados = tutoresFiltrados.filter((t) => t.es_especializado);
    const especialidades = Array.from(new Set(tutoresFiltrados.map((t) => t.especialidad).filter(Boolean)));

    return [
      { titulo: "Activos", valor: activos.length, detalle: "Docentes activos", lista: activos.map((t) => t.nombre), accent: "#00AEEF" },
      { titulo: "Inactivos", valor: inactivos.length, detalle: "Docentes inactivos", lista: inactivos.map((t) => t.nombre), accent: "#FFC800" },
      { titulo: "Especializados", valor: especializados.length, detalle: "Docentes especializados por nivel", lista: especializados.map((t) => t.nombre), accent: "#00AEEF" },
      { titulo: "Especialidades", valor: especialidades.length, detalle: "Especialidades únicas", lista: especialidades, accent: "#FFC800" }
    ];
  }, [tutoresFiltrados]);

  const validatePhone = (value: string) => {
    if (!value) return false;
    // Acepta códigos de país y números largos con símbolos comunes
    return /^\+?[\d\s().-]{6,}$/.test(value.trim());
  };

  const handlePhoneChange = (value: string) => {
    setFormData((prev) => ({ ...prev, telefono: value }));
    setErrors((prev) => {
      if (value && !validatePhone(value)) {
        return { ...prev, telefono: "Telefono invalido" };
      }
      const newErrors = { ...prev };
      delete newErrors.telefono;
      return newErrors;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};

    if (!formData.nombre.trim()) newErrors.nombre = "Nombre requerido";
    if (!formData.especialidades || formData.especialidades.length === 0) newErrors.especialidad = "Especialidad requerida";
    if (formData.telefono && !validatePhone(formData.telefono)) {
      newErrors.telefono = "Telefono invalido";
    }
    if (formData.dias.length === 0) newErrors.dias = "Selecciona al menos un dia";

    for (const dia of formData.dias) {
      if (!formData.dias_horarios[dia] || !formData.dias_horarios[dia].hora_inicio || !formData.dias_horarios[dia].hora_fin) {
        newErrors.dias_horarios = "Especifica hora de inicio y fin para cada dia";
        break;
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    try {
      const dataToSubmit = {
        nombre: formData.nombre.trim(),
        email: formData.email.trim() || null,
        telefono: formData.telefono.trim(),
        especialidad: (formData.especialidades || []).join(", "),
        color: formData.color || null,
        horario_tipo: "personalizado" as "personalizado" | "predefinido",
        dias_horarios: formData.dias_horarios,
        es_especializado: !!formData.es_especializado,
        niveles_apto: Array.isArray(formData.niveles_apto) ? formData.niveles_apto : []
      };

      if (editingId) {
        await api.tutores.update(editingId, dataToSubmit);
      } else {
        await api.tutores.create(dataToSubmit);
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
      nombre: "",
      email: "",
      telefono: "",
      especialidades: ["Ingles"],
      color: "#ffffff",
      horario_tipo: "personalizado",
      dias: [],
      dias_turno: {},
      dias_horarios: {},
      es_especializado: false,
      niveles_apto: []
    });
    setCustomHoras({ hora_inicio: "", hora_fin: "" });
    setErrors({});
  };

  const handleEdit = (tutor: Tutor) => {
    setEditingId(tutor.id);
    setFormData({
      nombre: tutor.nombre,
      email: tutor.email || "",
      telefono: tutor.telefono || "",
      especialidades: tutor.especialidad ? tutor.especialidad.split(",").map((s) => s.trim()).filter(Boolean) : [],
      color: (tutor as any).color || "#ffffff",
      horario_tipo: "personalizado",
      dias: sortDias(Object.keys(tutor.dias_horarios || {})),
      dias_turno: {},
      dias_horarios: tutor.dias_horarios || {},
      es_especializado: !!tutor.es_especializado,
      niveles_apto: (tutor.niveles_apto as any) || []
    });
    setShowModal(true);
  };

  const handleDelete = async (id: number) => {
    if (window.confirm("Estas seguro de eliminar este tutor?")) {
      await api.tutores.delete(id);
      loadData();
    }
  };

  const toggleEstado = async (tutor: Tutor) => {
    const nuevoEstado = tutor.estado === 1 ? 0 : 1;
    await api.tutores.update(tutor.id, { estado: nuevoEstado });
    setTutores(prev => prev.map(t => t.id === tutor.id ? { ...t, estado: nuevoEstado } : t));
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh]">
        <div className="w-10 h-10 border-4 border-slate-200 border-t-blue-600 rounded-full animate-spin mb-4" />
        <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Cargando docentes...</p>
      </div>
    );
  }

  return (
    <div className="flex gap-6">
      <aside className="w-[30%] space-y-6 sticky top-24 self-start">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="w-5 h-5" style={{color: "#00AEEF"}} /> Filtros y vista
            </CardTitle>
            <CardDescription>Filtra y cambia entre tabla o tarjetas</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Busqueda rapida</Label>
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Nombre, email, telefono o especialidad"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>Especialidad</Label>
                <Select value={especialidadFiltro} onChange={(e) => setEspecialidadFiltro(e.target.value)}>
                  <option value="">Todas</option>
                  {especialidadesDisponibles.map((esp) => (
                    <option key={esp} value={esp}>{esp}</option>
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
                <option value="estado_activos">Activos primero</option>
                <option value="especialidad_asc">Especialidad A→Z</option>
                <option value="especialidad_desc">Especialidad Z→A</option>
                <option value="email_asc">Email A→Z</option>
                <option value="email_desc">Email Z→A</option>
                <option value="dias_disponibles_desc">Más días disponibles</option>
                <option value="dias_disponibles_asc">Menos días disponibles</option>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Button
                size="sm"
                onClick={() => setViewMode("tabla")}
                className={`gap-2 font-bold transition-all ${viewMode === "tabla"
                  ? "bg-[#00AEEF] hover:bg-[#00AEEF]/80 text-[#051026]"
                  : "bg-white/10 hover:bg-white/15 text-slate-200 border border-white/10"}`}
              >
                <TableIcon className="w-4 h-4" /> Tabla
              </Button>
              <Button
                size="sm"
                onClick={() => setViewMode("tarjetas")}
                className={`gap-2 font-bold transition-all ${viewMode === "tarjetas"
                  ? "bg-[#00AEEF] hover:bg-[#00AEEF]/80 text-[#051026]"
                  : "bg-white/10 hover:bg-white/15 text-slate-200 border border-white/10"}`}
              >
                <Layers className="w-4 h-4" /> Tarjetas
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="border-white/10">
          <CardHeader>
            <CardTitle className="text-lg">Resumen rápido</CardTitle>
            <CardDescription className="text-xs">Indicadores del equipo docente</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {resumenCards.map(card => (
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
            <h1 className="text-3xl font-black text-white tracking-tight">Especialistas Docentes</h1>
            <p className="text-slate-300 font-medium mt-2">Gestion de profesorado y honorarios</p>
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
            Nuevo Docente
          </Button>
        </header>

        <section className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <h2 className="text-2xl font-black text-white tracking-tight">Docentes</h2>
              <p className="text-slate-300 text-sm font-medium">Personal docente especializado</p>
            </div>
            <div className="text-sm font-semibold text-slate-200">{tutoresFiltrados.length} resultado(s)</div>
          </div>

          {viewMode === "tarjetas" ? (
            <>
              <Dialog isOpen={detailOpen} onClose={() => setDetailOpen(false)} title="Perfil del Docente">
                {selectedTutor && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="w-14 h-14 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 font-black text-xl">
                        {selectedTutor.nombre.charAt(0)}
                      </div>
                      <div>
                        <div className="font-bold text-xl text-slate-900">{selectedTutor.nombre}</div>
                        <Badge
                          variant="info"
                          className="mt-1"
                          style={tutorChipStyle((selectedTutor as any)?.color)}
                        >
                          {selectedTutor.especialidad}
                        </Badge>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-3 rounded-lg border border-slate-200 bg-slate-50">
                        <div className="text-[11px] font-bold text-slate-500 uppercase">Contacto</div>
                        <div className="text-sm font-semibold text-slate-200">{selectedTutor.email || "Sin email"}</div>
                      </div>
                      <div className="p-3 rounded-lg border border-white/10 bg-white/5">
                        <div className="text-[11px] font-bold text-[#FFC800] uppercase">Telefono</div>
                        <div className="text-sm font-semibold text-slate-100">{selectedTutor.telefono || "No registrado"}</div>
                        {selectedTutor.telefono && (
                          <Button
                            size="sm"
                            className="mt-2 bg-[#25D366]/20 text-[#25D366] border border-[#25D366]/40 hover:bg-[#25D366]/30"
                            onClick={() => {
                              const url = toWhatsAppUrl(selectedTutor.telefono);
                              if (url) window.open(url, "_blank");
                            }}
                          >
                            WhatsApp
                          </Button>
                        )}
                      </div>
                    </div>

                    {selectedTutor.dias_horarios && Object.keys(selectedTutor.dias_horarios).length > 0 && (
                      <div>
                        <div className="text-xs font-bold text-slate-400 uppercase mb-2">Disponibilidad</div>
                        <div className="space-y-2">
                          {sortDiaEntries(selectedTutor.dias_horarios as any).map(([dia, horario]: any) => (
                            <div key={dia} className="flex items-center justify-between p-2 rounded-lg bg-white/5 border border-white/10">
                              <span className="font-semibold text-white">{dia}</span>
                              <span className="text-sm text-slate-300">{horario.hora_inicio} - {horario.hora_fin}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {selectedTutor.es_especializado && selectedTutor.niveles_apto && (
                      <div className="p-3 rounded-lg border border-emerald-400/30 bg-emerald-500/10">
                        <div className="text-[11px] font-bold text-emerald-200 uppercase">Especializacion</div>
                        <div className="text-sm font-semibold text-emerald-100 flex gap-2 flex-wrap">
                          {(selectedTutor.niveles_apto as any[]).map(n => (
                            <span key={n} className="px-2 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-100">Nivel {n}</span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </Dialog>

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
                {tutoresFiltrados.map((tutor) => (
                  <Card
                    key={tutor.id}
                    className="group relative overflow-hidden border-white/10 hover:border-[#00AEEF]/30 flex flex-col h-full"
                  >
                    <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-[#FFC800] to-[#00AEEF] opacity-80" />

                    <CardHeader className="pb-6 border-none">
                      <div className="flex justify-between items-start gap-3">
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div
                            className="w-14 h-14 rounded-2xl bg-white/10 border border-white/15 flex items-center justify-center font-black text-xl shadow-inner flex-shrink-0"
                            style={{ color: (tutor as any).color || "#ffffff" }}
                          >
                            {tutor.nombre.charAt(0)}
                          </div>
                          <div className="min-w-0 flex-1">
                            <CardTitle className="text-lg text-white whitespace-normal break-words">{tutor.nombre}</CardTitle>
                            <Badge
                              variant="secondary"
                              className="mt-1 font-bold"
                              style={tutorChipStyle((tutor as any).color)}
                            >
                              {tutor.especialidad}
                            </Badge>
                          </div>
                        </div>
                        <div className="relative flex-shrink-0">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setMenuOpen(menuOpen === tutor.id ? null : tutor.id)}
                            className="h-9 w-9 text-slate-300 hover:bg-white/10"
                          >
                            <MoreVertical className="w-5 h-5" />
                          </Button>
                          {menuOpen === tutor.id && (
                            <div className="absolute right-0 top-10 z-50 bg-[#0F2445] rounded-2xl shadow-2xl border border-white/10 py-1 min-w-[180px]">
                              <button
                                onClick={() => { setSelectedTutor(tutor); setDetailOpen(true); setMenuOpen(null); }}
                                className="w-full text-left px-4 py-2 text-sm text-slate-100 hover:bg-white/5 flex items-center gap-2"
                              >
                                <Briefcase className="w-4 h-4" />
                                Ver detalles
                              </button>
                              <button
                                onClick={() => { handleEdit(tutor); setMenuOpen(null); }}
                                className="w-full text-left px-4 py-2 text-sm text-slate-100 hover:bg-white/5 flex items-center gap-2"
                              >
                                <Edit className="w-4 h-4" />
                                Editar
                              </button>
                              <button
                                onClick={() => { handleDelete(tutor.id); setMenuOpen(null); }}
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

                    <CardContent className="px-6 pb-6 flex-1 flex flex-col gap-4">
                      <div className="flex-1 space-y-4">
                        {tutor.email && (
                          <div className="flex items-center gap-3 text-sm">
                            <Mail className="w-4 h-4 text-slate-400" />
                            <p className="text-slate-200 font-semibold truncate">{tutor.email}</p>
                          </div>
                        )}

                        {tutor.telefono && (
                          <div className="flex items-center gap-3 text-sm">
                            <Phone className="w-4 h-4 text-slate-400" />
                            <p className="text-slate-200 font-semibold">{tutor.telefono}</p>
                          </div>
                        )}

                        {tutor.dias_horarios && Object.keys(tutor.dias_horarios).length > 0 && (
                          <div className="pt-4 border-t border-white/10">
                            <p className="text-xs font-black text-slate-400 uppercase mb-2 tracking-widest">Horario</p>
                            <div className="space-y-2">
                              {sortDiaEntries(tutor.dias_horarios || {}).map(([dia, horario]: [string, any]) => (
                                <div key={dia} className="text-xs bg-white/5 text-slate-200 px-3 py-2 rounded-lg border border-white/10 font-semibold flex justify-between">
                                  <span>{dia.slice(0, 3)}</span>
                                  <span>{horario.hora_inicio} - {horario.hora_fin}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {(tutor.es_especializado || (tutor.niveles_apto && (tutor.niveles_apto as any[]).length > 0)) && (
                          <div className="pt-4 border-t border-white/10">
                            <p className="text-xs font-black text-slate-400 uppercase mb-2 tracking-widest">Especializacion</p>
                            <div className="flex items-center gap-2 flex-wrap">
                              {tutor.es_especializado && (
                                <Badge variant="success">Especializado</Badge>
                              )}
                              {Array.isArray(tutor.niveles_apto) && tutor.niveles_apto.map((n) => (
                                <span key={n} className="text-xs bg-emerald-500/15 text-emerald-200 px-3 py-1 rounded-full border border-emerald-400/30 font-semibold">
                                  Nivel {n}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="mt-auto space-y-3 pt-2">
                        <Button
                          size="sm"
                          onClick={() => toggleEstado(tutor)}
                          className={`w-full gap-2 font-bold border ${tutor.estado === 1
                            ? "bg-emerald-500/20 hover:bg-emerald-500/25 border-emerald-400/40 text-emerald-50"
                            : "bg-rose-500/15 hover:bg-rose-500/25 border-rose-400/40 text-rose-50"}`}
                        >
                          {tutor.estado === 1 ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                          {tutor.estado === 1 ? "Activo" : "Inactivo"}
                        </Button>

                        {tutor.telefono && (
                          <Button
                            size="sm"
                            className="w-full bg-[#25D366]/20 text-[#25D366] border border-[#25D366]/40 hover:bg-[#25D366]/30"
                            onClick={() => {
                              const url = toWhatsAppUrl(tutor.telefono);
                              if (url) window.open(url, "_blank");
                            }}
                          >
                            Contactar por WhatsApp
                          </Button>
                        )}
                      </div>
                    </CardContent>
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
                      <TableHead>Especialidad</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Contacto</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tutoresFiltrados.map((tutor) => (
                      <TableRow key={tutor.id}>
                        <TableCell className="font-semibold text-slate-900">{tutor.nombre}</TableCell>
                        <TableCell>
                          <Badge variant="secondary" style={tutorChipStyle((tutor as any).color)}>
                            {tutor.especialidad}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant={tutor.estado === 1 ? "success" : "outline"}
                            onClick={() => toggleEstado(tutor)}
                            className="gap-2"
                          >
                            {tutor.estado === 1 ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4 text-red-600" />}
                            {tutor.estado === 1 ? "Activo" : "Inactivo"}
                          </Button>
                        </TableCell>
                        <TableCell className="space-y-1">
                          {tutor.email && <div className="flex items-center gap-2 text-sm text-slate-700"><Mail className="w-4 h-4 text-blue-500" />{tutor.email}</div>}
                          {tutor.telefono && <div className="flex items-center gap-2 text-xs text-slate-600"><Phone className="w-3 h-3 text-emerald-500" />{tutor.telefono}</div>}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button size="sm" variant="ghost" onClick={() => { setSelectedTutor(tutor); setDetailOpen(true); }} className="text-slate-700">Detalle</Button>
                            <Button size="sm" variant="ghost" onClick={() => handleEdit(tutor)} className="text-blue-700">Editar</Button>
                            <Button size="sm" variant="ghost" onClick={() => handleDelete(tutor.id)} className="text-red-600">Eliminar</Button>
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

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto border-white/10">
            <CardHeader className="border-b border-white/10 flex justify-between items-start">
              <div>
                <CardTitle>{editingId ? "Editar Docente" : "Nuevo Docente"}</CardTitle>
                <CardDescription>Completa los datos del especialista</CardDescription>
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
              <div className="p-4 border border-white/10 rounded-xl bg-white/5">
                <div className="flex items-center gap-3">
                  <input
                    id="es_especializado"
                    type="checkbox"
                    checked={!!formData.es_especializado}
                    onChange={(e) => setFormData(prev => ({ ...prev, es_especializado: e.target.checked }))}
                    className="w-4 h-4"
                  />
                  <Label htmlFor="es_especializado" className="m-0">Tutor especializado / apto por nivel</Label>
                </div>
                {formData.es_especializado && (
                  <div className="mt-3">
                    <Label>Niveles en los que es apto</Label>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {NIVELES.map(n => (
                        <label key={n} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-white/10 bg-white/5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={formData.niveles_apto.includes(n)}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              setFormData(prev => ({
                                ...prev,
                                niveles_apto: checked
                                  ? [...prev.niveles_apto, n]
                                  : prev.niveles_apto.filter(x => x !== n)
                              }));
                            }}
                            className="w-4 h-4"
                          />
                          <span className="text-sm font-semibold text-slate-700">{n}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div>
                <Label>Nombre *</Label>
                <Input
                  value={formData.nombre}
                  onChange={(e) => setFormData(prev => ({ ...prev, nombre: e.target.value }))}
                  placeholder="Ej: Maria Garcia"
                  className={errors.nombre ? "border-red-500" : ""}
                />
                {errors.nombre && <p className="text-red-500 text-sm mt-1">{errors.nombre}</p>}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                    placeholder="maria@linguistika.com"
                  />
                </div>
                <div>
                  <Label>Telefono *</Label>
                  <PhoneInput
                    value={formData.telefono}
                    onChange={(value) => handlePhoneChange(value)}
                    placeholder="8888-8888"
                    className={errors.telefono ? "border-red-500" : ""}
                    error={errors.telefono}
                  />
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Especialidades *</Label>
                  <span className="text-xs text-slate-400">Puedes elegir varias</span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {ESPECIALIDADES.map(esp => {
                    const checked = formData.especialidades.includes(esp);
                    return (
                      <label key={esp} className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer ${checked ? "border-[#00AEEF]/70 bg-[#00AEEF]/10" : "border-white/10 bg-white/5"}`}>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            const checkedNow = e.target.checked;
                            setFormData(prev => ({
                              ...prev,
                              especialidades: checkedNow
                                ? [...prev.especialidades, esp]
                                : prev.especialidades.filter(x => x !== esp)
                            }));
                          }}
                          className="w-4 h-4"
                        />
                        <span className="text-sm font-semibold text-slate-200">{esp}</span>
                      </label>
                    );
                  })}
                </div>
                {errors.especialidad && <p className="text-red-500 text-sm mt-1">{errors.especialidad}</p>}
              </div>

              <div>
                <Label>Color del perfil</Label>
                <div className="flex items-center gap-3 mt-2">
                  <input
                    type="color"
                    value={formData.color}
                    onChange={(e) => setFormData(prev => ({ ...prev, color: e.target.value }))}
                    className="w-12 h-10 p-1 border border-white/10 rounded"
                  />
                  <span className="text-sm text-slate-300">Se usará en la inicial de la tarjeta</span>
                </div>
              </div>

              <div>
                <Label>Dias Habiles *</Label>
                <div className="grid grid-cols-4 gap-2 mt-2">
                  {DIAS_SEMANA.map(dia => (
                    <label key={dia} className="flex items-center gap-2 p-3 border border-slate-200 rounded-lg hover:bg-blue-50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.dias.includes(dia)}
                        onChange={(e) => {
                          setFormData((prev) => {
                            if (e.target.checked) {
                              return { ...prev, dias: sortDias([...(prev.dias || []), dia]) };
                            }

                            const nextDias = (prev.dias || []).filter((d) => d !== dia);
                            const nextHorarios = { ...(prev.dias_horarios || {}) };
                            delete nextHorarios[dia];
                            return { ...prev, dias: sortDias(nextDias), dias_horarios: nextHorarios };
                          });
                        }}
                        className="rounded"
                      />
                      <span className="text-sm font-semibold text-slate-700">{dia.slice(0, 3)}</span>
                    </label>
                  ))}
                </div>
                {errors.dias && <p className="text-red-500 text-sm mt-2">{errors.dias}</p>}
              </div>

              {formData.dias.length > 0 && (
                <div>
                  <div className="flex items-center justify-between">
                    <Label>Horas por Dia *</Label>
                    <Button
                      type="button"
                      size="sm"
                      className="text-xs bg-white/10 border border-white/20 hover:bg-white/20"
                      onClick={() => {
                        const diasAuto = sortDias(["Lunes", "Martes", "Miercoles", "Jueves", "Viernes"]);
                        setFormData(prev => ({
                          ...prev,
                          dias: diasAuto,
                          dias_horarios: {
                            Lunes: { hora_inicio: "08:00", hora_fin: "17:30" },
                            Martes: { hora_inicio: "08:00", hora_fin: "17:30" },
                            Miercoles: { hora_inicio: "08:00", hora_fin: "17:30" },
                            Jueves: { hora_inicio: "08:00", hora_fin: "17:30" },
                            Viernes: { hora_inicio: "08:00", hora_fin: "15:30" }
                          }
                        }));
                      }}
                    >
                      Todo
                    </Button>
                  </div>
                  <div className="space-y-4 mt-3">
                    {sortDias(formData.dias).map(dia => (
                      <div key={dia} className="p-4 border border-slate-200 rounded-lg bg-slate-50">
                        <p className="text-sm font-semibold text-slate-900 mb-3">{dia}</p>
                        <div className="flex gap-4">
                          <div className="flex-1">
                            <Label className="text-xs">Inicio</Label>
                            <Input
                              type="time"
                              value={formData.dias_horarios[dia]?.hora_inicio || ""}
                              onChange={(e) => setFormData(prev => ({
                                ...prev,
                                dias_horarios: {
                                  ...prev.dias_horarios,
                                  [dia]: { ...prev.dias_horarios[dia], hora_inicio: e.target.value }
                                }
                              }))}
                              className="mt-1"
                            />
                          </div>
                          <div className="flex-1">
                            <Label className="text-xs">Fin</Label>
                            <Input
                              type="time"
                              value={formData.dias_horarios[dia]?.hora_fin || ""}
                              onChange={(e) => setFormData(prev => ({
                                ...prev,
                                dias_horarios: {
                                  ...prev.dias_horarios,
                                  [dia]: { ...prev.dias_horarios[dia], hora_fin: e.target.value }
                                }
                              }))}
                              className="mt-1"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  {errors.dias_horarios && <p className="text-red-500 text-sm mt-2">{errors.dias_horarios}</p>}
                </div>
              )}

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
                  {editingId ? "Actualizar" : "Crear"}
                </Button>
              </div>
              {errors.submit && <p className="text-red-500 text-sm">{errors.submit}</p>}
            </form>
          </Card>
        </div>
      )}
    </div>
  );
};

export default Tutores;
