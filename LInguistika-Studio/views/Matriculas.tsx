import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { Matricula, Tutor, Curso, Estudiante } from '../types';
import { Button, Card, Select, Label, Badge, Input, Dialog } from '../components/UI';
import { Plus, Edit, XCircle, AlertCircle, Calendar, User, BookOpen, GraduationCap, CheckCircle, AlertTriangle, X } from 'lucide-react';

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
    
    const tutorId = cursoSeleccionado.tutor_id;
    
    if (formData.es_grupo) {
      if (!formData.estudiante_ids || formData.estudiante_ids.length === 0) return alert('Selecciona al menos un alumno para el grupo.');
    } else if (!formData.estudiante_id) {
      return alert('Selecciona un alumno.');
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
      alert('Error al guardar la matrícula');
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

  const displayMatriculas = Object.values(groupedMatriculas);

  // Utilidades para renderizar horarios
  const renderHorarioBadges = (m: Matricula) => {
    const schedule = m.curso_dias_schedule as any;
    const turnos = m.curso_dias_turno as any;
    if (schedule && Object.keys(schedule).length > 0) {
      return (
        <div className="flex flex-wrap gap-1 mt-3">
          {Object.keys(schedule).map((dia) => (
            <span key={dia} className="text-[11px] bg-blue-50 text-blue-700 font-bold px-2 py-1 rounded-full border border-blue-200">
              {dia.slice(0,3)} {schedule[dia]?.hora_inicio} - {schedule[dia]?.hora_fin}
            </span>
          ))}
        </div>
      );
    }
    if (turnos && Object.keys(turnos).length > 0) {
      return (
        <div className="flex flex-wrap gap-1 mt-3">
          {Object.keys(turnos).map((dia) => (
            <span key={dia} className="text-[11px] bg-indigo-50 text-indigo-700 font-bold px-2 py-1 rounded-full border border-indigo-200">
              {dia.slice(0,3)} • {turnos[dia]}
            </span>
          ))}
        </div>
      );
    }
    return <div className="text-xs text-slate-400 mt-3">Sin horario asignado</div>;
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
              <div key={dia} className="text-xs text-slate-600 flex items-center justify-between">
                <span className="font-bold text-slate-700">{dia.slice(0,3)}</span>
                <span className="text-slate-500">{fechas.join(', ')}</span>
                <span className="font-semibold text-slate-700">{info?.hora_inicio} - {info?.hora_fin}</span>
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
              <div key={dia} className="text-xs text-slate-600 flex items-center justify-between">
                <span className="font-bold text-slate-700">{dia.slice(0,3)}</span>
                <span className="text-slate-500">{fechas.join(', ')}</span>
                <span className="font-semibold text-slate-700">{turno}</span>
              </div>
            );
          })}
        </div>
      );
    }

    return null;
  };

  return (
    <div className="space-y-10">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-slate-200 pb-8">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Expediente de Matrículas</h1>
          <p className="text-slate-500 font-medium mt-2">Vínculos entre alumnos, cursos y docentes</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-2 py-1">
            <Button variant={viewMode==='tabla'?'primary':'secondary'} onClick={() => setViewMode('tabla')} className="h-9">Tabla</Button>
            <Button variant={viewMode==='tarjetas'?'primary':'secondary'} onClick={() => setViewMode('tarjetas')} className="h-9">Tarjetas</Button>
          </div>
          <Button
          onClick={() => {
            resetForm();
            setShowModal(true);
          }}
          variant="primary"
          className="h-12 px-8 gap-3 bg-blue-600 hover:bg-blue-700 text-white"
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
              <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-700 font-black">
                {detalle.estudiante_nombre?.charAt(0)}
              </div>
              <div>
                <div className="font-bold text-slate-900">{detalle.estudiante_nombre}</div>
                <div className="text-sm text-slate-600">{detalle.curso_nombre} • Docente: {detalle.tutor_nombre}</div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-lg border border-slate-200 bg-slate-50">
                <div className="text-[11px] font-bold text-slate-500 uppercase">Inscripción</div>
                <div className="text-sm font-semibold text-slate-800">{new Date(detalle.fecha_inscripcion).toLocaleDateString('es-ES')}</div>
              </div>
              <div className="p-3 rounded-lg border border-slate-200 bg-slate-50">
                <div className="text-[11px] font-bold text-slate-500 uppercase">Tipo</div>
                <div className="text-sm font-semibold text-slate-800">{detalle.curso_tipo_clase === 'tutoria' ? 'Tutoría' : 'Grupal'}</div>
              </div>
            </div>

            {detalle.es_grupo && (
              <div className="p-3 rounded-lg border border-indigo-200 bg-indigo-50">
                <div className="text-[11px] font-bold text-indigo-700 uppercase">Grupo</div>
                <div className="text-sm font-semibold text-indigo-900">{detalle.grupo_nombre || 'Grupo'}</div>
              </div>
            )}

            <div>
              <div className="text-xs font-bold text-slate-500 uppercase mb-2">Horario</div>
              {renderHorarioBadges(detalle)}
            </div>

            {(detalle.curso_costo_curso || detalle.curso_pago_tutor) && (
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-lg border border-green-200 bg-green-50">
                  <div className="text-[11px] font-bold text-green-700 uppercase">Costo curso</div>
                  <div className="text-sm font-black text-green-900">₡{(detalle.curso_costo_curso || 0).toLocaleString()}</div>
                </div>
                <div className="p-3 rounded-lg border border-blue-200 bg-blue-50">
                  <div className="text-[11px] font-bold text-blue-700 uppercase">Pago tutor</div>
                  <div className="text-sm font-black text-blue-900">₡{(detalle.curso_pago_tutor || 0).toLocaleString()}</div>
                </div>
              </div>
            )}
          </div>
        )}
      </Dialog>

      {/* Tabla de Matrículas */}
      {viewMode === 'tabla' && (
      <div className="overflow-x-auto bg-white rounded-lg border border-slate-200">
        <table className="w-full">
          <thead>
            <tr className="bg-slate-50/50 border-b border-slate-200">
              <th className="px-8 py-4 text-left text-xs font-black text-slate-700 uppercase tracking-wide">Estudiante</th>
              <th className="px-8 py-4 text-left text-xs font-black text-slate-700 uppercase tracking-wide">Curso</th>
              <th className="px-8 py-4 text-left text-xs font-black text-slate-700 uppercase tracking-wide">Tutor</th>
              <th className="px-8 py-4 text-left text-xs font-black text-slate-700 uppercase tracking-wide">Grupo</th>
              <th className="px-8 py-4 text-left text-xs font-black text-slate-700 uppercase tracking-wide">Inscripción</th>
              <th className="px-8 py-4 text-right text-xs font-black text-slate-700 uppercase tracking-wide">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {matriculas.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-24 text-center text-slate-400 font-bold uppercase tracking-widest">
                  No hay matrículas registradas
                </td>
              </tr>
            ) : (
              matriculas.map((m) => (
                <tr key={m.id} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                  <td className="px-8 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 font-bold">
                        {m.estudiante_nombre?.charAt(0)}
                      </div>
                      <span className="font-semibold text-slate-900">{m.estudiante_nombre}</span>
                    </div>
                  </td>
                  <td className="px-8 py-4">
                    <div className="flex items-center gap-3">
                      <BookOpen className="w-4 h-4 text-blue-500" />
                      <span className="text-slate-700 font-semibold">{m.curso_nombre}</span>
                    </div>
                  </td>
                  <td className="px-8 py-4">
                    <div className="flex items-center gap-3">
                      <GraduationCap className="w-4 h-4 text-emerald-500" />
                      <span className="text-slate-700 font-semibold">{m.tutor_nombre}</span>
                    </div>
                  </td>
                  <td className="px-8 py-4">
                    {m.es_grupo ? (
                      <Badge variant="info">{m.grupo_nombre || 'Grupo'}</Badge>
                    ) : (
                      <span className="text-slate-400 text-sm">—</span>
                    )}
                  </td>
                  <td className="px-8 py-4 text-slate-500">
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
                        className="h-9 w-9 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-100"
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
              <div className="col-span-full flex flex-col items-center justify-center py-24 bg-slate-50 rounded-xl border-2 border-dashed border-slate-200">
                <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Sin matrículas</p>
              </div>
            ) : (
              displayMatriculas.filter(m => {
                const byCurso = filterCursoId ? m.curso_id === filterCursoId : true;
                const byGrupo = filterGrupo ? (m.grupo_nombre || '').toLowerCase().includes(filterGrupo.toLowerCase()) : true;
                return byCurso && byGrupo;
              }).length === 0 ? (
                <div className="col-span-full flex flex-col items-center justify-center py-24 bg-slate-50 rounded-xl border-2 border-dashed border-slate-200">
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
                className="rounded-2xl border border-slate-200 bg-white shadow-sm p-6 hover:shadow-md transition cursor-pointer"
                onClick={() => { setDetalle(m); setDetailOpen(true); }}
              >
                {/* NOMBRE DEL CURSO - GRANDE */}
                <div className="mb-4">
                  <div className="text-2xl font-black text-slate-900">{m.curso_nombre}</div>
                  <div className="text-sm text-slate-600 mt-1">Docente: <span className="font-semibold text-slate-900">{m.tutor_nombre}</span></div>
                </div>

                {/* HORARIOS DEL MES */}
                {renderFechasMes(m)}

                {/* ESTUDIANTES MATRICULADOS */}
                <div className="mt-4 pt-4 border-t border-slate-200">
                  <p className="text-xs font-bold text-slate-500 uppercase mb-2">Alumnos Matriculados</p>
                  <div className="space-y-2">
                    {m.students && m.students.length > 0 ? (
                      m.students.map((student: any) => (
                        <div key={student.id} className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 font-bold text-xs">
                            {student.nombre?.charAt(0)}
                          </div>
                          <span className="font-semibold text-slate-900">{student.nombre}</span>
                        </div>
                      ))
                    ) : (
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 font-bold text-xs">
                          {m.estudiante_nombre?.charAt(0)}
                        </div>
                        <span className="font-semibold text-slate-900">{m.estudiante_nombre}</span>
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
                  <div className="text-xs text-slate-500">
                    {new Date(m.fecha_inscripcion).toLocaleDateString('es-ES')}
                  </div>
                </div>

                {/* ACCIONES */}
                <div className="flex items-center gap-2 mt-4 pt-4 border-t border-slate-200 justify-end">
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={(e) => { e.stopPropagation(); handleEdit(m); }} 
                    className="h-9 w-9 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-100"
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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white">
            <div className="border-b border-slate-200 p-8 flex justify-between items-start bg-slate-50/50">
              <div>
                <h2 className="text-2xl font-black text-slate-900 tracking-tight">
                  {editingId ? 'Editar Matrícula' : 'Formalizar Nueva Matrícula'}
                </h2>
                <p className="text-sm text-slate-500 mt-1">Vincula alumnos a programas de estudio</p>
              </div>
              <button
                onClick={() => {
                  setShowModal(false);
                  resetForm();
                }}
                className="p-3 rounded-full bg-red-50 hover:bg-red-100 border border-red-100 text-red-700 transition-all"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-8 space-y-8">
              {/* Matrícula grupal */}
              <div className="p-4 border border-slate-200 rounded-lg bg-slate-50">
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
                      {estudiantes.map(e => (
                        <option key={e.id} value={e.id}>
                          {e.nombre} (Grado: {e.grado})
                        </option>
                      ))}
                    </Select>
                  </div>
                ) : (
                  <div>
                    <Label>Seleccionar Alumnos (Grupo) *</Label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2 max-h-64 overflow-auto p-2 border border-slate-200 rounded-xl bg-white">
                      {estudiantes.map(e => {
                        const checked = formData.estudiante_ids.includes(e.id);
                        return (
                          <label key={e.id} className="flex items-center gap-2 p-2 rounded-lg hover:bg-slate-50 cursor-pointer">
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
                            <span className="text-sm font-semibold text-slate-700">{e.nombre}</span>
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
                    {cursos.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.nombre} ({c.nivel}) - {c.tipo_clase === 'tutoria' ? 'Tutoría' : 'Grupal'}
                      </option>
                    ))}
                  </Select>
                </div>

              </div>

              {/* Mensaje de Advertencia */}
              <div className="bg-blue-50/50 p-5 rounded-lg border border-blue-200 flex items-start gap-3 text-blue-700 text-sm leading-relaxed font-semibold">
                <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <span>Verifica que los horarios del alumno, tutor y curso sean compatibles antes de matricular.</span>
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
                  disabled={!formData.curso_id || (formData.es_grupo ? formData.estudiante_ids.length === 0 : !formData.estudiante_id)}
                  className="px-8 bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50"
                >
                  {editingId ? 'Actualizar Matrícula' : 'Matricular Alumno'}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
};

export default Matriculas;
