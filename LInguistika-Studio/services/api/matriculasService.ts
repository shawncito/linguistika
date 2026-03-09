// services/api/matriculasService.ts
import { httpClient } from './apiClient';
import type { Matricula } from '../../types';

export const matriculasService = {
  getAll: async (): Promise<Matricula[]> => {
    const res = await httpClient.get<Matricula[]>('/matriculas');
    return res.data;
  },
  create: async (data: Partial<Matricula>): Promise<Matricula> => {
    const res = await httpClient.post<Matricula>('/matriculas', data);
    return res.data;
  },
  createFromBulkGrupo: async (
    matricula_grupo_id: string,
    grupo_nombre?: string | null
  ): Promise<any> => {
    const res = await httpClient.post('/matriculas/from-bulk-grupo', {
      matricula_grupo_id,
      grupo_nombre: grupo_nombre ?? null,
    });
    return res.data as any;
  },
  update: async (id: number, data: Partial<Matricula>): Promise<Matricula> => {
    const res = await httpClient.put<Matricula>(`/matriculas/${id}`, data);
    return res.data;
  },
  delete: async (id: number): Promise<void> => {
    await httpClient.delete(`/matriculas/${id}`);
  },
  validateTutorCourse: async (
    tutor_id: number,
    curso_id: number
  ): Promise<{ compatible: boolean; issues: string[] }> => {
    const res = await httpClient.get<{ compatible: boolean; issues: string[] }>(
      `/matriculas/validate/tutor-course/${tutor_id}/${curso_id}`
    );
    return res.data;
  },
};
