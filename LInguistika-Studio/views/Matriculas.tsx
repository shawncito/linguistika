import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { supabaseClient } from '../lib/supabaseClient';
import { Matricula, Tutor, Curso, Estudiante } from '../types';
import { Button, Card, CardHeader, CardTitle, CardDescription, CardContent, Select, Label, Badge, Input, Dialog } from '../components/UI';
import { Plus, Edit, XCircle, AlertCircle, Calendar, User, BookOpen, GraduationCap, CheckCircle, AlertTriangle, X } from 'lucide-react';

// Tipo extendido para matriculas agrupadas
type MatriculaConGrupo = Matricula & { students?: { id: number; nombre: string }[] };

const DIAS_SEMANA = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
const DIA_A_IDX: Record<string, number> = {
  'Domingo': 0,
  'Lunes': 1,
  'Martes': 2,
  'Miércoles': 3,
  'Jueves': 4,
  'Viernes': 5,
  'Sábado': 6,
};

const getErrorMessage = (error: any) =>
  error?.response?.data?.message || error?.response?.data?.error || error?.message || 'Error al guardar matrícula';

const Matriculas: React.FC = () => {
  const [matriculas, setMatriculas] = useState<Matricula[]>([]);
  const [estudiantes, setEstudiantes] = useState<Estudiante[]>([]);
  const [cursos, setCursos] = useState<Curso[]>([]);
  const [tutores, setTutores] = useState<Tutor[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
    const [viewMode, setViewMode] = useState<'tabla' | 'tarjetas'>('tarjetas');
  const [detailOpen, setDetailOpen] = useState(false);
  const [detalle, setDetalle] = useState<Matricula | null>(null);
  const [filterCursoId, setFilterCursoId] = useState<number>(0);
  const [filterGrupo, setFilterGrupo] = useState<string>('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formData, setFormData] = useState({
    estudiante_id: 0,
    curso_id: 0,
    tutor_id: 0,
    es_grupo: false,
    grupo_nombre: '' as string | '',
    estudiante_ids: [] as number[]
  });

  const loadData = async () => {
    setLoading(true);
    const [m, e, c, t] = await Promise.all([
      api.matriculas.getAll(),
      api.estudiantes.getAll(),
      api.cursos.getAll(),
      api.tutores.getAll()
    ]);
    setMatriculas(m);
    setEstudiantes(e);
    setCursos(c);
    setTutores(t);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  // Suscripción en tiempo real a matrículas y entidades relacionadas
  useEffect(() => {
    if (!supabaseClient) return;
    const channel = supabaseClient
      .channel('realtime-matriculas')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matriculas' }, () => loadData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'estudiantes' }, () => loadData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cursos' }, () => loadData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tutores' }, () => loadData())
      .subscribe();

    return () => {
      supabaseClient.removeChannel(channel);
    };
  }, []);

  const handleSelectChange = (field: string, value: any) => {
    const newFormData = { ...formData, [field]: parseInt(value) } as any;
    setFormData(newFormData);
    
    // Si se selecciona un curso, obtener el tutor_id del curso
    if (field === 'curso_id' || newFormData.curso_id) {
      const cursoSeleccionado = cursos.find(c => c.id === newFormData.curso_id);
      if (cursoSeleccionado && cursoSeleccionado.tutor_id) {
        newFormData.tutor_id = cursoSeleccionado.tutor_id;
        setFormData(newFormData);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Obtener tutor_id del curso seleccionado
    const cursoSeleccionado = cursos.find(c => c.id === formData.curso_id);
    if (!formData.curso_id || !cursoSeleccionado || !cursoSeleccionado.tutor_id) {
      return alert('El curso seleccionado no tiene un tutor asignado.');
    }

    // VALIDACIÓN: El curso debe estar activo
    if (cursoSeleccionado.estado === 0) {
      return alert('⚠️ El curso seleccionado está INACTIVO. No se pueden crear matrículas con cursos inactivos.');
    }
    
    const tutorId = cursoSeleccionado.tutor_id;
    const tutorSeleccionado = tutores.find(t => t.id === tutorId);

    // VALIDACIÓN: El tutor debe estar activo
    if (tutorSeleccionado && tutorSeleccionado.estado === 0) {
      return alert('⚠️ El tutor asignado al curso está INACTIVO. No se pueden crear matrículas con tutores inactivos.');
    }
    
    if (formData.es_grupo) {
      if (!formData.estudiante_ids || formData.estudiante_ids.length === 0) return alert('Selecciona al menos un alumno para el grupo.');
      
      // VALIDACIÓN: Todos los estudiantes del grupo deben estar activos
      const estudiantesInactivos = formData.estudiante_ids
        .map(id => estudiantes.find(e => e.id === id))
        .filter(e => e && e.estado === 0);
      
      if (estudiantesInactivos.length > 0) {
        const nombres = estudiantesInactivos.map(e => e?.nombre).join(', ');
        return alert(`⚠️ Los siguientes estudiantes están INACTIVOS: ${nombres}. No se pueden matricular estudiantes inactivos.`);
      }
    } else {
      if (!formData.estudiante_id) {
        return alert('Selecciona un alumno.');
      }

      // VALIDACIÓN: El estudiante debe estar activo
      const estudianteSeleccionado = estudiantes.find(e => e.id === formData.estudiante_id);
      if (estudianteSeleccionado && estudianteSeleccionado.estado === 0) {
        return alert(`⚠️ El estudiante ${estudianteSeleccionado.nombre} está INACTIVO. No se pueden matricular estudiantes inactivos.`);
      }
    }

    try {
      const payload = formData.es_grupo ? {
        estudiante_ids: formData.estudiante_ids,
        curso_id: formData.curso_id,
        tutor_id: tutorId,
        es_grupo: true,
        grupo_nombre: formData.grupo_nombre || null,
      } : {
        estudiante_id: formData.estudiante_id,
        curso_id: formData.curso_id,
        tutor_id: tutorId,
        es_grupo: false,
        grupo_nombre: null,
      };
      if (editingId) await api.matriculas.update(editingId, payload);
      else await api.matriculas.create(payload);
      resetForm();
      loadData();
    } catch (error) {
      setErrors({ submit: getErrorMessage(error) });
    }
  };

  const handleEdit = (matricula: Matricula) => {
    setEditingId(matricula.id);
    setFormData({
      estudiante_id: matricula.estudiante_id,
      curso_id: matricula.curso_id,
      tutor_id: matricula.tutor_id,
      es_grupo: matricula.es_grupo,
      grupo_nombre: matricula.grupo_nombre || '',
      estudiante_ids: []
    });
    setShowModal(true);
  };

  const handleCancel = async (id: number) => {
    if (window.confirm('¿Confirmas que deseas cancelar esta matrícula?')) {
      try {
        await api.matriculas.delete(id);
        loadData();
      } catch (error) {
        alert('Error al cancelar la matrícula');
      }
    }
  };

  const resetForm = () => {
    setEditingId(null);
    setFormData({ estudiante_id: 0, curso_id: 0, tutor_id: 0, es_grupo: false, grupo_nombre: '', estudiante_ids: [] });
    setShowModal(false);
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-[50vh]">
      <div className="w-10 h-10 border-4 border-slate-200 border-t-blue-600 rounded-full animate-spin mb-4" />
      <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Cargando matrículas...</p>
    </div>
  );

  const filteredMatriculas = matriculas.filter((m) => {
    const byCurso = filterCursoId ? m.curso_id === filterCursoId : true;
    const byGrupo = filterGrupo ? (m.grupo_nombre || '').toLowerCase().includes(filterGrupo.toLowerCase()) : true;
    return byCurso && byGrupo;
  });

  const estudiantesUnicos = matriculas.reduce((set, m: any) => {
    if (m.es_grupo) {
      const ids = (m.estudiante_ids || []).concat((m.students || []).map((s: any) => s.id));
      ids.filter(Boolean).forEach((id: number) => set.add(id));
    } else if (m.estudiante_id) {
      set.add(m.estudiante_id);
    }
    return set;
  }, new Set<number>());

  const resumenStats = {
    total: matriculas.length,
    grupos: matriculas.filter(m => m.es_grupo).length,
    individuales: matriculas.filter(m => !m.es_grupo).length,
    cursos: new Set(matriculas.map(m => m.curso_id)).size,
    alumnos: estudiantesUnicos.size,
  };

  // Mapa rápido de estudiantes para resolver nombres por id
  const estudiantesMap = new Map<number, string>(
    estudiantes.map((e) => [e.id, e.nombre])
  );

  // Agrupar matrículas por grupo_id si es grupo, si no por id individual
  const groupedMatriculas = matriculas.reduce((acc, m) => {
    if (m.es_grupo && m.grupo_id) {
      const key = `grupo-${m.grupo_id}`;
      if (!acc[key]) {
        acc[key] = { ...m, students: [] };
      }
      const detalle = (m as any).estudiantes_detalle;
      const idsArr = (m as any).estudiante_ids;
      if (Array.isArray(detalle) && detalle.length > 0) {
        detalle.forEach((est: any) => {
          acc[key].students.push({ id: est.id, nombre: est.nombre });
        });
      } else if (Array.isArray(idsArr) && idsArr.length > 0) {
        idsArr.forEach((id: number) => {
          acc[key].students.push({ id, nombre: estudiantesMap.get(id) || `Alumno ${id}` });
        });
      } else if (m.estudiante_nombre) {
        acc[key].students.push({ id: m.estudiante_id, nombre: m.estudiante_nombre });
      }
    } else {
      acc[`individual-${m.id}`] = m;
    }
    return acc;
  }, {} as Record<string, any>);

  const displayMatriculas = Object.values(groupedMatriculas) as MatriculaConGrupo[];

  // Utilidades para renderizar horarios
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

  const renderHorarioBadges = (m: Matricula) => {
    const scheduleRaw = parseMaybeJSON(m.curso_dias_schedule as any);
    const turnosRaw = parseMaybeJSON(m.curso_dias_turno as any);

    const items: { dia: string; label: string }[] = [];

    // Caso 1: objeto tipo { Lunes: { hora_inicio, hora_fin, turno } }
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

    // Caso 2: arreglo de sesiones [{ dia: 'Lunes', hora_inicio, hora_fin }]
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

    // Caso 3: turnos simples { Lunes: 'Tarde' }
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

  const buildStudentsList = (m: any) => {
    if (Array.isArray(m?.students) && m.students.length > 0) return m.students;
    if (Array.isArray(m?.estudiantes_detalle) && m.estudiantes_detalle.length > 0) return m.estudiantes_detalle;
    if (m?.estudiante_nombre) return [{ id: m.estudiante_id, nombre: m.estudiante_nombre }];
    if (Array.isArray(m?.estudiante_ids) && m.estudiante_ids.length > 0) {
      return m.estudiante_ids.map((id: number) => ({ id, nombre: estudiantesMap.get(id) || `Alumno ${id}` }));
    }
    return [];
  };

  // Fechas exactas del mes actual por día de semana
  const renderFechasMes = (m: Matricula) => {
    const schedule = m.curso_dias_schedule as any;
    const turnos = m.curso_dias_turno as any;

    const now = new Date();
    const y = now.getFullYear();
    const mIdx = now.getMonth();
    const start = new Date(y, mIdx, 1);
    const end = new Date(y, mIdx + 1, 0);

    const fechasPorDia = (diaNombre: string) => {
      const targetDow = DIA_A_IDX[diaNombre];
      const fechas: string[] = [];
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        if (d.getDay() === targetDow) {
          const dd = String(d.getDate()).padStart(2, '0');
          const mm = String(d.getMonth() + 1).padStart(2, '0');
          fechas.push(`${dd}/${mm}`);
        }
      }
      return fechas;
    };

    if (schedule && Object.keys(schedule).length > 0) {
      const diasConFechas = Object.keys(schedule).filter(dia => {
        const fechas = fechasPorDia(dia);
        return fechas.length > 0; // Solo mostrar si tiene fechas en este mes
      });

      if (diasConFechas.length === 0) return null;

      return (
        <div className="mt-3 space-y-1">
          {diasConFechas.map((dia) => {
            const fechas = fechasPorDia(dia);
            const info = schedule[dia];
            return (
              <div key={dia} className="text-xs text-slate-300 flex items-center justify-between">
                <span className="font-bold text-white">{dia.slice(0,3)}</span>
                <span className="text-slate-400">{fechas.join(', ')}</span>
                <span className="font-semibold text-slate-200">{info?.hora_inicio} - {info?.hora_fin}</span>
              </div>
            );
          })}
        </div>
      );
    }

    if (turnos && Object.keys(turnos).length > 0) {
      const diasConFechas = Object.keys(turnos).filter(dia => {
        const fechas = fechasPorDia(dia);
        return fechas.length > 0; // Solo mostrar si tiene fechas en este mes
      });

      if (diasConFechas.length === 0) return null;

      return (
        <div className="mt-3 space-y-1">
          {diasConFechas.map((dia) => {
            const fechas = fechasPorDia(dia);
            const turno = turnos[dia];
            return (
              <div key={dia} className="text-xs text-slate-300 flex items-center justify-between">
                <span className="font-bold text-white">{dia.slice(0,3)}</span>
                <span className="text-slate-400">{fechas.join(', ')}</span>
                <span className="font-semibold text-slate-200">{turno}</span>
              </div>
            );
          })}
        </div>
      );
    }

    return null;
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      <aside className="lg:w-[32%] space-y-4 sticky top-24 self-start">
        <Card className="border-white/10">
          <CardHeader>
            <CardTitle className="text-lg">Resumen rápido</CardTitle>
            <CardDescription className="text-xs">Indicadores de matrículas</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {[{
                label: 'Matrículas totales', valor: resumenStats.total, accent: '#FFC800'
              }, {
                label: 'Grupos', valor: resumenStats.grupos, accent: '#00AEEF'
              }, {
                label: 'Individuales', valor: resumenStats.individuales, accent: '#FFC800'
              }, {
                label: 'Cursos distintos', valor: resumenStats.cursos, accent: '#00AEEF'
              }, {
                label: 'Alumnos únicos', valor: resumenStats.alumnos, accent: '#FFC800'
              }].map((card) => (
                <div key={card.label} className="relative p-4 rounded-2xl border border-white/10 bg-[#0F2445] hover:border-[#00AEEF]/40 hover:shadow-cyan-500/10 transition-all overflow-hidden">
                  <div className="absolute top-0 right-0 w-16 h-16 rounded-bl-full" style={{ backgroundColor: `${card.accent}22` }} />
                  <div className="relative z-10">
                    <div className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">{card.label}</div>
                    <div className="text-3xl font-black text-white mt-1">{card.valor}</div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </aside>

      <div className="flex-1 space-y-10">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-white/10 pb-8">
          <div>
            <h1 className="text-3xl font-black text-white tracking-tight">Expediente de Matrículas</h1>
            <p className="text-slate-300 font-medium mt-2">Vínculos entre alumnos, cursos y docentes</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-2xl px-2 py-1">
              <Button variant={viewMode==='tabla'?'primary':'secondary'} onClick={() => setViewMode('tabla')} className="h-9">Tabla</Button>
              <Button variant={viewMode==='tarjetas'?'primary':'secondary'} onClick={() => setViewMode('tarjetas')} className="h-9">Tarjetas</Button>
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
            Nueva Matrícula
            </Button>
          </div>
        </header>

      {/* Dialogo de detalle */}
      <Dialog isOpen={detailOpen} onClose={() => setDetailOpen(false)} title="Resumen de Matrícula">
        {detalle && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/10 border border-white/15 flex items-center justify-center text-white font-black">
                {detalle.estudiante_nombre?.charAt(0)}
              </div>
              <div>
                <div className="font-bold text-white">{detalle.estudiante_nombre}</div>
                <div className="text-sm text-slate-300">{detalle.curso_nombre} • Docente: {detalle.tutor_nombre}</div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-lg border border-white/10 bg-white/5">
                <div className="text-[11px] font-bold text-slate-300 uppercase">Inscripción</div>
                <div className="text-sm font-semibold text-slate-100">{new Date(detalle.fecha_inscripcion).toLocaleDateString('es-ES')}</div>
              </div>
              <div className="p-3 rounded-lg border border-white/10 bg-white/5">
                <div className="text-[11px] font-bold text-slate-300 uppercase">Tipo</div>
                <div className="text-sm font-semibold text-slate-100">{detalle.curso_tipo_clase === 'tutoria' ? 'Tutoría' : 'Grupal'}</div>
              </div>
            </div>

            {detalle.es_grupo && (
              <div className="p-3 rounded-lg border border-white/10 bg-white/5">
                <div className="text-[11px] font-bold text-slate-300 uppercase">Grupo</div>
                <div className="text-sm font-semibold text-slate-100">{detalle.grupo_nombre || 'Grupo'}</div>
              </div>
            )}

            <div>
              <div className="text-xs font-bold text-slate-300 uppercase mb-2">Alumnos matriculados</div>
              <div className="space-y-2">
                {buildStudentsList(detalle).length === 0 ? (
                  <div className="text-sm text-slate-400">Sin alumnos registrados</div>
                ) : (
                  buildStudentsList(detalle).map((al: any) => (
                    <div key={al.id || al.nombre} className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-white/10 border border-white/10 flex items-center justify-center text-white font-bold text-xs">
                        {al.nombre?.charAt(0) || '?'}
                      </div>
                      <span className="font-semibold text-slate-100">{al.nombre}</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div>
              <div className="text-xs font-bold text-slate-300 uppercase mb-2">Horario</div>
              {renderHorarioBadges(detalle)}
            </div>

            {(detalle.curso_costo_curso || detalle.curso_pago_tutor) && (
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-lg border border-white/10 bg-white/5">
                  <div className="text-[11px] font-bold text-amber-300 uppercase">Costo curso</div>
                  <div className="text-sm font-black text-white">₡{(detalle.curso_costo_curso || 0).toLocaleString()}</div>
                </div>
                <div className="p-3 rounded-lg border border-white/10 bg-white/5">
                  <div className="text-[11px] font-bold text-cyan-300 uppercase">Pago tutor</div>
                  <div className="text-sm font-black text-white">₡{(detalle.curso_pago_tutor || 0).toLocaleString()}</div>
                </div>
              </div>
            )}
          </div>
        )}
      </Dialog>

      {/* Tabla de Matrículas */}
      {viewMode === 'tabla' && (
      <div className="overflow-x-auto rounded-3xl border border-white/10 bg-[#0F2445] shadow-xl">
        <table className="w-full">
          <thead>
            <tr className="bg-white/5 border-b border-white/10">
              <th className="px-8 py-4 text-left text-xs font-black text-slate-200 uppercase tracking-wide">Estudiante</th>
              <th className="px-8 py-4 text-left text-xs font-black text-slate-200 uppercase tracking-wide">Curso</th>
              <th className="px-8 py-4 text-left text-xs font-black text-slate-200 uppercase tracking-wide">Tutor</th>
              <th className="px-8 py-4 text-left text-xs font-black text-slate-200 uppercase tracking-wide">Grupo</th>
              <th className="px-8 py-4 text-left text-xs font-black text-slate-200 uppercase tracking-wide">Inscripción</th>
              <th className="px-8 py-4 text-right text-xs font-black text-slate-200 uppercase tracking-wide">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {matriculas.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-24 text-center text-slate-400 font-bold uppercase tracking-widest">
                  No hay matrículas registradas
                </td>
              </tr>
            ) : (
              matriculas.map((m) => (
                <tr key={m.id} className="transition-colors hover:bg-white/5">
                  <td className="px-8 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-white/10 border border-white/10 flex items-center justify-center text-white font-bold">
                        {m.estudiante_nombre?.charAt(0)}
                      </div>
                      <span className="font-semibold text-white">{m.estudiante_nombre}</span>
                    </div>
                  </td>
                  <td className="px-8 py-4">
                    <div className="flex items-center gap-3">
                      <BookOpen className="w-4 h-4 text-[#FFC800]" />
                      <span className="text-slate-200 font-semibold">{m.curso_nombre}</span>
                    </div>
                  </td>
                  <td className="px-8 py-4">
                    <div className="flex items-center gap-3">
                      <GraduationCap className="w-4 h-4 text-[#00AEEF]" />
                      <span className="text-slate-200 font-semibold">{m.tutor_nombre}</span>
                    </div>
                  </td>
                  <td className="px-8 py-4">
                    {m.es_grupo ? (
                      <Badge variant="info">{m.grupo_nombre || 'Grupo'}</Badge>
                    ) : (
                      <span className="text-slate-500 text-sm">—</span>
                    )}
                  </td>
                  <td className="px-8 py-4 text-slate-300">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      <span className="text-sm">{new Date(m.fecha_inscripcion).toLocaleDateString('es-ES')}</span>
                    </div>
                  </td>
                  <td className="px-8 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => handleEdit(m)} 
                        className="h-9 w-9 bg-white/5 hover:bg-white/10 text-white border border-white/10"
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button 
                        variant="destructive" 
                        size="icon" 
                        onClick={() => handleCancel(m.id)} 
                        className="h-9 w-9 bg-red-700 hover:bg-red-800 text-white border-0"
                      >
                        <XCircle className="w-4 h-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      )}

      {/* Tarjetas de Matrículas */}
      {viewMode === 'tarjetas' && (
        <div className="space-y-4">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="flex-1">
              <Label>Filtrar por curso</Label>
              <Select value={filterCursoId} onChange={(e) => setFilterCursoId(parseInt(e.target.value) || 0)} className="mt-2">
                <option value={0}>Todos los cursos</option>
                  {Array.from(new Set(displayMatriculas.map(m => m.curso_id))).map(cid => {
                  const c = cursos.find(cu => cu.id === cid);
                  return <option key={cid} value={cid}>{c?.nombre || `Curso ${cid}`}</option>;
                })}
              </Select>
            </div>

            <div className="flex-1">
              <Label>Filtrar por grupo</Label>
              <Input value={filterGrupo} onChange={(e) => setFilterGrupo(e.target.value)} placeholder="Nombre del grupo" className="mt-2" />
            </div>
            <div className="flex items-end">
              <Button variant="secondary" onClick={() => { setFilterCursoId(0); setFilterGrupo(''); }}>Limpiar</Button>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
            {displayMatriculas.length === 0 ? (
              <div className="col-span-full flex flex-col items-center justify-center py-24 bg-white/5 rounded-2xl border-2 border-dashed border-white/10">
                <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Sin matrículas</p>
              </div>
            ) : (
              displayMatriculas.filter(m => {
                const byCurso = filterCursoId ? m.curso_id === filterCursoId : true;
                const byGrupo = filterGrupo ? (m.grupo_nombre || '').toLowerCase().includes(filterGrupo.toLowerCase()) : true;
                return byCurso && byGrupo;
              }).length === 0 ? (
                <div className="col-span-full flex flex-col items-center justify-center py-24 bg-white/5 rounded-2xl border-2 border-dashed border-white/10">
                  <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Sin resultados para estos filtros</p>
                </div>
              ) : (
                displayMatriculas.filter(m => {
                  const byCurso = filterCursoId ? m.curso_id === filterCursoId : true;
                  const byGrupo = filterGrupo ? (m.grupo_nombre || '').toLowerCase().includes(filterGrupo.toLowerCase()) : true;
                  return byCurso && byGrupo;
                }).map((m) => (
              <div 
                key={m.id} 
                className="rounded-3xl border border-white/10 bg-[#0F2445] shadow-xl p-6 hover:border-[#00AEEF]/40 hover:shadow-cyan-500/15 transition cursor-pointer"
                onClick={() => { setDetalle(m); setDetailOpen(true); }}
              >
                {/* NOMBRE DEL CURSO - GRANDE */}
                <div className="mb-4">
                  <div className="text-2xl font-black text-white">{m.curso_nombre}</div>
                  <div className="text-sm text-slate-300 mt-1">Docente: <span className="font-semibold text-white">{m.tutor_nombre}</span></div>
                </div>

                {/* HORARIOS DEL MES */}
                {renderFechasMes(m)}

                {/* ESTUDIANTES MATRICULADOS */}
                <div className="mt-4 pt-4 border-t border-white/10">
                  <p className="text-xs font-bold text-slate-400 uppercase mb-2">Alumnos Matriculados</p>
                  <div className="space-y-2">
                    {m.students && m.students.length > 0 ? (
                      m.students.map((student: any) => (
                        <div key={student.id} className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-white/10 border border-white/10 flex items-center justify-center text-white font-bold text-xs">
                            {student.nombre?.charAt(0)}
                          </div>
                          <span className="font-semibold text-slate-100">{student.nombre}</span>
                        </div>
                      ))
                    ) : (
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-white/10 border border-white/10 flex items-center justify-center text-white font-bold text-xs">
                          {m.estudiante_nombre?.charAt(0)}
                        </div>
                        <span className="font-semibold text-slate-100">{m.estudiante_nombre}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* TIPO Y GRUPO */}
                <div className="mt-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {m.es_grupo && (
                      <Badge variant="info">{m.grupo_nombre || 'Grupo'}</Badge>
                    )}
                    <Badge variant="secondary">{m.curso_tipo_clase === 'tutoria' ? 'Tutoría' : 'Grupal'}</Badge>
                  </div>
                  <div className="text-xs text-slate-400">
                    {new Date(m.fecha_inscripcion).toLocaleDateString('es-ES')}
                  </div>
                </div>

                {/* ACCIONES */}
                <div className="flex items-center gap-2 mt-4 pt-4 border-t border-white/10 justify-end">
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={(e) => { e.stopPropagation(); handleEdit(m); }} 
                    className="h-9 w-9 bg-white/5 hover:bg-white/10 text-white border border-white/10"
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button 
                    variant="destructive" 
                    size="icon" 
                    onClick={(e) => { e.stopPropagation(); handleCancel(m.id); }} 
                    className="h-9 w-9 bg-red-700 hover:bg-red-800 text-white border-0"
                  >
                    <XCircle className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))
          )
        )}
          </div>
        </div>
      )}

      {/* Modal de Formulario */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-[#0F2445] border border-white/10 shadow-2xl">
            <div className="border-b border-white/10 p-8 flex justify-between items-start bg-white/5 rounded-t-3xl">
              <div>
                <h2 className="text-2xl font-black text-white tracking-tight">
                  {editingId ? 'Editar Matrícula' : 'Formalizar Nueva Matrícula'}
                </h2>
                <p className="text-sm text-slate-300 mt-1">Vincula alumnos a programas de estudio</p>
              </div>
              <button
                onClick={() => {
                  setShowModal(false);
                  resetForm();
                }}
                className="p-3 rounded-full bg-white/10 hover:bg-white/20 border border-white/15 text-white transition-all"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-8 space-y-8">
              {/* Matrícula grupal */}
              <div className="p-4 border border-white/10 rounded-xl bg-white/5">
                <div className="flex items-center gap-3">
                  <input
                    id="es_grupo"
                    type="checkbox"
                    checked={!!formData.es_grupo}
                    onChange={(e) => setFormData(prev => ({ ...prev, es_grupo: e.target.checked }))}
                    className="w-4 h-4"
                  />
                  <Label htmlFor="es_grupo" className="m-0">Matrícula en grupo</Label>
                </div>
                {formData.es_grupo && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
                    <div className="md:col-span-2">
                      <Label>Nombre del grupo</Label>
                      <Input
                        value={formData.grupo_nombre}
                        onChange={(e) => setFormData(prev => ({ ...prev, grupo_nombre: e.target.value }))}
                        placeholder="Ej: Grupo A1 Nocturno"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Campos de Selección */}
              <div className="space-y-6">
                {!formData.es_grupo ? (
                  <div>
                    <Label>Seleccionar Alumno *</Label>
                    <Select 
                      value={formData.estudiante_id} 
                      onChange={(e) => handleSelectChange('estudiante_id', e.target.value)}
                      className="mt-2"
                    >
                      <option value={0}>Buscar alumno...</option>
                      {estudiantes.filter(e => e.estado === 1).map(e => (
                        <option key={e.id} value={e.id}>
                          {e.nombre} (Grado: {e.grado})
                        </option>
                      ))}
                    </Select>
                  </div>
                ) : (
                  <div>
                    <Label>Seleccionar Alumnos (Grupo) *</Label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2 max-h-64 overflow-auto p-2 border border-white/10 rounded-xl bg-white/5">
                      {estudiantes.filter(e => e.estado === 1).map(e => {
                        const checked = formData.estudiante_ids.includes(e.id);
                        return (
                          <label key={e.id} className="flex items-center gap-2 p-2 rounded-lg hover:bg-white/10 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(ev) => {
                                const c = ev.target.checked;
                                setFormData(prev => ({
                                  ...prev,
                                  estudiante_ids: c ? [...prev.estudiante_ids, e.id] : prev.estudiante_ids.filter(id => id !== e.id)
                                }));
                              }}
                              className="w-4 h-4"
                            />
                            <span className="text-sm font-semibold text-white">{e.nombre}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div>
                  <Label>Programa de Estudio *</Label>
                  <Select 
                    value={formData.curso_id} 
                    onChange={(e) => handleSelectChange('curso_id', e.target.value)}
                    className="mt-2"
                  >
                    <option value={0}>Selecciona un curso...</option>
                    {cursos.filter(c => c.estado === 1).map(c => (
                      <option key={c.id} value={c.id}>
                        {c.nombre} ({c.nivel}) - {c.tipo_clase === 'tutoria' ? 'Tutoría' : 'Grupal'}
                      </option>
                    ))}
                  </Select>
                </div>

              </div>

              {/* Mensaje de Advertencia */}
              <div className="bg-white/5 p-5 rounded-lg border border-white/10 flex items-start gap-3 text-slate-200 text-sm leading-relaxed font-semibold">
                <AlertCircle className="w-5 h-5 text-[#FFC800] flex-shrink-0 mt-0.5" />
                <span>Verifica que los horarios del alumno, tutor y curso sean compatibles antes de matricular.</span>
              </div>

              {errors.submit && (
                <div className="bg-red-900/30 border border-red-500/40 text-red-100 text-sm font-semibold px-4 py-3 rounded-lg">
                  {errors.submit}
                </div>
              )}

              {/* Botones */}
              <div className="flex gap-4 justify-end pt-6 border-t border-white/10">
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
                  disabled={!formData.curso_id || (formData.es_grupo ? formData.estudiante_ids.length === 0 : !formData.estudiante_id)}
                  className="px-8 bg-[#00AEEF] hover:bg-[#00AEEF]/80 text-[#051026] font-bold disabled:opacity-50"
                >
                  {editingId ? 'Actualizar Matrícula' : 'Matricular Alumno'}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
      </div>
    </div>
  );
};

export default Matriculas;
