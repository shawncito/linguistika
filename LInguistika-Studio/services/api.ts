// services/api.ts
// Shim: delega toda la logica a los servicios por feature en ./api/
// Las vistas siguen importando { api, auth } desde '../services/api' sin cambios.
export { API_BASE_URL } from './api/apiClient';

import { authService } from './api/authService';
import { activityService } from './api/activityService';
import { adminService } from './api/adminService';
import { bulkService } from './api/bulkService';
import { tutoresService } from './api/tutoresService';
import { cursosService } from './api/cursosService';
import { estudiantesService } from './api/estudiantesService';
import { matriculasService } from './api/matriculasService';
import { pagosService } from './api/pagosService';
import { tesoreriaService } from './api/tesoreriaService';
import { dashboardService } from './api/dashboardService';
import { horasTrabajoService } from './api/horasTrabajoService';
import { horariosService } from './api/horariosService';
import { finanzasService } from './api/finanzasService';

/** Objeto auth para manejo de token (compatibilidad hacia atras). */
export const auth = {
  getToken: () => authService.getToken(),
  setToken: (token: string) => authService.setToken(token),
  clear: () => authService.clear(),
};

/** Namespace global de la API (compatibilidad hacia atras). */
export const api = {
  auth:         authService,
  activity:     activityService,
  admin:        adminService,
  bulk:         bulkService,
  tutores:      tutoresService,
  cursos:       cursosService,
  estudiantes:  estudiantesService,
  matriculas:   matriculasService,
  pagos:        pagosService,
  tesoreria:    tesoreriaService,
  dashboard:    dashboardService,
  horasTrabajo: horasTrabajoService,
  horarios:     horariosService,
  finanzas:     finanzasService,
};