import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { Estudiante } from '../types';
import { Button, Card, CardHeader, CardTitle, CardDescription, Input, Label, Select, Badge } from '../components/UI';
import { Plus, Edit, Trash2, Mail, Phone, Calendar, User, X } from 'lucide-react';

const GRADOS = ['1ro', '2do', '3ro', '4to', '5to', '6to', '7mo', '8vo', '9no', '10mo', '11mo'];
const DIAS_SEMANA = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
const TURNOS = ['Tarde', 'Noche'];

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

  const loadData = async () => {
    setLoading(true);
    const data = await api.estudiantes.getAll();
    setEstudiantes(data);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const validateEmail = (email: string): boolean => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const validatePhone = (phone: string): boolean => {
    const phoneRegex = /^(\+506\s?)?\d{4}-\d{4}$/;
    return phoneRegex.test(phone.trim());
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
      newErrors.telefono_encargado = 'Formato: +506 8888-8888';
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
      setErrors({ submit: 'Error al guardar estudiante' });
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

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-[50vh]">
      <div className="w-10 h-10 border-4 border-slate-200 border-t-blue-600 rounded-full animate-spin mb-4" />
      <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Cargando alumnado...</p>
    </div>
  );

  return (
    <div className="space-y-10">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-slate-200 pb-8">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Alumnado</h1>
          <p className="text-slate-500 font-medium mt-2">Registro de estudiantes matriculados</p>
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
          Nuevo Estudiante
        </Button>
      </header>

      {/* Modal de Formulario */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white">
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
              <div className="p-6 bg-blue-50 border-2 border-blue-200 rounded-lg">
                <p className="text-sm font-black text-blue-900 mb-4 uppercase tracking-wide">👨‍👩‍👧 Datos del Encargado</p>
                
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
                          <div key={dia} className="p-3 border-2 border-green-200 rounded-lg">
                            <p className="text-xs font-bold text-green-800 mb-2">{dia.slice(0,3)}</p>
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
                                  <span className="text-xs font-semibold text-green-900">{t}</span>
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
                  className="px-8 bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {editingId ? 'Actualizar' : 'Registrar'}
                </Button>
              </div>
              {errors.submit && <p className="text-red-500 text-sm">{errors.submit}</p>}
            </form>
          </Card>
        </div>
      )}

      {/* Grid de Estudiantes */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
        {estudiantes.map((est) => (
          <Card key={est.id} className="group relative overflow-hidden bg-white border-slate-200">
            <div className="absolute top-0 left-0 w-full h-1.5 bg-blue-600 opacity-0 group-hover:opacity-100 transition-opacity" />
            
            <CardHeader className="pb-4">
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 font-black shadow-inner">
                    {est.nombre.charAt(0)}
                  </div>
                  <div>
                    <CardTitle className="text-lg text-slate-900">{est.nombre}</CardTitle>
                    <Badge variant="secondary" className="mt-2 font-bold">{est.grado || 'N/A'}</Badge>
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleEdit(est)}
                    className="h-9 w-9 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-100"
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="destructive"
                    size="icon"
                    onClick={() => handleDelete(est.id)}
                    className="h-9 w-9 bg-red-600 hover:bg-red-700 text-white"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>

            <div className="px-8 space-y-3 pb-6">
              {est.email && (
                <div className="flex items-center gap-3 text-sm">
                  <Mail className="w-4 h-4 text-blue-500" />
                  <span className="text-slate-600 truncate">{est.email}</span>
                </div>
              )}
              
              {est.email_encargado && (
                <div className="flex items-center gap-3 text-sm">
                  <User className="w-4 h-4 text-green-500" />
                  <span className="text-slate-600 truncate text-xs">{est.email_encargado}</span>
                </div>
              )}
              
              {est.telefono_encargado && (
                <div className="flex items-center gap-3 text-sm">
                  <Phone className="w-4 h-4 text-green-500" />
                  <span className="text-slate-600">{est.telefono_encargado}</span>
                </div>
              )}

              {Array.isArray(est.dias) && est.dias.length > 0 && (
                <div className="flex flex-wrap gap-1 pt-2 border-t border-slate-100">
                  {est.dias.map((dia) => (
                    <span key={dia} className="text-xs bg-green-50 text-green-700 font-semibold px-2 py-1 rounded">
                      {dia.slice(0, 3)}{(est as any).dias_turno && (est as any).dias_turno[dia] ? ` • ${(est as any).dias_turno[dia]}` : ''}
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

export default Estudiantes;
