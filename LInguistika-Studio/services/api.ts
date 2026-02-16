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
let memoryToken: string | null = null;

function safeGetItem(storage: Storage | null, key: string): string | null {
  try {
    if (!storage) return null;
    return storage.getItem(key);
  } catch {
    return null;
  }
}

function safeSetItem(storage: Storage | null, key: string, value: string): void {
  try {
    if (!storage) return;
    storage.setItem(key, value);
  } catch {
    // ignore
  }
}

function safeRemoveItem(storage: Storage | null, key: string): void {
  try {
    if (!storage) return;
    storage.removeItem(key);
  } catch {
    // ignore
  }
}

function getSessionStorage(): Storage | null {
  try {
    return typeof window !== 'undefined' ? window.sessionStorage : null;
  } catch {
    return null;
  }
}

function getLocalStorage(): Storage | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}

function normalizeToken(raw: unknown): string | null {
  if (raw == null) return null;
  let token = String(raw).trim();
  if (!token) return null;

  // Manejar valores basura comunes
  if (token === 'null' || token === 'undefined') return null;

  // Si viene con comillas (p. ej. "..."), quitarlas
  if ((token.startsWith('"') && token.endsWith('"')) || (token.startsWith("'") && token.endsWith("'"))) {
    token = token.slice(1, -1).trim();
  }

  return token || null;
}

function tryGetJwtExpMs(token: string): number | null {
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;
    const payloadB64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = payloadB64 + '==='.slice((payloadB64.length + 3) % 4);
    const json = atob(padded);
    const payload = JSON.parse(json);
    const expSec = Number(payload?.exp);
    if (!Number.isFinite(expSec)) return null;
    return expSec * 1000;
  } catch {
    return null;
  }
}

const ENABLE_CLIENT_TOKEN_EXPIRY = false;

function isTokenExpired(token: string, skewMs = 30_000): boolean {
  if (!ENABLE_CLIENT_TOKEN_EXPIRY) return false;
  const expMs = tryGetJwtExpMs(token);
  if (!expMs) return false;
  return Date.now() >= expMs - skewMs;
}

export const API_BASE_URL =
  (typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('api') : null) ||
  import.meta.env.VITE_API_URL ||
  'http://localhost:5000/api';

export const auth = {
  getToken: (): string | null => {
    // Seguridad/UX: el token NO debe sobrevivir al cierre de la app.
    // Por eso usamos sessionStorage. Si existía un token viejo en localStorage, lo removemos.
    const ls = getLocalStorage();
    const ss = getSessionStorage();

    const legacy = normalizeToken(safeGetItem(ls, TOKEN_KEY));
    if (legacy) safeRemoveItem(ls, TOKEN_KEY);

    // Prefer sessionStorage, but allow localStorage fallback when sessionStorage is unavailable.
    let token = normalizeToken(safeGetItem(ss, TOKEN_KEY));
    if (!token) token = normalizeToken(safeGetItem(ls, TOKEN_KEY));
    if (!token) token = normalizeToken(memoryToken);
    if (!token) return null;

    // Si el token está expirado o es inválido, no montamos vistas protegidas.
    // Esto evita la tormenta de 401 cuando se reabre la app horas después.
    if (isTokenExpired(token)) {
      safeRemoveItem(ss, TOKEN_KEY);
      return null;
    }

    // Validación ligera: parece JWT (3 segmentos)
    if (token.split('.').length < 3) return null;
    return token;
  },
  setToken: (token: string) => {
    const ls = getLocalStorage();
    const ss = getSessionStorage();
    const normalized = normalizeToken(token);
    if (!normalized) {
      safeRemoveItem(ss, TOKEN_KEY);
      safeRemoveItem(ls, TOKEN_KEY);
      memoryToken = null;
      return;
    }
    // Guardar en sessionStorage si está disponible; si no, usar localStorage.
    // Esto evita loops en entornos donde sessionStorage no funciona (Electron/in-app).
    safeSetItem(ss, TOKEN_KEY, normalized);
    const sessionOk = Boolean(safeGetItem(ss, TOKEN_KEY));
    if (!sessionOk) {
      safeSetItem(ls, TOKEN_KEY, normalized);
      const localOk = Boolean(safeGetItem(ls, TOKEN_KEY));
      memoryToken = localOk ? null : normalized;
    } else {
      safeRemoveItem(ls, TOKEN_KEY);
      memoryToken = null;
    }
  },
  clear: () => {
    safeRemoveItem(getSessionStorage(), TOKEN_KEY);
    safeRemoveItem(getLocalStorage(), TOKEN_KEY);
    memoryToken = null;
  },
};

const http = axios.create({
  baseURL: API_BASE_URL,
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

  // Si es FormData, NO fijar Content-Type manualmente.
  // El navegador debe colocar el boundary correcto para multipart.
  if (typeof FormData !== 'undefined' && config.data instanceof FormData) {
    config.headers = (config.headers ?? {}) as any;
    delete (config.headers as any)['Content-Type'];
    delete (config.headers as any)['content-type'];
  }
  return config;
});

http.interceptors.response.use(
  (res) => res,
  (err) => {
    const status = err?.response?.status;
    const url = String(err?.config?.url || '');
    const msg = String(err?.response?.data?.error || '');

    const isAuthMe = url.includes('/auth/me');
    const isNotEmployee = msg.toLowerCase().includes('no es empleado');
    const isDisabled = msg.toLowerCase().includes('desactivado');

    // 401: token inválido/expirado.
    // 403 en /auth/me: token válido pero usuario NO autorizado (no empleado / desactivado).
    // En ambos casos, limpiamos token para evitar bucles en vistas protegidas.
    if (status === 401 || (status === 403 && isAuthMe && (isNotEmployee || isDisabled || msg))) {
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
    logout: async (): Promise<{ message: string }> => {
      const res = await http.post('/auth/logout');
      return res.data as any;
    },
    me: async (): Promise<{ user: any }> => {
      const res = await http.get('/auth/me');
      return res.data as any;
    },
  },

  activity: {
    list: async (params?: { limit?: number; offset?: number; q?: string }): Promise<{ items: any[]; count: number | null; limit: number; offset: number }> => {
      const res = await http.get('/activity', {
        params: {
          limit: params?.limit,
          offset: params?.offset,
          q: params?.q,
        },
      });
      return res.data as any;
    },
  },

  admin: {
    crearEmpleado: async (data: {
      email: string;
      password: string;
      rol: 'admin' | 'contador' | 'tutor_view_only';
      nombre_completo?: string | null;
      telefono?: string | null;
    }): Promise<any> => {
      const res = await http.post('/admin/crear-empleado', {
        email: data.email,
        password: data.password,
        rol: data.rol,
        nombre_completo: data.nombre_completo ?? null,
        telefono: data.telefono ?? null,
      });
      return res.data as any;
    },

    listarEmpleados: async (): Promise<any[]> => {
      const res = await http.get('/admin/empleados');
      return res.data as any[];
    },

    actualizarEmpleado: async (
      id: string,
      data: { rol?: 'admin' | 'contador' | 'tutor_view_only'; estado?: boolean; nombre_completo?: string | null; telefono?: string | null }
    ): Promise<any> => {
      const res = await http.patch(`/admin/empleados/${id}`, data);
      return res.data as any;
    },

    eliminarEmpleado: async (id: string): Promise<{ ok: boolean; id: string }> => {
      const res = await http.delete(`/admin/empleados/${id}`);
      return res.data as any;
    },
  },

  bulk: {
    downloadTemplate: async (tipo: 'estudiantes_bulk' | 'grupo_matricula' | 'cursos_bulk'): Promise<Blob> => {
      const res = await http.get(`/bulk/template/${tipo}`, { responseType: 'blob' as any });
      return res.data as any;
    },
    previewExcel: async (file: File): Promise<any> => {
      const form = new FormData();
      form.append('file', file);
      const res = await http.post('/bulk/preview', form);
      return res.data as any;
    },
    uploadExcel: async (file: File): Promise<any> => {
      const form = new FormData();
      form.append('file', file);
      const res = await http.post('/bulk/upload', form);
      return res.data as any;
    },

    // Lectura administrativa: ver lo subido
    listGrupos: async (): Promise<any[]> => {
      const res = await http.get('/bulk/grupos');
      return res.data as any[];
    },
    getGrupo: async (id: string): Promise<any> => {
      const res = await http.get(`/bulk/grupos/${id}`);
      return res.data as any;
    },
    listEstudiantesBulk: async (): Promise<any[]> => {
      const res = await http.get('/bulk/estudiantes');
      return res.data as any[];
    },

    createEstudianteBulk: async (data: {
      nombre: string;
      nombre_encargado?: string | null;
      email_encargado?: string | null;
      telefono_encargado?: string | null;
      correo?: string | null;
      telefono?: string | null;
      requiere_perfil_completo?: boolean;
      estado?: boolean;
    }): Promise<any> => {
      const res = await http.post('/bulk/estudiantes', data);
      return res.data as any;
    },

    createGrupo: async (data: {
      curso_id: number;
      tutor_id: number;
      nombre_grupo?: string | null;
      cantidad_estudiantes_esperados?: number | null;
      fecha_inicio?: string | null;
      fecha_fin?: string | null;
      turno?: string | null;
      notas?: string | null;
      estado?: string | null;
    }): Promise<any> => {
      const res = await http.post('/bulk/grupos', data);
      return res.data as any;
    },
    updateGrupo: async (id: string, data: any): Promise<any> => {
      const res = await http.put(`/bulk/grupos/${id}`, data);
      return res.data as any;
    },
    deleteGrupo: async (id: string): Promise<{ ok: boolean; id: string }> => {
      const res = await http.delete(`/bulk/grupos/${id}`);
      return res.data as any;
    },

    updateEstudianteBulk: async (id: number, data: any): Promise<any> => {
      const res = await http.put(`/bulk/estudiantes/${id}`, data);
      return res.data as any;
    },
    deleteEstudianteBulk: async (id: number): Promise<any> => {
      const res = await http.delete(`/bulk/estudiantes/${id}`);
      return res.data as any;
    },

    assignEstudiantesToGrupo: async (
      grupoId: string,
      estudianteBulkIds: number[] = [],
      estudianteIds: number[] = []
    ): Promise<any> => {
      const res = await http.post(`/bulk/grupos/${grupoId}/estudiantes`, {
        estudiante_bulk_ids: estudianteBulkIds,
        estudiante_ids: estudianteIds,
      });
      return res.data as any;
    },
    unassignEstudiantes: async (estudianteBulkIds: number[] = [], estudianteIds: number[] = []): Promise<any> => {
      const res = await http.post('/bulk/estudiantes/unassign', {
        estudiante_bulk_ids: estudianteBulkIds,
        estudiante_ids: estudianteIds,
      });
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
    deleteCascade: async (id: number): Promise<void> => {
      await http.delete(`/cursos/${id}?cascade=1`);
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
    createFromBulkGrupo: async (matricula_grupo_id: string, grupo_nombre?: string | null): Promise<any> => {
      const res = await http.post('/matriculas/from-bulk-grupo', { matricula_grupo_id, grupo_nombre: grupo_nombre ?? null });
      return res.data as any;
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
    getPendientesResumen: async (params: {
      tutor_id: number;
      fecha_inicio?: string;
      fecha_fin?: string;
    }): Promise<any> => {
      const res = await http.get('/pagos/pendientes/resumen', { params });
      return res.data as any;
    },
    getPendientesResumenTutores: async (): Promise<any> => {
      const res = await http.get('/pagos/pendientes/resumen-tutores');
      return res.data as any;
    },
    getPendientesDetalleTutor: async (params: {
      tutor_id: number;
      fecha_inicio?: string;
      fecha_fin?: string;
    }): Promise<any> => {
      const res = await http.get('/pagos/pendientes/detalle-tutor', { params });
      return res.data as any;
    },
    getPendientesResumenEstudiantes: async (): Promise<any> => {
      const res = await http.get('/pagos/pendientes/resumen-estudiantes');
      return res.data as any;
    },
    getPendientesDetalleEstudiante: async (params: {
      estudiante_id?: number | null;
      estudiante_bulk_id?: number | null;
      fecha_inicio?: string;
      fecha_fin?: string;
    }): Promise<any> => {
      const res = await http.get('/pagos/pendientes/detalle-estudiante', { params });
      return res.data as any;
    },

    getPendientesSesiones: async (params?: {
      q?: string;
      tutor_id?: number;
      estudiante_id?: number;
      fecha_inicio?: string;
      fecha_fin?: string;
      limit?: number;
    }): Promise<any> => {
      const res = await http.get('/pagos/pendientes/sesiones', { params });
      return res.data as any;
    },
    liquidarIngresoEstudiante: async (data: {
      estudiante_id: number;
      movimiento_ids?: number[];
      fecha_inicio?: string;
      fecha_fin?: string;
      metodo: 'sinpe' | 'transferencia' | 'efectivo';
      referencia?: string;
      fecha_comprobante?: string;
    }): Promise<any> => {
      const res = await http.post('/pagos/ingresos/liquidar-estudiante', data);
      return res.data as any;
    },
    liquidarPendientes: async (data: {
      tutor_id: number;
      fecha_inicio?: string;
      fecha_fin?: string;
      descripcion?: string;
      estado?: string;
    }): Promise<any> => {
      const res = await http.post('/pagos/liquidar', data);
      return res.data as any;
    },

    getLibroDiario: async (params: { fecha?: string; fecha_inicio?: string; fecha_fin?: string; only_totals?: any; tutor_id?: number; incluir_pendientes?: any }): Promise<any> => {
      const res = await http.get('/pagos/libro-diario', { params });
      return res.data as any;
    },

    createMovimientoManual: async (data: {
      direccion: 'entrada' | 'salida';
      monto: number;
      fecha: string;
      metodo?: 'sinpe' | 'transferencia' | 'efectivo' | string;
      referencia?: string;
      detalle?: string;
      categoria?: string;
      a_nombre_de?: string;
      tutor_id?: number | null;
      estudiante_id?: number | null;
      curso_id?: number | null;
      sesion_id?: number | null;
    }): Promise<any> => {
      const res = await http.post('/pagos/movimientos/manual', data);
      return res.data as any;
    },

    liquidarIngresoSesion: async (data: {
      sesion_id: number;
      metodo: 'sinpe' | 'transferencia' | 'efectivo' | string;
      referencia?: string;
      fecha_comprobante?: string;
    }): Promise<any> => {
      const res = await http.post('/pagos/ingresos/liquidar-sesion', data);
      return res.data as any;
    },

    uploadComprobanteMovimiento: async (movimientoId: number | string, file: File): Promise<any> => {
      const form = new FormData();
      form.append('file', file);
      const res = await http.post(`/pagos/movimientos/${movimientoId}/comprobante`, form);
      return res.data as any;
    },

    createComprobanteIngreso: async (data: {
      numero_comprobante: string;
      monto: number;
      fecha_comprobante: string;
      pagador_nombre: string;
      pagador_contacto?: string;
      detalle?: string;
      movimiento_dinero_id?: number;
      foto_url?: string;
    }): Promise<any> => {
      const res = await http.post('/pagos/comprobantes-ingreso', data);
      return res.data as any;
    },

    aplicarComprobanteUrlBulk: async (data: { ids: Array<number | string>; comprobante_url: string }): Promise<any> => {
      const res = await http.post('/pagos/movimientos/comprobante/bulk', data);
      return res.data as any;
    },
  },

  tesoreria: {
    getResumen: async (): Promise<any> => {
      const res = await http.get('/tesoreria/resumen');
      return res.data as any;
    },
    getEncargadosResumen: async (): Promise<any> => {
      const res = await http.get('/tesoreria/encargados/resumen');
      return res.data as any;
    },
    getEncargadosPorcentaje: async (): Promise<any> => {
      const res = await http.get('/tesoreria/encargados/porcentaje');
      return res.data as any;
    },
    getTutoresResumen: async (): Promise<any> => {
      const res = await http.get('/tesoreria/tutores/resumen');
      return res.data as any;
    },
    getBolsa: async (): Promise<any> => {
      const res = await http.get('/tesoreria/bolsa');
      return res.data as any;
    },
    getEsperadoDiario: async (params: { fecha_inicio?: string; fecha_fin?: string }): Promise<any> => {
      const res = await http.get('/tesoreria/esperado/diario', { params });
      return res.data as any;
    },
    getDiario: async (params: {
      fecha?: string;
      fecha_inicio?: string;
      fecha_fin?: string;
      incluir_pendientes?: any;
      encargado_id?: number;
      tutor_id?: number;
      cuenta_id?: number;
      order?: 'asc' | 'desc';
      limit?: number;
    }): Promise<any> => {
      const res = await http.get('/tesoreria/diario', { params });
      return res.data as any;
    },
    registrarPagoEncargado: async (encargadoId: number, data: {
      monto: number;
      fecha_pago: string;
      metodo?: string;
      numero_comprobante?: string;
      fecha_comprobante?: string;
      comprobante_url?: string;
      referencia?: string;
      detalle?: string;
    }): Promise<any> => {
      const res = await http.post(`/tesoreria/encargados/${encargadoId}/pagos`, data);
      return res.data as any;
    },
    registrarPagoTutor: async (tutorId: number, data: {
      monto: number;
      fecha_pago: string;
      metodo?: string;
      numero_comprobante?: string;
      fecha_comprobante?: string;
      comprobante_url?: string;
      referencia?: string;
      detalle?: string;
      funding_mode?: 'sistema' | 'auto_encargados';
      source_encargado_id?: number;
      obligacion_ids?: number[];
    }): Promise<any> => {
      const res = await http.post(`/tesoreria/tutores/${tutorId}/pagos`, data);
      return res.data as any;
    },

    registrarCobroGrupal: async (grupoId: number, data?: {
      detalle?: string;
    }): Promise<any> => {
      const res = await http.post(`/tesoreria/grupos/${grupoId}/cobro`, data || {});
      return res.data as any;
    },

    getObligacionesEncargado: async (encargadoId: number | string, params?: { estado?: 'pendiente' | 'todas' }): Promise<any> => {
      const res = await http.get(`/tesoreria/encargados/${encargadoId}/obligaciones`, { params });
      return res.data as any;
    },

    getObligacionesTutor: async (tutorId: number | string, params?: { estado?: 'pendiente' | 'todas' }): Promise<any> => {
      const res = await http.get(`/tesoreria/tutores/${tutorId}/obligaciones`, { params });
      return res.data as any;
    },
    uploadComprobantePago: async (pagoId: number | string, file: File): Promise<any> => {
      const form = new FormData();
      form.append('file', file);
      const res = await http.post(`/tesoreria/pagos/${pagoId}/comprobante`, form);
      return res.data as any;
    },
    updatePago: async (pagoId: number | string, data: {
      metodo?: string;
      numero_comprobante?: string;
      fecha_comprobante?: string;
      referencia?: string;
      detalle?: string;
      estado?: string;
    }): Promise<any> => {
      const res = await http.patch(`/tesoreria/pagos/${pagoId}`, data);
      return res.data as any;
    },

    getPagoAplicaciones: async (pagoId: number | string): Promise<any> => {
      const res = await http.get(`/tesoreria/pagos/${pagoId}/aplicaciones`);
      return res.data as any;
    },

    getCuentaMovimientosEncargado: async (encargadoId: number | string, params?: { fecha_inicio?: string; fecha_fin?: string; incluir_pendientes?: any }): Promise<any> => {
      const res = await http.get(`/tesoreria/cuentas/encargado/${encargadoId}/movimientos`, { params });
      return res.data as any;
    },

    getCuentaMovimientosTutor: async (tutorId: number | string, params?: { fecha_inicio?: string; fecha_fin?: string; incluir_pendientes?: any }): Promise<any> => {
      const res = await http.get(`/tesoreria/cuentas/tutor/${tutorId}/movimientos`, { params });
      return res.data as any;
    },

    exportDiarioXlsx: async (params: {
      fecha?: string;
      fecha_inicio?: string;
      fecha_fin?: string;
      incluir_pendientes?: any;
      encargado_id?: number;
      tutor_id?: number;
      cuenta_id?: number;
      order?: 'asc' | 'desc';
      limit?: number;
    }): Promise<Blob> => {
      const res = await http.get('/tesoreria/export/diario', { params, responseType: 'blob' as any });
      return res.data as any;
    },

    exportCuentaXlsx: async (cuentaId: number | string, params?: { fecha_inicio?: string; fecha_fin?: string; incluir_pendientes?: any; order?: 'asc' | 'desc'; limit?: number }): Promise<Blob> => {
      const res = await http.get(`/tesoreria/export/cuenta/${cuentaId}`, { params, responseType: 'blob' as any });
      return res.data as any;
    },

    getCierres: async (): Promise<any> => {
      const res = await http.get('/tesoreria/cierres');
      return res.data as any;
    },

    crearCierre: async (data: { mes: string; cerrado_hasta: string; nota?: string | null; password?: string }): Promise<any> => {
      const res = await http.post('/tesoreria/cierres', data);
      return res.data as any;
    },

    ajustarCierre: async (data: { mes?: string; cerrado_hasta?: string | null; nota?: string | null; password?: string; modo?: 'reset' | 'clear' }): Promise<any> => {
      const res = await http.post('/tesoreria/cierres/ajustar', data);
      return res.data as any;
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
    cancelarSesionDia: async (matriculaId: number, fecha: string, motivo?: string): Promise<any> => {
      const res = await http.post(`/dashboard/sesion/${matriculaId}/${fecha}/cancelar-dia`, {
        motivo_cancelacion: motivo || null,
      });
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

    getMetricas: async (params?: { mes?: string; tutor_id?: number }): Promise<any> => {
      const res = await http.get('/dashboard/metricas', { params });
      return res.data as any;
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
