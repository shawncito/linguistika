import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { Curso, Tutor } from '../types';
import { 
  Button, Card, CardHeader, CardTitle, CardDescription, 
  Badge, Input, Label, Select
} from '../components/UI';
import { Plus, Edit, Trash2, BookOpen, Users as UsersIcon, Clock } from 'lucide-react';

const DIAS_SEMANA = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
const NIVELES = ['None', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
const TURNOS = ['Tarde', 'Noche'];

const Cursos: React.FC = () => {
  const [cursos, setCursos] = useState<Curso[]>([]);
  const [tutores, setTutores] = useState<Tutor[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formData, setFormData] = useState({
    nombre: '',
    descripcion: '',
    nivel: 'None',
    tipo_clase: 'grupal',
    max_estudiantes: 10,
    dias: [] as string[],
    dias_turno: {} as Record<string, 'Tarde' | 'Noche'>,
    dias_schedule: {} as Record<string, {
      turno: 'Tarde' | 'Noche';
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

  // Función para calcular duración en horas
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
    const [cursos, tutores] = await Promise.all([
      api.cursos.getAll(),
      api.tutores.getAll()
    ]);
    setCursos(cursos);
    setTutores(tutores);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};

    if (!formData.nombre.trim()) newErrors.nombre = 'Nombre requerido';
    if (formData.dias.length === 0) newErrors.dias = 'Selecciona al menos un día';
    
    // Validar que todos los días tengan turno asignado
    for (const dia of formData.dias) {
      if (!formData.dias_turno[dia]) {
        newErrors.dias = 'Todos los días deben tener un turno asignado';
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

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    try {
      const dataToSubmit = {
        nombre: formData.nombre.trim(),
        descripcion: formData.descripcion.trim(),
        nivel: formData.nivel,
        tipo_clase: formData.tipo_clase,
        max_estudiantes: formData.tipo_clase === 'tutoria' ? null : formData.max_estudiantes,
        dias: formData.dias,
        dias_turno: formData.dias_turno,
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
    } catch (error) {
      setErrors({ submit: 'Error al guardar curso' });
    }
  };

  const resetForm = () => {
    setEditingId(null);
    setFormData({
      nombre: '',
      descripcion: '',
      nivel: 'None',
      tipo_clase: 'grupal',
      max_estudiantes: 10,
      dias: [],
      dias_turno: {},
      dias_schedule: {},
      costo_curso: 0,
      pago_tutor: 0,
      tutor_id: 0,
      grado_activo: false,
      grado_nombre: '',
      grado_color: '#2563eb'
    });
    setErrors({});
  };

  const handleEdit = (curso: Curso) => {
    setEditingId(curso.id);
    setFormData({
      nombre: curso.nombre,
      descripcion: curso.descripcion || '',
      nivel: curso.nivel || 'None',
      tipo_clase: curso.tipo_clase || 'grupal',
      max_estudiantes: curso.max_estudiantes || 10,
      dias: Array.isArray(curso.dias) ? curso.dias : [],
      dias_turno: curso.dias_turno || {},
      dias_schedule: curso.dias_schedule || {},
      costo_curso: curso.costo_curso || 0,
      pago_tutor: curso.pago_tutor || 0,
      tutor_id: curso.tutor_id || 0,
      grado_activo: !!curso.grado_activo,
      grado_nombre: curso.grado_nombre || '',
      grado_color: curso.grado_color || '#2563eb'
    });
    setShowModal(true);
  };

  const handleDelete = async (id: number) => {
    if (window.confirm('¿Estás seguro de eliminar este curso?')) {
      await api.cursos.delete(id);
      loadData();
    }
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-[50vh]">
      <div className="w-10 h-10 border-4 border-slate-200 border-t-blue-600 rounded-full animate-spin mb-4" />
      <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Cargando cursos...</p>
    </div>
  );

  return (
    <div className="space-y-10">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-slate-200 pb-8">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Catálogo de Cursos</h1>
          <p className="text-slate-500 font-medium mt-2">Programas académicos y niveles</p>
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
          Nuevo Curso
        </Button>
      </header>

      {/* Modal de Formulario */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white">
            <CardHeader className="border-b border-slate-200 flex justify-between items-start">
              <div>
                <CardTitle>{editingId ? 'Editar Curso' : 'Nuevo Curso'}</CardTitle>
                <CardDescription>Configura los detalles del programa académico</CardDescription>
              </div>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600">
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

              {/* Tutor Asignado */}
              <div>
                <Label>Asignar Tutor (opcional)</Label>
                <Select 
                  value={formData.tutor_id || 0} 
                  onChange={(e) => setFormData(prev => ({ ...prev, tutor_id: parseInt(e.target.value) || 0 }))}
                >
                  <option value={0}>Sin tutor asignado</option>
                  {tutores.map(tutor => (
                    <option key={tutor.id} value={tutor.id}>
                      {tutor.nombre} - {tutor.especialidad}
                    </option>
                  ))}
                </Select>
                <p className="text-xs text-slate-500 mt-1">
                  Se validará la compatibilidad de horarios automáticamente
                </p>
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
                              dias_turno: { ...prev.dias_turno, [dia]: 'Tarde' }
                            }));
                          } else {
                            setFormData(prev => {
                              const newDiasTurno = { ...prev.dias_turno };
                              delete newDiasTurno[dia];
                              return {
                                ...prev,
                                dias: prev.dias.filter(d => d !== dia),
                                dias_turno: newDiasTurno
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

              {/* Selección de turnos y horarios por día */}
              {formData.dias.length > 0 && (
                <div>
                  <Label>Turnos y Horarios por Día *</Label>
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
                        
                        {/* Selección de turno */}
                        <div className="flex gap-2">
                          {TURNOS.map(turno => (
                            <label
                              key={turno}
                              className="flex items-center gap-2 p-2 border border-slate-300 rounded hover:border-blue-400 cursor-pointer flex-1 text-sm"
                              style={{ borderColor: formData.dias_schedule[dia]?.turno === turno ? '#2563eb' : undefined, backgroundColor: formData.dias_schedule[dia]?.turno === turno ? '#eff6ff' : undefined }}
                            >
                              <input
                                type="radio"
                                name={`turno-${dia}`}
                                value={turno}
                                checked={formData.dias_schedule[dia]?.turno === turno}
                                onChange={(e) => {
                                  const schedule = formData.dias_schedule[dia] || { turno: 'Tarde', hora_inicio: '14:00', hora_fin: '17:00' };
                                  setFormData(prev => ({
                                    ...prev,
                                    dias_schedule: {
                                      ...prev.dias_schedule,
                                      [dia]: { ...schedule, turno: e.target.value as 'Tarde' | 'Noche' }
                                    }
                                  }));
                                }}
                                className="w-4 h-4"
                              />
                              <span className="font-semibold text-slate-900">{turno}</span>
                            </label>
                          ))}
                        </div>
                        
                        {/* Selección de horas */}
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-xs font-semibold text-slate-600 mb-1">Hora Inicio</label>
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
                            <label className="block text-xs font-semibold text-slate-600 mb-1">Hora Fin</label>
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

              {/* Costos del Curso */}
              <div>
                <Label className="text-lg font-semibold">💰 Costos</Label>
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
              {errors.submit && <p className="text-red-500 text-sm">{errors.submit}</p>}
            </form>
          </Card>
        </div>
      )}

      {/* Grid de Cursos */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
        {cursos.map((curso) => (
          <Card key={curso.id} className="group relative overflow-hidden bg-white border-slate-200">
            <div className="absolute top-0 left-0 w-full h-1.5 bg-blue-600 opacity-0 group-hover:opacity-100 transition-opacity" />
            
            <CardHeader className="pb-4">
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 font-black shadow-inner">
                    <BookOpen className="w-6 h-6" />
                  </div>
                  <div>
                    <CardTitle className="text-lg text-slate-900">{curso.nombre}</CardTitle>
                    <div className="flex gap-2 mt-2">
                      <Badge variant="secondary" className="font-bold">{curso.nivel || 'None'}</Badge>
                      <Badge className={`${curso.tipo_clase === 'tutoria' ? 'bg-purple-100 text-purple-800' : 'bg-green-100 text-green-800'} font-bold`}>
                        {curso.tipo_clase === 'tutoria' ? '1:1' : 'Grupal'}
                      </Badge>
                      {curso.grado_activo && curso.grado_nombre && (
                        <span
                          className="text-[11px] font-bold px-3 py-1 rounded-full border"
                          style={{
                            backgroundColor: (curso.grado_color || '#e5e7eb') + '33',
                            color: curso.grado_color || '#111827',
                            borderColor: (curso.grado_color || '#e5e7eb')
                          }}
                        >
                          {curso.grado_nombre}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleEdit(curso)}
                    className="h-9 w-9 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-100"
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="destructive"
                    size="icon"
                    onClick={() => handleDelete(curso.id)}
                    className="h-9 w-9 bg-red-600 hover:bg-red-700 text-white"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>

            {curso.descripcion && (
              <div className="px-8 mb-4">
                <p className="text-sm text-slate-600">{curso.descripcion}</p>
              </div>
            )}

            <div className="px-8 space-y-4 pb-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-slate-600">
                  <UsersIcon className="w-4 h-4 text-blue-500" />
                  <span className="text-sm font-semibold">
                    {curso.tipo_clase === 'tutoria' ? 'Sin límite' : `Máx: ${curso.max_estudiantes}`}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-slate-600">
                  <Clock className="w-4 h-4 text-blue-500" />
                  <span className="text-sm font-semibold">
                    {curso.dias_turno && typeof curso.dias_turno === 'object' 
                      ? Object.values(curso.dias_turno).join(', ') 
                      : 'N/A'}
                  </span>
                </div>
              </div>

              {/* Tutor Asignado */}
              {curso.tutor_id && (
                <div className="bg-indigo-50 p-3 rounded-lg border border-indigo-200">
                  <p className="text-xs text-indigo-700 font-bold uppercase mb-1">Tutor Asignado</p>
                  <p className="text-sm font-black text-indigo-900">
                    {tutores.find(t => t.id === curso.tutor_id)?.nombre || `Tutor #${curso.tutor_id}`}
                  </p>
                </div>
              )}

              {/* Costos */}
              <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-100">
                <div className="bg-green-50 p-3 rounded-lg border border-green-100">
                  <p className="text-xs text-green-700 font-semibold mb-1">Costo del Curso</p>
                  <p className="text-lg font-black text-green-900">₡{curso.costo_curso?.toLocaleString() || '0'}</p>
                </div>
                <div className="bg-blue-50 p-3 rounded-lg border border-blue-100">
                  <p className="text-xs text-blue-700 font-semibold mb-1">Pago a Tutores</p>
                  <p className="text-lg font-black text-blue-900">₡{curso.pago_tutor?.toLocaleString() || '0'}</p>
                </div>
              </div>

              {Array.isArray(curso.dias) && curso.dias.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {curso.dias.map((dia) => (
                    <span key={dia} className="text-xs bg-blue-50 text-blue-700 font-semibold px-2 py-1 rounded">
                      {dia.slice(0, 3)} - {curso.dias_turno?.[dia] || 'N/A'}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default Cursos;
