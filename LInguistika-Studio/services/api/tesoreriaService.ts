// services/api/tesoreriaService.ts
import { httpClient } from './apiClient';

export const tesoreriaService = {
  getResumen: async (): Promise<any> => {
    const res = await httpClient.get('/tesoreria/resumen');
    return (res.data?.data ?? res.data) as any;
  },
  getEncargadosResumen: async (): Promise<any> => {
    const res = await httpClient.get('/tesoreria/encargados/resumen');
    return (res.data?.data ?? res.data) as any;
  },
  getEncargadosPorcentaje: async (): Promise<any> => {
    const res = await httpClient.get('/tesoreria/encargados/porcentaje');
    return (res.data?.data ?? res.data) as any;
  },
  getTutoresResumen: async (): Promise<any> => {
    const res = await httpClient.get('/tesoreria/tutores/resumen');
    return (res.data?.data ?? res.data) as any;
  },
  getBolsa: async (): Promise<any> => {
    const res = await httpClient.get('/tesoreria/bolsa');
    return (res.data?.data ?? res.data) as any;
  },
  getEsperadoDiario: async (params: { fecha_inicio?: string; fecha_fin?: string }): Promise<any> => {
    const res = await httpClient.get('/tesoreria/esperado/diario', { params });
    return (res.data?.data ?? res.data) as any;
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
    const res = await httpClient.get('/tesoreria/diario', { params });
    return (res.data?.data ?? res.data) as any;
  },
  registrarPagoEncargado: async (
    encargadoId: number,
    data: {
      monto: number;
      fecha_pago: string;
      metodo?: string;
      numero_comprobante?: string;
      fecha_comprobante?: string;
      comprobante_url?: string;
      referencia?: string;
      detalle?: string;
    }
  ): Promise<any> => {
    const res = await httpClient.post(`/tesoreria/encargados/${encargadoId}/pagos`, data);
    return (res.data?.data ?? res.data) as any;
  },
  registrarPagoTutor: async (
    tutorId: number,
    data: {
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
    }
  ): Promise<any> => {
    const res = await httpClient.post(`/tesoreria/tutores/${tutorId}/pagos`, data);
    return (res.data?.data ?? res.data) as any;
  },
  registrarCobroGrupal: async (grupoId: number, data?: { detalle?: string }): Promise<any> => {
    const res = await httpClient.post(`/tesoreria/grupos/${grupoId}/cobro`, data || {});
    return (res.data?.data ?? res.data) as any;
  },
  getObligacionesEncargado: async (
    encargadoId: number | string,
    params?: { estado?: 'pendiente' | 'todas' }
  ): Promise<any> => {
    const res = await httpClient.get(`/tesoreria/encargados/${encargadoId}/obligaciones`, { params });
    return (res.data?.data ?? res.data) as any;
  },
  getObligacionesTutor: async (
    tutorId: number | string,
    params?: { estado?: 'pendiente' | 'todas' }
  ): Promise<any> => {
    const res = await httpClient.get(`/tesoreria/tutores/${tutorId}/obligaciones`, { params });
    return (res.data?.data ?? res.data) as any;
  },
  uploadComprobantePago: async (pagoId: number | string, file: File): Promise<any> => {
    const form = new FormData();
    form.append('file', file);
    const res = await httpClient.post(`/tesoreria/pagos/${pagoId}/comprobante`, form);
    return (res.data?.data ?? res.data) as any;
  },
  updatePago: async (
    pagoId: number | string,
    data: {
      metodo?: string;
      numero_comprobante?: string;
      fecha_comprobante?: string;
      referencia?: string;
      detalle?: string;
      estado?: string;
    }
  ): Promise<any> => {
    const res = await httpClient.patch(`/tesoreria/pagos/${pagoId}`, data);
    return (res.data?.data ?? res.data) as any;
  },
  getPagoAplicaciones: async (pagoId: number | string): Promise<any> => {
    const res = await httpClient.get(`/tesoreria/pagos/${pagoId}/aplicaciones`);
    return (res.data?.data ?? res.data) as any;
  },
  getCuentaMovimientosEncargado: async (
    encargadoId: number | string,
    params?: { fecha_inicio?: string; fecha_fin?: string; incluir_pendientes?: any }
  ): Promise<any> => {
    const res = await httpClient.get(
      `/tesoreria/cuentas/encargado/${encargadoId}/movimientos`,
      { params }
    );
    return (res.data?.data ?? res.data) as any;
  },
  getCuentaMovimientosTutor: async (
    tutorId: number | string,
    params?: { fecha_inicio?: string; fecha_fin?: string; incluir_pendientes?: any }
  ): Promise<any> => {
    const res = await httpClient.get(
      `/tesoreria/cuentas/tutor/${tutorId}/movimientos`,
      { params }
    );
    return (res.data?.data ?? res.data) as any;
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
    const res = await httpClient.get('/tesoreria/export/diario', {
      params,
      responseType: 'blob' as any,
    });
    return res.data as any;
  },
  exportCuentaXlsx: async (
    cuentaId: number | string,
    params?: {
      fecha_inicio?: string;
      fecha_fin?: string;
      incluir_pendientes?: any;
      order?: 'asc' | 'desc';
      limit?: number;
    }
  ): Promise<Blob> => {
    const res = await httpClient.get(`/tesoreria/export/cuenta/${cuentaId}`, {
      params,
      responseType: 'blob' as any,
    });
    return res.data as any;
  },
  getCierres: async (): Promise<any> => {
    const res = await httpClient.get('/tesoreria/cierres');
    return (res.data?.data ?? res.data) as any;
  },
  crearCierre: async (data: {
    mes: string;
    cerrado_hasta: string;
    nota?: string | null;
    password?: string;
  }): Promise<any> => {
    const res = await httpClient.post('/tesoreria/cierres', data);
    return (res.data?.data ?? res.data) as any;
  },
  ajustarCierre: async (data: {
    mes?: string;
    cerrado_hasta?: string | null;
    nota?: string | null;
    password?: string;
    modo?: 'reset' | 'clear';
  }): Promise<any> => {
    const res = await httpClient.post('/tesoreria/cierres/ajustar', data);
    return (res.data?.data ?? res.data) as any;
  },
};
