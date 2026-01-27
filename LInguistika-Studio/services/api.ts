import axios from 'axios';
import {
  Tutor,
  Curso,
  Estudiante,
  Matricula,
  Pago,
  Stats,
  EstadoPago,
  Clase,
  HorasTrabajo,
  ResumenTutorEstudiantes,
  ResumenCursoGrupos,
} from '../types';

const TOKEN_KEY = 'linguistika_token';

export const auth = {
  getToken: () => localStorage.getItem(TOKEN_KEY),
  setToken: (token: string) => localStorage.setItem(TOKEN_KEY, token),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

const http = axios.create({
  baseURL: 'http://localhost:5000/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

http.interceptors.request.use((config) => {
  const token = auth.getToken();
  if (token) {
    config.headers = (config.headers ?? {}) as any;
    (config.headers as any).Authorization = `Bearer ${token}`;
  }
  return config;
});

http.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err?.response?.status === 401) {
      auth.clear();
      if (window.location.hash !== '#/login') {
        window.location.hash = '#/login';
      }
    }
    return Promise.reject(err);
  }
);

export const api = {
  auth: {
    login: async (email: string, password: string): Promise<{ token: string; user: any }> => {
      const res = await http.post('/auth/login', { email, password });
      return res.data as any;
    },
    me: async (): Promise<{ user: any }> => {
      const res = await http.get('/auth/me');
      return res.data as any;
    },
  },
  tutores: {
    getAll: async (): Promise<Tutor[]> => {
      const res = await http.get<Tutor[]>('/tutores');
      return res.data;
    },
    getById: async (id: number): Promise<Tutor | undefined> => {
      const res = await http.get<Tutor>(`/tutores/${id}`);
      return res.data;
    },
    create: async (data: Partial<Tutor>): Promise<Tutor> => {
      const res = await http.post<Tutor>('/tutores', data);
      return res.data;
    },
    update: async (id: number, data: Partial<Tutor>): Promise<Tutor> => {
      const res = await http.put<Tutor>(`/tutores/${id}`, data);
      return res.data;
    },
    delete: async (id: number): Promise<void> => {
      await http.delete(`/tutores/${id}`);
    },
  },

  cursos: {
    getAll: async (): Promise<Curso[]> => {
      const res = await http.get<Curso[]>('/cursos');
      return res.data;
    },
    getById: async (id: number): Promise<Curso | undefined> => {
      const res = await http.get<Curso>(`/cursos/${id}`);
      return res.data;
    },
    create: async (data: Partial<Curso>): Promise<Curso> => {
      const res = await http.post<Curso>('/cursos', data);
      return res.data;
    },
    update: async (id: number, data: Partial<Curso>): Promise<Curso> => {
      const res = await http.put<Curso>(`/cursos/${id}`, data);
      return res.data;
    },
    delete: async (id: number): Promise<void> => {
      await http.delete(`/cursos/${id}`);
    },
  },

  estudiantes: {
    getAll: async (): Promise<Estudiante[]> => {
      const res = await http.get<Estudiante[]>('/estudiantes');
      return res.data;
    },
    getById: async (id: number): Promise<Estudiante | undefined> => {
      const res = await http.get<Estudiante>(`/estudiantes/${id}`);
      return res.data;
    },
    create: async (data: Partial<Estudiante>): Promise<Estudiante> => {
      const res = await http.post<Estudiante>('/estudiantes', data);
      return res.data;
    },
    update: async (id: number, data: Partial<Estudiante>): Promise<Estudiante> => {
      const res = await http.put<Estudiante>(`/estudiantes/${id}`, data);
      return res.data;
    },
    delete: async (id: number): Promise<void> => {
      await http.delete(`/estudiantes/${id}`);
    },
  },

  matriculas: {
    getAll: async (): Promise<Matricula[]> => {
      const res = await http.get<Matricula[]>('/matriculas');
      return res.data;
    },
    create: async (data: Partial<Matricula>): Promise<Matricula> => {
      const res = await http.post<Matricula>('/matriculas', data);
      return res.data;
    },
    update: async (id: number, data: Partial<Matricula>): Promise<Matricula> => {
      const res = await http.put<Matricula>(`/matriculas/${id}`, data);
      return res.data;
    },
    delete: async (id: number): Promise<void> => {
      await http.delete(`/matriculas/${id}`);
    },
    validateTutorCourse: async (tutor_id: number, curso_id: number): Promise<{ compatible: boolean; issues: string[] }> => {
      const res = await http.get<{ compatible: boolean; issues: string[] }>(`/matriculas/validate/tutor-course/${tutor_id}/${curso_id}`);
      return res.data;
    },
  },

  pagos: {
    getAll: async (): Promise<Pago[]> => {
      const res = await http.get<Pago[]>('/pagos');
      return res.data;
    },
    create: async (data: Partial<Pago>): Promise<Pago> => {
      const res = await http.post<Pago>('/pagos', data);
      return res.data;
    },
  },

  dashboard: {
    getStats: async (): Promise<Stats> => {
      const res = await http.get('/dashboard/estadisticas/general');
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
      // Usar ruta ASCII sin acento para máxima compatibilidad
      const res = await http.get(`/dashboard/tutorias/${fecha}`);
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
        tutor_id: c.tutor_id,
        estudiante_id: c.estudiante_id,
        estudiante_nombre: c.estudiante_nombre,
        tutor_nombre: c.tutor_nombre,
        curso_nombre: c.curso_nombre,
        tarifa_por_hora: c.tarifa_por_hora,
      }));
    },
    getResumenTutores: async (fecha: string): Promise<any[]> => {
      const res = await http.get(`/dashboard/resumen-tutores/${fecha}`);
      const data = res.data as any[];
      return data.map((t) => ({
        tutor_nombre: t.nombre,
        total_clases: t.total_clases,
        cursos: t.cursos,
        estudiantes: t.estudiantes,
      }));
    },
    getResumenTutoresEstudiantes: async (): Promise<ResumenTutorEstudiantes[]> => {
      const res = await http.get('/dashboard/resumen-tutores-estudiantes');
      return res.data as ResumenTutorEstudiantes[];
    },
    getResumenCursosGrupos: async (): Promise<ResumenCursoGrupos[]> => {
      const res = await http.get('/dashboard/resumen-cursos-grupos');
      return res.data as ResumenCursoGrupos[];
    },
    completarSesion: async (matriculaId: number, fecha: string): Promise<any> => {
      const res = await http.post(`/dashboard/sesion/${matriculaId}/${fecha}/completar`);
      return res.data as any;
    },
    cancelarSesionDia: async (matriculaId: number, fecha: string): Promise<any> => {
      const res = await http.post(`/dashboard/sesion/${matriculaId}/${fecha}/cancelar-dia`);
      return res.data as any;
    },
    cancelarPermanente: async (matriculaId: number): Promise<any> => {
      const res = await http.post(`/dashboard/sesion/${matriculaId}/cancelar-permanente`);
      return res.data as any;
    },
    actualizarEstadoSesion: async (matriculaId: number, fecha: string, datos: { avisado?: boolean; confirmado?: boolean; motivo_cancelacion?: string }): Promise<any> => {
      const res = await http.patch(`/dashboard/sesion/${matriculaId}/${fecha}/estado`, datos);
      return res.data as any;
    },
    obtenerEstadosClases: async (fecha: string): Promise<any[]> => {
      const res = await http.get<any[]>(`/dashboard/estados-clases/${fecha}`);
      return res.data as any[];
    },
  },

  horasTrabajo: {
    getAll: async (params?: { fecha?: string; tutor_id?: number; estado?: string }): Promise<HorasTrabajo[]> => {
      const res = await http.get<HorasTrabajo[]>('/horas-trabajo', { params });
      return res.data;
    },
    create: async (data: Partial<HorasTrabajo> & { tutor_id: number; fecha: string; horas: number; clase_id?: number | null; notas?: string | null }): Promise<HorasTrabajo> => {
      const res = await http.post<HorasTrabajo>('/horas-trabajo', data);
      return res.data;
    },
    update: async (id: number, data: Partial<HorasTrabajo>): Promise<HorasTrabajo> => {
      const res = await http.put<HorasTrabajo>(`/horas-trabajo/${id}`, data);
      return res.data;
    },
    aprobar: async (id: number): Promise<{ horas_trabajo: HorasTrabajo; pago_creado: boolean }> => {
      const res = await http.post(`/horas-trabajo/${id}/aprobar`);
      return res.data as any;
    },
  },
};
