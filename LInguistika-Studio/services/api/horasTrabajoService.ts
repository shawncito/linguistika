// services/api/horasTrabajoService.ts
import { httpClient } from './apiClient';
import type { HorasTrabajo } from '../../types';

export const horasTrabajoService = {
  getAll: async (params?: {
    fecha?: string;
    tutor_id?: number;
    estado?: string;
  }): Promise<HorasTrabajo[]> => {
    const res = await httpClient.get<HorasTrabajo[]>('/horas-trabajo', { params });
    return res.data;
  },

  create: async (
    data: Partial<HorasTrabajo> & {
      tutor_id: number;
      fecha: string;
      horas: number;
      clase_id?: number | null;
      notas?: string | null;
    }
  ): Promise<HorasTrabajo> => {
    const res = await httpClient.post<HorasTrabajo>('/horas-trabajo', data);
    return res.data;
  },

  update: async (id: number, data: Partial<HorasTrabajo>): Promise<HorasTrabajo> => {
    const res = await httpClient.put<HorasTrabajo>(`/horas-trabajo/${id}`, data);
    return res.data;
  },

  aprobar: async (
    id: number
  ): Promise<{ horas_trabajo: HorasTrabajo; pago_creado: boolean }> => {
    const res = await httpClient.post(`/horas-trabajo/${id}/aprobar`);
    return res.data as any;
  },
};
