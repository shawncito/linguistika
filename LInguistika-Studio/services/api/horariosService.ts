// services/api/horariosService.ts
import { httpClient } from './apiClient';

export const horariosService = {
  getByTutor: async (tutorId: number | string): Promise<any> => {
    const res = await httpClient.get(`/horarios/tutor/${tutorId}`);
    return (res.data?.data ?? res.data) as any;
  },
  getAllClases: async (): Promise<any> => {
    const res = await httpClient.get('/horarios/clases/todas');
    return (res.data?.data ?? res.data) as any;
  },
  createClase: async (data: Record<string, any>): Promise<any> => {
    const res = await httpClient.post('/horarios/clases/crear', data);
    return (res.data?.data ?? res.data) as any;
  },
  create: async (data: Record<string, any>): Promise<any> => {
    const res = await httpClient.post('/horarios', data);
    return (res.data?.data ?? res.data) as any;
  },
  update: async (id: number | string, data: Record<string, any>): Promise<any> => {
    const res = await httpClient.put(`/horarios/${id}`, data);
    return (res.data?.data ?? res.data) as any;
  },
  deactivate: async (id: number | string): Promise<any> => {
    const res = await httpClient.delete(`/horarios/${id}`);
    return (res.data?.data ?? res.data) as any;
  },
};
