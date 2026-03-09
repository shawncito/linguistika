// services/api/pagosService.ts
import { httpClient } from './apiClient';
import type { Pago } from '../../types';

export const pagosService = {
  getAll: async (): Promise<Pago[]> => {
    const res = await httpClient.get<Pago[]>('/pagos');
    return res.data;
  },
  create: async (data: Partial<Pago>): Promise<Pago> => {
    const res = await httpClient.post<Pago>('/pagos', data);
    return res.data;
  },
  getPendientesResumen: async (params: {
    tutor_id: number;
    fecha_inicio?: string;
    fecha_fin?: string;
  }): Promise<any> => {
    const res = await httpClient.get('/pagos/pendientes/resumen', { params });
    return res.data as any;
  },
  getPendientesResumenTutores: async (): Promise<any> => {
    const res = await httpClient.get('/pagos/pendientes/resumen-tutores');
    return res.data as any;
  },
  getPendientesDetalleTutor: async (params: {
    tutor_id: number;
    fecha_inicio?: string;
    fecha_fin?: string;
  }): Promise<any> => {
    const res = await httpClient.get('/pagos/pendientes/detalle-tutor', { params });
    return res.data as any;
  },
  getPendientesResumenEstudiantes: async (): Promise<any> => {
    const res = await httpClient.get('/pagos/pendientes/resumen-estudiantes');
    return res.data as any;
  },
  getPendientesDetalleEstudiante: async (params: {
    estudiante_id?: number | null;
    estudiante_bulk_id?: number | null;
    fecha_inicio?: string;
    fecha_fin?: string;
  }): Promise<any> => {
    const res = await httpClient.get('/pagos/pendientes/detalle-estudiante', { params });
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
    const res = await httpClient.get('/pagos/pendientes/sesiones', { params });
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
    const res = await httpClient.post('/pagos/ingresos/liquidar-estudiante', data);
    return res.data as any;
  },
  liquidarPendientes: async (data: {
    tutor_id: number;
    fecha_inicio?: string;
    fecha_fin?: string;
    descripcion?: string;
    estado?: string;
  }): Promise<any> => {
    const res = await httpClient.post('/pagos/liquidar', data);
    return res.data as any;
  },
  getLibroDiario: async (params: {
    fecha?: string;
    fecha_inicio?: string;
    fecha_fin?: string;
    only_totals?: any;
    tutor_id?: number;
    incluir_pendientes?: any;
  }): Promise<any> => {
    const res = await httpClient.get('/pagos/libro-diario', { params });
    return res.data as any;
  },
  createMovimientoManual: async (data: {
    direccion: 'entrada' | 'salida';
    monto: number;
    fecha: string;
    metodo?: string;
    referencia?: string;
    detalle?: string;
    categoria?: string;
    a_nombre_de?: string;
    tutor_id?: number | null;
    estudiante_id?: number | null;
    curso_id?: number | null;
    sesion_id?: number | null;
  }): Promise<any> => {
    const res = await httpClient.post('/pagos/movimientos/manual', data);
    return res.data as any;
  },
  liquidarIngresoSesion: async (data: {
    sesion_id: number;
    metodo: string;
    referencia?: string;
    fecha_comprobante?: string;
  }): Promise<any> => {
    const res = await httpClient.post('/pagos/ingresos/liquidar-sesion', data);
    return res.data as any;
  },
  uploadComprobanteMovimiento: async (
    movimientoId: number | string,
    file: File
  ): Promise<any> => {
    const form = new FormData();
    form.append('file', file);
    const res = await httpClient.post(`/pagos/movimientos/${movimientoId}/comprobante`, form);
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
    const res = await httpClient.post('/pagos/comprobantes-ingreso', data);
    return res.data as any;
  },
  aplicarComprobanteUrlBulk: async (data: {
    ids: Array<number | string>;
    comprobante_url: string;
  }): Promise<any> => {
    const res = await httpClient.post('/pagos/movimientos/comprobante/bulk', data);
    return res.data as any;
  },
};
