import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { Matricula, Tutor, Curso, Estudiante } from '../types';
import { Button, Card, Select, Label, Badge, Input } from '../components/UI';
import { Plus, Edit, XCircle, AlertCircle, Calendar, User, BookOpen, GraduationCap, CheckCircle, AlertTriangle, X } from 'lucide-react';

const DIAS_SEMANA = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

const Matriculas: React.FC = () => {
  const [matriculas, setMatriculas] = useState<Matricula[]>([]);
  const [estudiantes, setEstudiantes] = useState<Estudiante[]>([]);
  const [cursos, setCursos] = useState<Curso[]>([]);
  const [tutores, setTutores] = useState<Tutor[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [compatibilityStatus, setCompatibilityStatus] = useState<{
    compatible: boolean;
    issues: string[];
  }>({ compatible: true, issues: [] });
  const [formData, setFormData] = useState({
    estudiante_id: 0,
    curso_id: 0,
    tutor_id: 0
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

  // Función para verificar compatibilidad de horarios
  const checkCompatibility = (estudianteId: number, cursoId: number, tutorId: number) => {
    const issues: string[] = [];
    let compatible = true;

    if (!estudianteId || !cursoId || !tutorId) {
      setCompatibilityStatus({ compatible: false, issues: ['Selecciona todos los campos'] });
      return;
    }

    const estudiante = estudiantes.find(e => e.id === estudianteId);
    const curso = cursos.find(c => c.id === cursoId);
    const tutor = tutores.find(t => t.id === tutorId);

    if (!estudiante || !curso || !tutor) {
      setCompatibilityStatus({ compatible: false, issues: ['Datos no encontrados'] });
      return;
    }

    // Verificar días del estudiante
    if (Array.isArray(estudiante.dias) && estudiante.dias.length > 0) {
      const diasEstudiante = estudiante.dias;
      
      // Verificar días del curso
      if (Array.isArray(curso.dias) && curso.dias.length > 0) {
        const diasCurso = curso.dias;
        const diasComunes = diasEstudiante.filter(d => diasCurso.includes(d));
        if (diasComunes.length === 0) {
          compatible = false;
          issues.push('❌ Horarios de estudiante y curso no coinciden');
        }
      }

      // Verificar días del tutor
      if (Array.isArray(tutor.dias) && tutor.dias.length > 0) {
        const diasTutor = tutor.dias;
        const diasComunes = diasEstudiante.filter(d => diasTutor.includes(d));
        if (diasComunes.length === 0) {
          compatible = false;
          issues.push('❌ Horarios de estudiante y tutor no coinciden');
        }
      }
    }

    // Verificar que los tres compartan al menos un día
    if (Array.isArray(estudiante.dias) && Array.isArray(curso.dias) && Array.isArray(tutor.dias)) {
      if (estudiante.dias.length > 0 && curso.dias.length > 0 && tutor.dias.length > 0) {
        const diasComunes = estudiante.dias.filter(d => 
          curso.dias.includes(d) && tutor.dias.includes(d)
        );
        if (diasComunes.length === 0) {
          compatible = false;
          issues.push('⚠️ No hay días hábiles compartidos entre los tres');
        }
      }
    }

    if (compatible && issues.length === 0) {
      issues.push('✅ Horarios compatibles');
    }

    setCompatibilityStatus({ compatible, issues });
  };

  const handleSelectChange = (field: string, value: any) => {
    const newFormData = { ...formData, [field]: parseInt(value) };
    setFormData(newFormData);
    
    if (field === 'estudiante_id' || field === 'curso_id' || field === 'tutor_id') {
      checkCompatibility(newFormData.estudiante_id, newFormData.curso_id, newFormData.tutor_id);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.estudiante_id || !formData.curso_id || !formData.tutor_id) {
      return alert('Selecciona todos los campos obligatorios.');
    }

    try {
      if (editingId) {
        await api.matriculas.update(editingId, formData);
      } else {
        await api.matriculas.create(formData);
      }
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
      tutor_id: matricula.tutor_id
    });
    setShowModal(true);
    checkCompatibility(matricula.estudiante_id, matricula.curso_id, matricula.tutor_id);
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
    setFormData({ estudiante_id: 0, curso_id: 0, tutor_id: 0 });
    setCompatibilityStatus({ compatible: true, issues: [] });
    setShowModal(false);
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-[50vh]">
      <div className="w-10 h-10 border-4 border-slate-200 border-t-blue-600 rounded-full animate-spin mb-4" />
      <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Cargando matrículas...</p>
    </div>
  );

  return (
    <div className="space-y-10">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-slate-200 pb-8">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Expediente de Matrículas</h1>
          <p className="text-slate-500 font-medium mt-2">Vínculos entre alumnos, cursos y docentes</p>
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
      </header>

      {/* Tabla de Matrículas */}
      <div className="overflow-x-auto bg-white rounded-lg border border-slate-200">
        <table className="w-full">
          <thead>
            <tr className="bg-slate-50/50 border-b border-slate-200">
              <th className="px-8 py-4 text-left text-xs font-black text-slate-700 uppercase tracking-wide">Estudiante</th>
              <th className="px-8 py-4 text-left text-xs font-black text-slate-700 uppercase tracking-wide">Curso</th>
              <th className="px-8 py-4 text-left text-xs font-black text-slate-700 uppercase tracking-wide">Tutor</th>
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
              {/* Campos de Selección */}
              <div className="space-y-6">
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

                <div>
                  <Label>Asignar Tutor *</Label>
                  <Select 
                    value={formData.tutor_id} 
                    onChange={(e) => handleSelectChange('tutor_id', e.target.value)}
                    className="mt-2"
                  >
                    <option value={0}>Elegir tutor...</option>
                    {tutores.map(t => (
                      <option key={t.id} value={t.id}>
                        {t.nombre} - {t.especialidad}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>

              {/* Estado de Compatibilidad */}
              {(formData.estudiante_id && formData.curso_id && formData.tutor_id) && (
                <div className={`p-5 rounded-lg border-2 ${
                  compatibilityStatus.compatible 
                    ? 'bg-green-50 border-green-200' 
                    : 'bg-amber-50 border-amber-200'
                }`}>
                  <div className="flex items-start gap-3">
                    {compatibilityStatus.compatible ? (
                      <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                    ) : (
                      <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                    )}
                    <div>
                      {compatibilityStatus.issues.map((issue, idx) => (
                        <p key={idx} className={`text-sm font-semibold ${
                          compatibilityStatus.compatible ? 'text-green-700' : 'text-amber-700'
                        }`}>
                          {issue}
                        </p>
                      ))}
                    </div>
                  </div>
                </div>
              )}

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
                  disabled={!formData.estudiante_id || !formData.curso_id || !formData.tutor_id}
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
