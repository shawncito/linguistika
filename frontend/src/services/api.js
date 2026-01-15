import axios from 'axios';

const API_URL = 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Servicios de Tutores
export const tutoresService = {
  getAll: () => api.get('/tutores'),
  getById: (id) => api.get(`/tutores/${id}`),
  create: (data) => api.post('/tutores', data),
  update: (id, data) => api.put(`/tutores/${id}`, data),
  delete: (id) => api.delete(`/tutores/${id}`)
};

// Servicios de Cursos
export const cursosService = {
  getAll: () => api.get('/cursos'),
  getById: (id) => api.get(`/cursos/${id}`),
  create: (data) => api.post('/cursos', data),
  update: (id, data) => api.put(`/cursos/${id}`, data),
  delete: (id) => api.delete(`/cursos/${id}`)
};

// Servicios de Estudiantes
export const estudiantesService = {
  getAll: () => api.get('/estudiantes'),
  getById: (id) => api.get(`/estudiantes/${id}`),
  create: (data) => api.post('/estudiantes', data),
  update: (id, data) => api.put(`/estudiantes/${id}`, data),
  delete: (id) => api.delete(`/estudiantes/${id}`)
};

// Servicios de Matrículas
export const matriculasService = {
  getAll: () => api.get('/matriculas'),
  getById: (id) => api.get(`/matriculas/${id}`),
  create: (data) => api.post('/matriculas', data),
  update: (id, data) => api.put(`/matriculas/${id}`, data),
  delete: (id) => api.delete(`/matriculas/${id}`)
};

// Servicios de Horarios
export const horariosService = {
  getByTutor: (tutor_id) => api.get(`/horarios/tutor/${tutor_id}`),
  create: (data) => api.post('/horarios', data),
  update: (id, data) => api.put(`/horarios/${id}`, data),
  delete: (id) => api.delete(`/horarios/${id}`),
  getClases: () => api.get('/horarios/clases/todas'),
  crearClase: (data) => api.post('/horarios/clases/crear', data)
};

// Servicios de Pagos
export const pagosService = {
  getAll: () => api.get('/pagos'),
  getByTutor: (tutor_id) => api.get(`/pagos/tutor/${tutor_id}`),
  create: (data) => api.post('/pagos', data),
  calcular: (data) => api.post('/pagos/calcular', data),
  update: (id, data) => api.put(`/pagos/${id}`, data)
};

// Servicios de Dashboard
export const dashboardService = {
  getTutoriasPorDia: (fecha) => api.get(`/dashboard/tutorías/${fecha}`),
  getResumenTutores: (fecha) => api.get(`/dashboard/resumen-tutores/${fecha}`),
  getEstadisticas: () => api.get('/dashboard/estadisticas/general')
};

export default api;
