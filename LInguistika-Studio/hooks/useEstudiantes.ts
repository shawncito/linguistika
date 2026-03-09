import { useCallback, useState } from 'react';
import { estudiantesService } from '../services/api/estudiantesService';
import { useAsyncList } from './useAsyncList';
import type { Estudiante } from '../types';

function extractMessage(error: unknown): string {
  if (error && typeof error === 'object') {
    const e = error as Record<string, unknown>;
    const data = (e?.response as Record<string, unknown> | undefined)?.data as Record<string, unknown> | undefined;
    return (data?.message ?? data?.error ?? e?.message ?? 'Error inesperado') as string;
  }
  return 'Error inesperado';
}

/**
 * Gestiona el estado de estudiantes con operaciones CRUD.
 *
 * @example
 * const { estudiantes, loading, createEstudiante, updateEstudiante, deleteEstudiante } = useEstudiantes();
 */
export function useEstudiantes() {
  const { data: estudiantes, loading, error, refresh } = useAsyncList<Estudiante>(estudiantesService.getAll);

  const [mutating, setMutating] = useState(false);
  const [mutationError, setMutationError] = useState<string | null>(null);

  const createEstudiante = useCallback(async (data: Partial<Estudiante>): Promise<Estudiante | undefined> => {
    setMutating(true);
    setMutationError(null);
    try {
      const created = await estudiantesService.create(data);
      await refresh();
      return created;
    } catch (err) {
      setMutationError(extractMessage(err));
      throw err;
    } finally {
      setMutating(false);
    }
  }, [refresh]);

  const updateEstudiante = useCallback(async (id: number, data: Partial<Estudiante>): Promise<Estudiante | undefined> => {
    setMutating(true);
    setMutationError(null);
    try {
      const updated = await estudiantesService.update(id, data);
      await refresh();
      return updated;
    } catch (err) {
      setMutationError(extractMessage(err));
      throw err;
    } finally {
      setMutating(false);
    }
  }, [refresh]);

  const deleteEstudiante = useCallback(async (id: number): Promise<boolean> => {
    setMutating(true);
    setMutationError(null);
    try {
      await estudiantesService.delete(id);
      await refresh();
      return true;
    } catch (err) {
      setMutationError(extractMessage(err));
      throw err;
    } finally {
      setMutating(false);
    }
  }, [refresh]);

  return {
    estudiantes,
    loading,
    error,
    mutating,
    mutationError,
    createEstudiante,
    updateEstudiante,
    deleteEstudiante,
    refresh,
  };
}
