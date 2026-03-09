// services/api/cursosService.ts
import { httpClient } from './apiClient';
import type { Curso } from '../../types';

export const cursosService = {
  getAll: async (): Promise<Curso[]> => {
    const res = await httpClient.get<Curso[]>('/cursos');
    return res.data;
  },
  getById: async (id: number): Promise<Curso | undefined> => {
    const res = await httpClient.get<Curso>(`/cursos/${id}`);
    return res.data;
  },
  create: async (data: Partial<Curso>): Promise<Curso> => {
    const res = await httpClient.post<Curso>('/cursos', data);
    return res.data;
  },
  update: async (id: number, data: Partial<Curso>): Promise<Curso> => {
    const res = await httpClient.put<Curso>(`/cursos/${id}`, data);
    return res.data;
  },
  delete: async (id: number): Promise<void> => {
    await httpClient.delete(`/cursos/${id}`);
  },
  deleteCascade: async (id: number): Promise<void> => {
    await httpClient.delete(`/cursos/${id}?cascade=1`);
  },
};
