// services/api/estudiantesService.ts
import { httpClient } from './apiClient';
import type { Estudiante } from '../../types';

export const estudiantesService = {
  getAll: async (): Promise<Estudiante[]> => {
    const res = await httpClient.get<Estudiante[]>('/estudiantes');
    return res.data;
  },
  getById: async (id: number): Promise<Estudiante | undefined> => {
    const res = await httpClient.get<Estudiante>(`/estudiantes/${id}`);
    return res.data;
  },
  create: async (data: Partial<Estudiante>): Promise<Estudiante> => {
    const res = await httpClient.post<Estudiante>('/estudiantes', data);
    return res.data;
  },
  update: async (id: number, data: Partial<Estudiante>): Promise<Estudiante> => {
    const res = await httpClient.put<Estudiante>(`/estudiantes/${id}`, data);
    return res.data;
  },
  delete: async (id: number): Promise<void> => {
    await httpClient.delete(`/estudiantes/${id}`);
  },
};
