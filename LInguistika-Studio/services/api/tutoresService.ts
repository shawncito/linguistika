// services/api/tutoresService.ts
import { httpClient } from './apiClient';
import type { Tutor } from '../../types';

export const tutoresService = {
  getAll: async (): Promise<Tutor[]> => {
    const res = await httpClient.get<Tutor[]>('/tutores');
    return res.data;
  },
  getById: async (id: number): Promise<Tutor | undefined> => {
    const res = await httpClient.get<Tutor>(`/tutores/${id}`);
    return res.data;
  },
  create: async (data: Partial<Tutor>): Promise<Tutor> => {
    const res = await httpClient.post<Tutor>('/tutores', data);
    return res.data;
  },
  update: async (id: number, data: Partial<Tutor>): Promise<Tutor> => {
    const res = await httpClient.put<Tutor>(`/tutores/${id}`, data);
    return res.data;
  },
  delete: async (id: number): Promise<void> => {
    await httpClient.delete(`/tutores/${id}`);
  },
};
