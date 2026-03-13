import { useCallback, useState } from 'react';
import { matriculasService } from '../services/api/matriculasService';
import { useAsyncList } from './useAsyncList';
import type { Matricula } from '../types';

function extractMessage(error: unknown): string {
  if (error && typeof error === 'object') {
    const e = error as Record<string, unknown>;
    const data = (e?.response as Record<string, unknown> | undefined)?.data as Record<string, unknown> | undefined;
    return (data?.message ?? data?.error ?? e?.message ?? 'Error inesperado') as string;
  }
  return 'Error inesperado';
}

/**
 * Gestiona matrículas con operaciones CRUD.
 *
 * @example
 * const { matriculas, loading, createMatricula, deleteMatricula } = useMatriculas();
 */
export function useMatriculas() {
  const { data: matriculas, loading, error, refresh } = useAsyncList<Matricula>(matriculasService.getAll, {
    realtimeTable: ['matriculas', 'matriculas_grupo'],
    cacheKey: 'matriculas:list',
  });

  const [mutating, setMutating] = useState(false);
  const [mutationError, setMutationError] = useState<string | null>(null);

  const createMatricula = useCallback(async (data: Partial<Matricula>): Promise<Matricula | undefined> => {
    setMutating(true);
    setMutationError(null);
    try {
      const created = await matriculasService.create(data);
      await refresh();
      return created;
    } catch (err) {
      setMutationError(extractMessage(err));
      throw err;
    } finally {
      setMutating(false);
    }
  }, [refresh]);

  const updateMatricula = useCallback(async (id: number, data: Partial<Matricula>): Promise<Matricula | undefined> => {
    setMutating(true);
    setMutationError(null);
    try {
      const updated = await matriculasService.update(id, data);
      await refresh();
      return updated;
    } catch (err) {
      setMutationError(extractMessage(err));
      throw err;
    } finally {
      setMutating(false);
    }
  }, [refresh]);

  const deleteMatricula = useCallback(async (id: number): Promise<boolean> => {
    setMutating(true);
    setMutationError(null);
    try {
      await matriculasService.delete(id);
      await refresh();
      return true;
    } catch (err) {
      setMutationError(extractMessage(err));
      throw err;
    } finally {
      setMutating(false);
    }
  }, [refresh]);

  const createFromBulkGrupo = useCallback(async (
    matricula_grupo_id: string,
    grupo_nombre?: string | null
  ): Promise<unknown> => {
    setMutating(true);
    setMutationError(null);
    try {
      const result = await matriculasService.createFromBulkGrupo(matricula_grupo_id, grupo_nombre);
      await refresh();
      return result;
    } catch (err) {
      setMutationError(extractMessage(err));
      throw err;
    } finally {
      setMutating(false);
    }
  }, [refresh]);

  return {
    matriculas,
    loading,
    error,
    mutating,
    mutationError,
    createMatricula,
    updateMatricula,
    deleteMatricula,
    createFromBulkGrupo,
    refresh,
  };
}
