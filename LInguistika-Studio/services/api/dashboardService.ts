// services/api/dashboardService.ts
import { httpClient } from './apiClient';
import type { Stats, Clase, ResumenTutorEstudiantes, ResumenCursoGrupos } from '../../types';

export const dashboardService = {
  getStats: async (): Promise<Stats> => {
    const res = await httpClient.get('/dashboard/estadisticas/general');
    const d = res.data as any;
    return {
      tutores_activos: d.tutores ?? 0,
      estudiantes_activos: d.estudiantes ?? 0,
      cursos_activos: d.cursos ?? 0,
      matriculas_activas: d.matriculas ?? 0,
      total_clases: d.clases_totales ?? 0,
      ingresos_pendientes: d.ingresos_pendientes ?? 0,
    };
  },

  getAgenda: async (fecha: string): Promise<Clase[]> => {
    const res = await httpClient.get(`/dashboard/tutorias/${fecha}`);
    const data = res.data as any[];
    return data.map((c) => ({
      id: c.id,
      matricula_id: c.matricula_id ?? 0,
      fecha: c.fecha,
      hora_inicio: c.hora_inicio,
      hora_fin: c.hora_fin,
      estado: c.estado,
      notas: c.notas ?? '',
      created_at: c.created_at ?? '',
      avisado: typeof c.avisado === 'boolean' ? c.avisado : Boolean(c.avisado),
      confirmado: typeof c.confirmado === 'boolean' ? c.confirmado : Boolean(c.confirmado),
      motivo_cancelacion: c.motivo_cancelacion ?? null,
      turno: c.turno ?? null,
      duracion_horas: c.duracion_horas ?? null,
      tutor_id: c.tutor_id,
      estudiante_id: c.estudiante_id,
      estudiante_nombre: c.estudiante_nombre,
      tutor_nombre: c.tutor_nombre,
      curso_nombre: c.curso_nombre,
      curso_tipo_pago: c.curso_tipo_pago ?? c.tipo_pago ?? null,
      tarifa_por_hora: c.tarifa_por_hora,
    }));
  },

  getResumenTutores: async (fecha: string): Promise<any[]> => {
    const res = await httpClient.get(`/dashboard/resumen-tutores/${fecha}`);
    const data = res.data as any[];
    return data.map((t) => ({
      tutor_nombre: t.nombre,
      total_clases: t.total_clases,
      cursos: t.cursos,
      estudiantes: t.estudiantes,
    }));
  },

  getResumenTutoresEstudiantes: async (): Promise<ResumenTutorEstudiantes[]> => {
    const res = await httpClient.get('/dashboard/resumen-tutores-estudiantes');
    return res.data as ResumenTutorEstudiantes[];
  },

  getResumenCursosGrupos: async (): Promise<ResumenCursoGrupos[]> => {
    const res = await httpClient.get('/dashboard/resumen-cursos-grupos');
    return res.data as ResumenCursoGrupos[];
  },

  completarSesion: async (matriculaId: number, fecha: string): Promise<any> => {
    const res = await httpClient.post(`/dashboard/sesion/${matriculaId}/${fecha}/completar`);
    return res.data as any;
  },

  cancelarSesionDia: async (
    matriculaId: number,
    fecha: string,
    motivo?: string
  ): Promise<any> => {
    const res = await httpClient.post(
      `/dashboard/sesion/${matriculaId}/${fecha}/cancelar-dia`,
      { motivo_cancelacion: motivo || null }
    );
    return res.data as any;
  },

  actualizarEstadoSesion: async (
    matriculaId: number,
    fecha: string,
    datos: { avisado?: boolean; confirmado?: boolean; motivo_cancelacion?: string }
  ): Promise<any> => {
    const res = await httpClient.patch(
      `/dashboard/sesion/${matriculaId}/${fecha}/estado`,
      datos
    );
    return res.data as any;
  },

  obtenerEstadosClasesRango: async (params: {
    fecha_inicio: string;
    fecha_fin: string;
  }): Promise<any[]> => {
    const res = await httpClient.get<any[]>('/dashboard/estados-clases-rango', { params });
    return res.data as any[];
  },

  getMetricas: async (params?: { mes?: string; tutor_id?: number }): Promise<any> => {
    const res = await httpClient.get('/dashboard/metricas', { params });
    return res.data as any;
  },

  getTutorNotas: async (tutorId: number, params?: { history_limit?: number }): Promise<{ notas: any[]; historial: any[] }> => {
    const res = await httpClient.get(`/dashboard/tutores/${tutorId}/notas`, { params });
    const data = res.data as any;
    return {
      notas: Array.isArray(data?.notas) ? data.notas : [],
      historial: Array.isArray(data?.historial) ? data.historial : [],
    };
  },

  createTutorNota: async (tutorId: number, payload: { mensaje: string }): Promise<any> => {
    const res = await httpClient.post(`/dashboard/tutores/${tutorId}/notas`, payload);
    return res.data as any;
  },

  updateTutorNota: async (tutorId: number, notaId: number, payload: { mensaje: string }): Promise<any> => {
    const res = await httpClient.patch(`/dashboard/tutores/${tutorId}/notas/${notaId}`, payload);
    return res.data as any;
  },

  setTutorNotaEstado: async (tutorId: number, notaId: number, payload: { estado: 'pendiente' | 'hecha' }): Promise<any> => {
    const res = await httpClient.patch(`/dashboard/tutores/${tutorId}/notas/${notaId}/estado`, payload);
    return res.data as any;
  },

  deleteTutorNota: async (tutorId: number, notaId: number): Promise<any> => {
    const res = await httpClient.delete(`/dashboard/tutores/${tutorId}/notas/${notaId}`);
    return res.data as any;
  },
};
