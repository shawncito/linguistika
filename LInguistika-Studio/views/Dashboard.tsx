import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';
import { Matricula, Curso, Tutor, Estudiante } from '../types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, Badge, Input, Button } from '../components/UI';
import { formatCRC } from '../lib/format';
import { 
  Users, BookOpen, GraduationCap, 
  ClipboardList, Clock, CreditCard,
  User as UserIcon, Calendar as CalendarIcon,
  TrendingUp, Award, ChevronRight, Activity, Star
} from 'lucide-react';

interface Stats {
  tutores_activos: number;
  estudiantes_activos: number;
  cursos_activos: number;
  matriculas_activas: number;
  total_clases: number;
  ingresos_pendientes: number;
}

interface SesionDelDia {
  matricula_id: number;
  curso_nombre: string;
  estudiante_nombre: string;
  tutor_nombre: string;
  hora_inicio: string;
  hora_fin: string;
  duracion_horas: number;
  turno: string;
}

const Dashboard: React.FC = () => {
  const [stats, setStats] = useState<Stats | null>(null);
  // Fecha de hoy usando zona horaria de Costa Rica
  const crToday = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Costa_Rica' });
  const [hoy, setHoy] = useState<string>(crToday);
  const [selectedDate, setSelectedDate] = useState<string>(crToday);
  const [sesionesDelDia, setSesionesDelDia] = useState<SesionDelDia[]>([]);
  const [sesionesHoy, setSesionesHoy] = useState<SesionDelDia[]>([]);
  const [loading, setLoading] = useState(true);

  // Función para obtener el día de la semana en español
  const getDiaSemana = (fecha: string): string => {
    const dias = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    const date = new Date(fecha + 'T00:00:00');
    return dias[date.getDay()];
  };

  // Función para calcular sesiones del día: primero intenta backend, luego fallback local
  // IMPORTANTE: Las sesiones SOLO salen de MATRÍCULAS ACTIVAS (estado=true)
  // Si un curso existe pero no tiene matrículas, NO aparecerá en la agenda
  const calcularSesionesDelDia = async (fecha: string, setSesiones: (sesiones: SesionDelDia[]) => void) => {
    try {
      // 1) Intentar obtener agenda desde backend (incluye fallback del servidor)
      const desdeServidor = await api.dashboard.getAgenda(fecha).catch(() => []);
      if (desdeServidor && desdeServidor.length > 0) {
        const sesiones = desdeServidor.map((c: any) => ({
          matricula_id: c.matricula_id ?? 0,
          curso_nombre: c.curso_nombre ?? 'Curso',
          estudiante_nombre: c.estudiante_nombre ?? 'Estudiante',
          tutor_nombre: c.tutor_nombre ?? 'Tutor',
          hora_inicio: c.hora_inicio ?? '—',
          hora_fin: c.hora_fin ?? '—',
          duracion_horas: c.duracion_horas ?? 0,
          turno: c.turno ?? '—',
        })) as SesionDelDia[];
        sesiones.sort((a, b) => String(a.hora_inicio).localeCompare(String(b.hora_inicio)));
        setSesiones(sesiones);
        return;
      }

      // 2) Fallback local desde matrículas y cursos
      // Calcular el día de la semana para la fecha seleccionada
      const diaSemana = getDiaSemana(fecha);
      // Obtener SOLO matrículas activas (estado = true)
      const matriculas = (await api.matriculas.getAll()).filter(m => !!m.estado);
      const cursosPromises = matriculas.map(m => api.cursos.getById(m.curso_id));
      const tutoresPromises = matriculas.map(m => api.tutores.getById(m.tutor_id));
      const estudiantesPromises = matriculas.map(m => api.estudiantes.getById(m.estudiante_id));
      const [cursos, tutores, estudiantes] = await Promise.all([
        Promise.all(cursosPromises),
        Promise.all(tutoresPromises),
        Promise.all(estudiantesPromises)
      ]);

      const sesiones: SesionDelDia[] = [];
      // Para cada matrícula activa, verificar si el curso tiene clase en el día solicitado
      matriculas.forEach((matricula, index) => {
        const curso = cursos[index];
        const tutor = tutores[index];
        const estudiante = estudiantes[index];
        // Verificar si el curso tiene horario definido (dias_schedule) para este día de la semana
        if (curso?.dias_schedule && (curso.dias_schedule as any)[diaSemana]) {
          const schedule = (curso.dias_schedule as any)[diaSemana];
          sesiones.push({
            matricula_id: matricula.id,
            curso_nombre: curso.nombre,
            estudiante_nombre: estudiante.nombre,
            tutor_nombre: tutor.nombre,
            hora_inicio: schedule.hora_inicio,
            hora_fin: schedule.hora_fin,
            duracion_horas: schedule.duracion_horas || 0,
            turno: schedule.turno
          });
        } else if (curso?.dias_turno && (curso.dias_turno as any)[diaSemana]) {
          const turno = (curso.dias_turno as any)[diaSemana];
          sesiones.push({
            matricula_id: matricula.id,
            curso_nombre: curso.nombre,
            estudiante_nombre: estudiante.nombre,
            tutor_nombre: tutor.nombre,
            hora_inicio: '—',
            hora_fin: '—',
            duracion_horas: 0,
            turno: turno
          });
        }
      });
      sesiones.sort((a, b) => String(a.hora_inicio).localeCompare(String(b.hora_inicio)));
      setSesiones(sesiones);
    } catch (error) {
      console.error('Error al calcular sesiones:', error);
      setSesiones([]);
    }
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const statsData = await api.dashboard.getStats().catch(() => ({
        tutores_activos: 0,
        estudiantes_activos: 0,
        cursos_activos: 0,
        matriculas_activas: 0,
        total_clases: 0,
        ingresos_pendientes: 0
      }));
      setStats(statsData);
      
      // Calcular sesiones de HOY (usando fecha Costa Rica)
      if (hoy) {
        await calcularSesionesDelDia(hoy, setSesionesHoy);
      }
      
      // Calcular sesiones del día seleccionado
      if (selectedDate) {
        await calcularSesionesDelDia(selectedDate, setSesionesDelDia);
      }
    } catch (err) {
      console.error('Error en dashboard:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedDate, hoy]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000); // Actualizar cada 30 segundos
    const onFocus = () => fetchData();
    window.addEventListener('focus', onFocus);
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
    };
  }, [fetchData]);

  const StatCard = ({ title, value, icon, accentColor }: any) => (
    <Card className="hover:translate-y-[-4px] transition-transform group cursor-default bg-white">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardDescription className="font-bold text-slate-500">{title}</CardDescription>
        <div className={`p-3 rounded-xl ${accentColor} shadow-sm group-hover:scale-110 transition-transform`}>
          {icon}
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-black text-slate-900 tracking-tight">{value}</div>
        <div className="mt-4 flex items-center text-xs font-bold text-slate-400 uppercase tracking-widest">
          <TrendingUp className="w-3 h-3 mr-2 text-emerald-500" />
          En tiempo real
        </div>
      </CardContent>
    </Card>
  );

  if (loading && !stats) return (
    <div className="flex flex-col items-center justify-center h-[50vh] space-y-6">
      <div className="w-12 h-12 border-4 border-slate-200 border-t-blue-600 rounded-full animate-spin" />
      <p className="text-sm font-semibold text-slate-500">Actualizando datos...</p>
    </div>
  );

  return (
    <div className="space-y-10">
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-8">
        <div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tight leading-none">
            Resumen General
          </h1>
          <p className="text-slate-500 text-sm mt-3 font-medium flex items-center gap-2">
            <Activity className="w-4 h-4 text-blue-600" />
            Estado actual de Linguistika Academy
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Button
            variant="primary"
            className="h-11 px-6 bg-blue-600 hover:bg-blue-700 text-white"
            onClick={fetchData}
            disabled={loading}
          >
            Actualizar Datos
          </Button>
          <div className="flex items-center gap-3 bg-gradient-to-r from-blue-50 to-blue-100 p-3 rounded-2xl border border-blue-200 shadow-sm">
            <div className="flex flex-col items-end px-2">
              <span className="text-xs font-black text-blue-700 uppercase tracking-widest">Estado</span>
              <span className="text-sm font-bold text-blue-900">OPERATIVO</span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-500 flex items-center justify-center text-white shadow-lg">
              <Star className="w-5 h-5 fill-current" />
            </div>
          </div>
        </div>
      </header>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-5">
        <StatCard 
          title="Tutores Activos" 
          value={stats?.tutores_activos || 0} 
          icon={<Users className="w-5 h-5 text-blue-600" />} 
          accentColor="bg-blue-50"
        />
        <StatCard 
          title="Estudiantes" 
          value={stats?.estudiantes_activos || 0} 
          icon={<GraduationCap className="w-5 h-5 text-indigo-600" />} 
          accentColor="bg-indigo-50"
        />
        <StatCard 
          title="Cursos" 
          value={stats?.cursos_activos || 0} 
          icon={<BookOpen className="w-5 h-5 text-emerald-600" />} 
          accentColor="bg-emerald-50"
        />
        <StatCard 
          title="Matrículas" 
          value={stats?.matriculas_activas || 0} 
          icon={<ClipboardList className="w-5 h-5 text-amber-600" />} 
          accentColor="bg-amber-50"
        />
        <StatCard 
          title="Sesiones Totales" 
          value={stats?.total_clases || 0} 
          icon={<Award className="w-5 h-5 text-rose-600" />} 
          accentColor="bg-rose-50"
        />
        <StatCard 
          title="Ingresos Pendientes" 
          value={formatCRC(stats?.ingresos_pendientes ?? 0)} 
          icon={<CreditCard className="w-5 h-5 text-slate-700" />} 
          accentColor="bg-slate-100"
        />
      </div>

      <div className="grid grid-cols-1 gap-10">
        {/* Sesiones de Hoy */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-3">
              <CalendarIcon className="w-6 h-6 text-emerald-600" />
              Sesiones de Hoy
            </h2>
            <div className="text-xs font-bold text-slate-500 uppercase tracking-widest">
              {hoy ? new Date(hoy + 'T00:00:00').toLocaleDateString('es-CR') : '—'}
            </div>
          </div>

          {sesionesHoy.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 bg-slate-50 rounded-xl border-2 border-dashed border-slate-200">
              <Clock className="w-12 h-12 mb-3 text-slate-300" />
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Sin sesiones hoy</p>
            </div>
          ) : (
            <div className="space-y-3">
              {sesionesHoy.map((sesion, index) => {
                const ahora = new Date();
                const [hIni, mIni] = String(sesion.hora_inicio).split(':').map(Number);
                const [hFin, mFin] = String(sesion.hora_fin).split(':').map(Number);
                const inicioDate = new Date(); inicioDate.setHours(hIni || 0, mIni || 0, 0, 0);
                const finDate = new Date(); finDate.setHours(hFin || 0, mFin || 0, 0, 0);
                const puedeMarcarDada = isFinite(hIni) && isFinite(mIni) && ahora >= finDate; // ya pasó fin
                const hoy = new Date().toISOString().split('T')[0];
                return (
                  <Card key={`hoy-${sesion.matricula_id}-${index}`} className="group border-slate-200 hover:border-emerald-300 hover:shadow-md transition-all bg-white">
                    <div className="p-6 flex items-center justify-between gap-4">
                      <div className="flex items-center gap-6 flex-1">
                        <div className="flex flex-col items-center justify-center w-24 h-24 rounded-2xl bg-gradient-to-br from-emerald-50 to-emerald-100 border border-emerald-200 group-hover:from-emerald-100 group-hover:to-emerald-200 transition-colors flex-shrink-0">
                          <span className="text-xs font-bold text-emerald-700 mb-1">{sesion.turno.toUpperCase()}</span>
                          <span className="text-base font-black text-emerald-900">{sesion.hora_inicio}</span>
                          <span className="text-xs text-emerald-700">a</span>
                          <span className="text-base font-black text-emerald-900">{sesion.hora_fin}</span>
                        </div>
                        <div className="flex-1">
                          <h4 className="text-lg font-bold text-slate-900 group-hover:text-emerald-600 transition-colors">
                            {sesion.curso_nombre}
                          </h4>
                          <div className="flex items-center gap-4 mt-2 text-sm">
                            <span className="flex items-center gap-2 font-semibold text-slate-600">
                              <UserIcon className="w-4 h-4 text-emerald-500" />
                              {sesion.estudiante_nombre}
                            </span>
                            <span className="text-slate-400">•</span>
                            <span className="text-slate-500 italic">Docente: {sesion.tutor_nombre}</span>
                            <span className="text-slate-400">•</span>
                            <span className="text-slate-500 font-semibold">{sesion.duracion_horas}h</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Button
                          variant="secondary"
                          className={`px-4 py-2 ${puedeMarcarDada ? 'bg-emerald-600 text-white hover:bg-emerald-700' : 'bg-slate-100 text-slate-500'}`}
                          disabled={!puedeMarcarDada}
                          onClick={async () => {
                            await api.dashboard.completarSesion(sesion.matricula_id, hoy);
                            await fetchData();
                          }}
                        >
                          Marcar Dada
                        </Button>
                        <Button
                          variant="destructive"
                          className="px-4 py-2 bg-rose-600 text-white hover:bg-rose-700"
                          onClick={async () => {
                            await api.dashboard.cancelarSesionDia(sesion.matricula_id, hoy);
                            await fetchData();
                          }}
                        >
                          Cancelar Hoy
                        </Button>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </section>

        {/* Agenda de Sesiones - Fecha Seleccionada */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-3">
              <CalendarIcon className="w-6 h-6 text-blue-600" />
              Agenda de Sesiones
            </h2>
            <Input 
              type="date" 
              value={selectedDate} 
              onChange={(e) => setSelectedDate(e.target.value)}
              className="h-11 w-44 font-bold"
            />
          </div>

          {sesionesDelDia.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 bg-slate-50 rounded-xl border-2 border-dashed border-slate-200">
              <Clock className="w-14 h-14 mb-3 text-slate-300" />
              <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Sin sesiones para esta fecha</p>
            </div>
          ) : (
            <div className="space-y-3">
              {sesionesDelDia.map((sesion, index) => (
                <Card key={index} className="group border-slate-200 hover:border-blue-300 hover:shadow-md transition-all bg-white">
                  <div className="p-6 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-6 flex-1">
                      <div className="flex flex-col items-center justify-center w-24 h-24 rounded-2xl bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 group-hover:from-blue-100 group-hover:to-blue-200 transition-colors flex-shrink-0">
                        <span className="text-xs font-bold text-blue-600 mb-1">{sesion.turno.toUpperCase()}</span>
                        <span className="text-base font-black text-blue-900">{sesion.hora_inicio}</span>
                        <span className="text-xs text-blue-600">a</span>
                        <span className="text-base font-black text-blue-900">{sesion.hora_fin}</span>
                      </div>
                      <div className="flex-1">
                        <h4 className="text-lg font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                          {sesion.curso_nombre}
                        </h4>
                        <div className="flex items-center gap-4 mt-2 text-sm">
                          <span className="flex items-center gap-2 font-semibold text-slate-600">
                            <UserIcon className="w-4 h-4 text-blue-500" />
                            {sesion.estudiante_nombre}
                          </span>
                          <span className="text-slate-400">•</span>
                          <span className="text-slate-500 italic">Docente: {sesion.tutor_nombre}</span>
                          <span className="text-slate-400">•</span>
                          <span className="text-slate-500 font-semibold">{sesion.duracion_horas}h</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge 
                        variant="secondary"
                        className="font-bold px-4 py-2 bg-emerald-100 text-emerald-700"
                      >
                        Programada
                      </Badge>
                      <Button
                        variant="destructive"
                        className="px-4 py-2 bg-red-600 text-white hover:bg-red-700"
                        onClick={async () => {
                          await api.dashboard.cancelarPermanente(sesion.matricula_id);
                          await fetchData();
                        }}
                      >
                        Cancelar para siempre
                      </Button>
                      <button className="p-3 rounded-xl bg-blue-50 text-blue-600 hover:bg-blue-100 transition-all border border-blue-100">
                        <ChevronRight className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default Dashboard;
