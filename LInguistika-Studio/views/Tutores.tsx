import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { Tutor } from '../types';
import { formatCRC } from '../lib/format';
import { 
  Button, Card, CardHeader, CardTitle, CardDescription,
  Badge, Input, Label, Select
} from '../components/UI';
import { Plus, Edit, Trash2, Mail, Phone, Briefcase, Star, MoreVertical, Search, ChevronDown } from 'lucide-react';

const DIAS_SEMANA = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
const ESPECIALIDADES = ['Inglés', 'Francés', 'Alemán', 'Portugués', 'Chino', 'Japonés', 'Español'];

const NIVELES = ['A1','A2','B1','B2','C1','C2'];

const Tutores: React.FC = () => {
  const [tutores, setTutores] = useState<Tutor[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    nombre: '',
    email: '',
    telefono: '',
    especialidad: 'Inglés',
    horario_tipo: 'personalizado',
    dias: [] as string[],
    dias_turno: {} as Record<string, 'Tarde' | 'Noche'>,
    dias_horarios: {} as Record<string, { hora_inicio: string; hora_fin: string }>,
    es_especializado: false,
    niveles_apto: [] as string[]
  });
  const [customHoras, setCustomHoras] = useState({ hora_inicio: '', hora_fin: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const loadData = async () => {
    setLoading(true);
    const data = await api.tutores.getAll();
    setTutores(data);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  // Validación de teléfono (formato: +506 XXXX-XXXX o 8888-8888)
  const validatePhone = (phone: string): boolean => {
    const phoneRegex = /^(\+506\s?)?\d{4}-\d{4}$/;
    return phoneRegex.test(phone.trim());
  };

  const handlePhoneChange = (value: string) => {
    setFormData(prev => ({ ...prev, telefono: value }));
    if (value && !validatePhone(value)) {
      setErrors(prev => ({ ...prev, telefono: 'Formato: +506 8888-8888 o 8888-8888' }));
    } else {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors.telefono;
        return newErrors;
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};

    if (!formData.nombre.trim()) newErrors.nombre = 'Nombre requerido';
    if (!formData.especialidad) newErrors.especialidad = 'Especialidad requerida';
    if (formData.telefono && !validatePhone(formData.telefono)) {
      newErrors.telefono = 'Teléfono inválido';
    }
    if (formData.dias.length === 0) newErrors.dias = 'Selecciona al menos un día';
    
    // Validar que todos los días tengan horas
    for (const dia of formData.dias) {
      if (!formData.dias_horarios[dia] || !formData.dias_horarios[dia].hora_inicio || !formData.dias_horarios[dia].hora_fin) {
        newErrors.dias_horarios = 'Especifica hora de inicio y fin para cada día';
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
        especialidad: formData.especialidad,
        horario_tipo: 'personalizado',
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
      setErrors({ submit: 'Error al guardar tutor' });
    }
  };

  const resetForm = () => {
    setEditingId(null);
    setFormData({
      nombre: '',
      email: '',
      telefono: '',
      especialidad: 'Inglés',
      horario_tipo: 'personalizado',
      dias: [],
      dias_turno: {},
      dias_horarios: {},
      es_especializado: false,
      niveles_apto: []
    });
    setCustomHoras({ hora_inicio: '', hora_fin: '' });
    setErrors({});
  };

  const handleEdit = (tutor: Tutor) => {
    setEditingId(tutor.id);
    setFormData({
      nombre: tutor.nombre,
      email: tutor.email || '',
      telefono: tutor.telefono || '',
      especialidad: tutor.especialidad,
      horario_tipo: 'personalizado',
      dias: Object.keys(tutor.dias_horarios || {}),
      dias_turno: {},
      dias_horarios: tutor.dias_horarios || {},
      es_especializado: !!tutor.es_especializado,
      niveles_apto: (tutor.niveles_apto as any) || []
    });
    setShowModal(true);
  };

  const handleDelete = async (id: number) => {
    if (window.confirm('¿Estás seguro de eliminar este tutor?')) {
      await api.tutores.delete(id);
      loadData();
    }
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-[50vh]">
      <div className="w-10 h-10 border-4 border-slate-200 border-t-blue-600 rounded-full animate-spin mb-4" />
      <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Cargando docentes...</p>
    </div>
  );

  return (
    <div className="space-y-10">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-slate-200 pb-8">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Especialistas Docentes</h1>
          <p className="text-slate-500 font-medium mt-2">Gestión de profesorado y honorarios</p>
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
          Nuevo Docente
        </Button>
      </header>

      {/* Modal de Formulario */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white">
            <CardHeader className="border-b border-slate-200 flex justify-between items-start">
              <div>
                <CardTitle>{editingId ? 'Editar Docente' : 'Nuevo Docente'}</CardTitle>
                <CardDescription>Completa los datos del especialista</CardDescription>
              </div>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </CardHeader>

            <form onSubmit={handleSubmit} className="p-8 space-y-6">
              {/* Especialización */}
              <div className="p-4 border border-slate-200 rounded-lg bg-slate-50">
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
                        <label key={n} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 bg-white cursor-pointer">
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
              {/* Nombre */}
              <div>
                <Label>Nombre *</Label>
                <Input
                  value={formData.nombre}
                  onChange={(e) => setFormData(prev => ({ ...prev, nombre: e.target.value }))}
                  placeholder="Ej: María García"
                  className={errors.nombre ? 'border-red-500' : ''}
                />
                {errors.nombre && <p className="text-red-500 text-sm mt-1">{errors.nombre}</p>}
              </div>

              {/* Email y Teléfono */}
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
                  <Label>Teléfono *</Label>
                  <Input
                    value={formData.telefono}
                    onChange={(e) => handlePhoneChange(e.target.value)}
                    placeholder="+506 8888-8888"
                    className={errors.telefono ? 'border-red-500' : ''}
                  />
                  {errors.telefono && <p className="text-red-500 text-sm mt-1">{errors.telefono}</p>}
                </div>
              </div>

              {/* Especialidad */}
              <div>
                <Label>Especialidad *</Label>
                <Select value={formData.especialidad} onChange={(e) => setFormData(prev => ({ ...prev, especialidad: e.target.value }))}>
                  {ESPECIALIDADES.map(esp => (
                    <option key={esp} value={esp}>{esp}</option>
                  ))}
                </Select>
                {errors.especialidad && <p className="text-red-500 text-sm mt-1">{errors.especialidad}</p>}
              </div>

              {/* Horario - Días */}
              <div>
                <Label>Días Hábiles *</Label>
                <div className="grid grid-cols-4 gap-2 mt-2">
                  {DIAS_SEMANA.map(dia => (
                    <label key={dia} className="flex items-center gap-2 p-3 border border-slate-200 rounded-lg hover:bg-blue-50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.dias.includes(dia)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setFormData(prev => ({ ...prev, dias: [...prev.dias, dia] }));
                          } else {
                            setFormData(prev => ({ ...prev, dias: prev.dias.filter(d => d !== dia) }));
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

              {/* Horario - Horas específicas por Día */}
              {formData.dias.length > 0 && (
                <div>
                  <Label>Horas por Día *</Label>
                  <div className="space-y-4 mt-3">
                    {formData.dias.map(dia => (
                      <div key={dia} className="p-4 border border-slate-200 rounded-lg bg-slate-50">
                        <p className="text-sm font-semibold text-slate-900 mb-3">{dia}</p>
                        <div className="flex gap-4">
                          <div className="flex-1">
                            <Label className="text-xs">Inicio</Label>
                            <Input
                              type="time"
                              value={formData.dias_horarios[dia]?.hora_inicio || ''}
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
                              value={formData.dias_horarios[dia]?.hora_fin || ''}
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

      {/* Tarjetas de Tutores */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
        {tutores.map((tutor) => (
          <Card key={tutor.id} className="group relative overflow-hidden bg-white border-slate-200">
            <div className="absolute top-0 left-0 w-full h-1.5 bg-blue-600 opacity-0 group-hover:opacity-100 transition-opacity" />
            
            <CardHeader className="pb-6">
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-5">
                  <div className="w-14 h-14 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 font-black text-xl shadow-inner">
                    {tutor.nombre.charAt(0)}
                  </div>
                  <div>
                    <CardTitle className="text-lg text-slate-900">{tutor.nombre}</CardTitle>
                    <Badge variant="secondary" className="mt-1 font-bold">{tutor.especialidad}</Badge>
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleEdit(tutor)}
                    className="h-9 w-9 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-100"
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="destructive"
                    size="icon"
                    onClick={() => handleDelete(tutor.id)}
                    className="h-9 w-9 bg-red-600 hover:bg-red-700 text-white"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>

            <div className="px-8 space-y-4 pb-8">
              <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-100 shadow-inner">
                <p className="text-[10px] font-bold text-emerald-600 uppercase mb-1">Estado</p>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-lg shadow-emerald-200" />
                  <span className="text-xs font-black text-emerald-700">Activo</span>
                </div>
              </div>
              
              {tutor.email && (
                <div className="flex items-center gap-3 text-sm">
                  <Mail className="w-4 h-4 text-slate-400" />
                  <p className="text-slate-600 font-medium truncate">{tutor.email}</p>
                </div>
              )}
              
              {tutor.telefono && (
                <div className="flex items-center gap-3 text-sm">
                  <Phone className="w-4 h-4 text-slate-400" />
                  <p className="text-slate-600 font-medium">{tutor.telefono}</p>
                </div>
              )}
              
              {tutor.dias_horarios && Object.keys(tutor.dias_horarios).length > 0 && (
                <div className="mt-4 pt-4 border-t border-slate-200">
                  <p className="text-xs font-bold text-slate-400 uppercase mb-2">Horario</p>
                  <div className="space-y-2">
                    {Object.entries(tutor.dias_horarios).map(([dia, horario]: [string, any]) => (
                      <div key={dia} className="text-xs bg-blue-50 text-blue-700 px-3 py-2 rounded-lg border border-blue-200 font-semibold flex justify-between">
                        <span>{dia.slice(0, 3)}</span>
                        <span>{horario.hora_inicio} - {horario.hora_fin}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {(tutor.es_especializado || (tutor.niveles_apto && (tutor.niveles_apto as any[]).length > 0)) && (
                <div className="mt-4 pt-4 border-t border-slate-200">
                  <p className="text-xs font-bold text-slate-400 uppercase mb-2">Especialización</p>
                  <div className="flex items-center gap-2 flex-wrap">
                    {tutor.es_especializado && (
                      <Badge variant="success">Especializado</Badge>
                    )}
                    {Array.isArray(tutor.niveles_apto) && tutor.niveles_apto.map((n) => (
                      <span key={n} className="text-xs bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full border border-emerald-200 font-semibold">
                        Nivel {n}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default Tutores;
