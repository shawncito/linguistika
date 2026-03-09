import { useCallback, useState } from 'react';
import { tutoresService } from '../services/api/tutoresService';
import { useAsyncList } from './useAsyncList';
import type { Tutor } from '../types';

function extractMessage(error: unknown): string {
  if (error && typeof error === 'object') {
    const e = error as Record<string, unknown>;
    const data = (e?.response as Record<string, unknown> | undefined)?.data as Record<string, unknown> | undefined;
    return (data?.message ?? data?.error ?? e?.message ?? 'Error inesperado') as string;
  }
  return 'Error inesperado';
}

/**
 * Gestiona el estado de tutores con operaciones CRUD y manejo de errores.
 *
 * @example
 * const { tutores, loading, error, createTutor, updateTutor, deleteTutor, refresh } = useTutores();
 */
export function useTutores() {
  const { data: tutores, loading, error, refresh } = useAsyncList<Tutor>(tutoresService.getAll);

  const [mutating, setMutating] = useState(false);
  const [mutationError, setMutationError] = useState<string | null>(null);

  const createTutor = useCallback(async (data: Partial<Tutor>): Promise<Tutor | undefined> => {
    setMutating(true);
    setMutationError(null);
    try {
      const created = await tutoresService.create(data);
      await refresh();
      return created;
    } catch (err) {
      setMutationError(extractMessage(err));
      throw err;
    } finally {
      setMutating(false);
    }
  }, [refresh]);

  const updateTutor = useCallback(async (id: number, data: Partial<Tutor>): Promise<Tutor | undefined> => {
    setMutating(true);
    setMutationError(null);
    try {
      const updated = await tutoresService.update(id, data);
      await refresh();
      return updated;
    } catch (err) {
      setMutationError(extractMessage(err));
      throw err;
    } finally {
      setMutating(false);
    }
  }, [refresh]);

  const deleteTutor = useCallback(async (id: number): Promise<boolean> => {
    setMutating(true);
    setMutationError(null);
    try {
      await tutoresService.delete(id);
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
    tutores,
    loading,
    error,
    mutating,
    mutationError,
    createTutor,
    updateTutor,
    deleteTutor,
    refresh,
  };
}
