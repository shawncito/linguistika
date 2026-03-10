import { useCallback, useState } from 'react';
import { cursosService } from '../services/api/cursosService';
import { tutoresService } from '../services/api/tutoresService';
import { useAsyncList } from './useAsyncList';
import type { Curso, Tutor } from '../types';

function extractMessage(error: unknown): string {
  if (error && typeof error === 'object') {
    const e = error as Record<string, unknown>;
    const data = (e?.response as Record<string, unknown> | undefined)?.data as Record<string, unknown> | undefined;
    return (data?.message ?? data?.error ?? e?.message ?? 'Error inesperado') as string;
  }
  return 'Error inesperado';
}

/**
 * Gestiona el estado de cursos y tutores (necesarios para el formulario de curso).
 * Expone operaciones CRUD con manejo de errores integrado.
 *
 * @example
 * const { cursos, tutores, loading, error, createCurso, updateCurso, deleteCurso, refresh } = useCursos();
 */
export function useCursos() {
  const {
    data: cursos,
    loading,
    error,
    refresh,
  } = useAsyncList<Curso>(cursosService.getAll, { realtimeTable: 'cursos' });

  const {
    data: tutores,
    loading: loadingTutores,
    refresh: refreshTutores,
  } = useAsyncList<Tutor>(tutoresService.getAll, { realtimeTable: 'tutores' });

  const [mutating, setMutating] = useState(false);
  const [mutationError, setMutationError] = useState<string | null>(null);

  const createCurso = useCallback(async (data: Partial<Curso>): Promise<Curso | undefined> => {
    setMutating(true);
    setMutationError(null);
    try {
      const created = await cursosService.create(data);
      await refresh();
      return created;
    } catch (err) {
      // Re-throw so caller can inspect raw error (e.g. 409 conflict codes)
      setMutationError(extractMessage(err));
      throw err;
    } finally {
      setMutating(false);
    }
  }, [refresh]);

  const updateCurso = useCallback(async (id: number, data: Partial<Curso>): Promise<Curso | undefined> => {
    setMutating(true);
    setMutationError(null);
    try {
      const updated = await cursosService.update(id, data);
      await refresh();
      return updated;
    } catch (err) {
      setMutationError(extractMessage(err));
      throw err;
    } finally {
      setMutating(false);
    }
  }, [refresh]);

  const deleteCurso = useCallback(async (id: number, cascade = false): Promise<boolean> => {
    setMutating(true);
    setMutationError(null);
    try {
      if (cascade) {
        await cursosService.deleteCascade(id);
      } else {
        await cursosService.delete(id);
      }
      await refresh();
      return true;
    } catch (err) {
      setMutationError(extractMessage(err));
      throw err;
    } finally {
      setMutating(false);
    }
  }, [refresh]);

  const refreshAll = useCallback(async () => {
    await Promise.all([refresh(), refreshTutores()]);
  }, [refresh, refreshTutores]);

  return {
    cursos,
    tutores,
    loading: loading || loadingTutores,
    error,
    mutating,
    mutationError,
    createCurso,
    updateCurso,
    deleteCurso,
    refresh: refreshAll,
  };
}
