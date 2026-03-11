// services/api/finanzasService.ts
import { httpClient } from './apiClient';

export const finanzasService = {
  listMovimientos: async (params?: {
    tipo?: string;
    estado?: string;
    referencia_tabla?: string;
    referencia_id?: string;
    curso_id?: string;
    matricula_grupo_id?: string;
    fecha_inicio?: string;
    fecha_fin?: string;
  }): Promise<any> => {
    const res = await httpClient.get('/finanzas/movimientos', { params });
    return (res.data?.data ?? res.data) as any;
  },
  createComprobante: async (data: Record<string, any>): Promise<any> => {
    const res = await httpClient.post('/finanzas/comprobantes', data);
    return (res.data?.data ?? res.data) as any;
  },
  listComprobantes: async (): Promise<any> => {
    const res = await httpClient.get('/finanzas/comprobantes');
    return (res.data?.data ?? res.data) as any;
  },
  updateComprobante: async (id: number | string, data: Record<string, any>): Promise<any> => {
    const res = await httpClient.patch(`/finanzas/comprobantes/${id}`, data);
    return (res.data?.data ?? res.data) as any;
  },
};
