// services/api/paginasService.ts
import { httpClient } from './apiClient';

export type PaginaEstado = {
  slug: string;
  nombre: string;
  activa: boolean;
  mensaje: string | null;
};

// Cache en memoria para evitar llamadas repetidas durante la misma sesión
let _cache: PaginaEstado[] | null = null;
let _cacheTime = 0;
const CACHE_TTL_MS = 30_000; // 30 segundos

export const paginasService = {
  getPaginasEstado: async (): Promise<PaginaEstado[]> => {
    const now = Date.now();
    if (_cache && now - _cacheTime < CACHE_TTL_MS) return _cache;
    const res = await httpClient.get('/paginas-estado');
    _cache = res.data as PaginaEstado[];
    _cacheTime = now;
    return _cache;
  },

  /** Invalida el caché (llamar después de un toggle admin). */
  invalidate: () => {
    _cache = null;
    _cacheTime = 0;
  },
};
