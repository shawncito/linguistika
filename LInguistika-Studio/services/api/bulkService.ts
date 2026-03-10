// services/api/bulkService.ts
import { httpClient } from './apiClient';

export const bulkService = {
  downloadTemplate: async (
    tipo: 'estudiantes_bulk' | 'grupo_matricula' | 'cursos_bulk'
  ): Promise<Blob> => {
    const res = await httpClient.get(`/bulk/template/${tipo}`, { responseType: 'blob' as any });
    return res.data as any;
  },

  previewExcel: async (file: File): Promise<any> => {
    const form = new FormData();
    form.append('file', file);
    const res = await httpClient.post('/bulk/preview', form);
    return res.data as any;
  },

  uploadExcel: async (file: File): Promise<any> => {
    const form = new FormData();
    form.append('file', file);
    const res = await httpClient.post('/bulk/upload', form);
    return res.data as any;
  },

  listGrupos: async (): Promise<any[]> => {
    const res = await httpClient.get('/bulk/grupos');
    return (res.data?.data ?? res.data) as any[];
  },

  getGrupo: async (id: string): Promise<any> => {
    const res = await httpClient.get(`/bulk/grupos/${id}`);
    return (res.data?.data ?? res.data) as any;
  },

  listEstudiantesBulk: async (): Promise<any[]> => {
    const res = await httpClient.get('/bulk/estudiantes');
    return (res.data?.data ?? res.data) as any[];
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
    const res = await httpClient.post('/bulk/estudiantes', data);
    return (res.data?.data ?? res.data) as any;
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
    const res = await httpClient.post('/bulk/grupos', data);
    return (res.data?.data ?? res.data) as any;
  },

  updateGrupo: async (id: string, data: any): Promise<any> => {
    const res = await httpClient.put(`/bulk/grupos/${id}`, data);
    return (res.data?.data ?? res.data) as any;
  },

  deleteGrupo: async (id: string): Promise<{ ok: boolean; id: string }> => {
    const res = await httpClient.delete(`/bulk/grupos/${id}`);
    return (res.data?.data ?? res.data) as any;
  },

  updateEstudianteBulk: async (id: number, data: any): Promise<any> => {
    const res = await httpClient.put(`/bulk/estudiantes/${id}`, data);
    return (res.data?.data ?? res.data) as any;
  },

  deleteEstudianteBulk: async (id: number): Promise<any> => {
    const res = await httpClient.delete(`/bulk/estudiantes/${id}`);
    return (res.data?.data ?? res.data) as any;
  },

  assignEstudiantesToGrupo: async (
    grupoId: string,
    estudianteBulkIds: number[] = [],
    estudianteIds: number[] = []
  ): Promise<any> => {
    const res = await httpClient.post(`/bulk/grupos/${grupoId}/estudiantes`, {
      estudiante_bulk_ids: estudianteBulkIds,
      estudiante_ids: estudianteIds,
    });
    return (res.data?.data ?? res.data) as any;
  },

  unassignEstudiantes: async (
    estudianteBulkIds: number[] = [],
    estudianteIds: number[] = []
  ): Promise<any> => {
    const res = await httpClient.post('/bulk/estudiantes/unassign', {
      estudiante_bulk_ids: estudianteBulkIds,
      estudiante_ids: estudianteIds,
    });
    return (res.data?.data ?? res.data) as any;
  },
};
