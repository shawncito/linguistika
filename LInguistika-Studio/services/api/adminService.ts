// services/api/adminService.ts
import { httpClient } from './apiClient';

export type PaginaMantenimiento = {
  slug: string;
  nombre: string;
  activa: boolean;
  desactivada_por: string | null;
  desactivada_por_nombre: string | null;
  mensaje: string | null;
  updated_at: string;
};

export const adminService = {
  crearEmpleado: async (data: {
    email: string;
    password: string;
    rol: 'admin' | 'contador' | 'tutor_view_only';
    nombre_completo?: string | null;
    telefono?: string | null;
  }): Promise<any> => {
    const res = await httpClient.post('/admin/crear-empleado', {
      email: data.email,
      password: data.password,
      rol: data.rol,
      nombre_completo: data.nombre_completo ?? null,
      telefono: data.telefono ?? null,
    });
    return res.data as any;
  },

  listarEmpleados: async (): Promise<any[]> => {
    const res = await httpClient.get('/admin/empleados');
    return res.data as any[];
  },

  actualizarEmpleado: async (
    id: string,
    data: {
      rol?: 'admin' | 'contador' | 'tutor_view_only';
      estado?: boolean;
      nombre_completo?: string | null;
      telefono?: string | null;
    }
  ): Promise<any> => {
    const res = await httpClient.patch(`/admin/empleados/${id}`, data);
    return res.data as any;
  },

  eliminarEmpleado: async (id: string): Promise<{ ok: boolean; id: string }> => {
    const res = await httpClient.delete(`/admin/empleados/${id}`);
    return res.data as any;
  },

  listarPaginas: async (): Promise<PaginaMantenimiento[]> => {
    const res = await httpClient.get('/admin/paginas');
    return res.data as PaginaMantenimiento[];
  },

  togglePagina: async (
    slug: string,
    data: { activa: boolean; mensaje?: string | null }
  ): Promise<PaginaMantenimiento> => {
    const res = await httpClient.patch(`/admin/paginas/${slug}`, data);
    return res.data as PaginaMantenimiento;
  },
};
