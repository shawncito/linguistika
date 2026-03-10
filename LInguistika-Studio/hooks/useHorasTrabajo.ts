import { useCallback, useState } from 'react';
import { horasTrabajoService } from '../services/api/horasTrabajoService';
import { useAsyncList } from './useAsyncList';
import type { HorasTrabajo } from '../types';

function extractMessage(error: unknown): string {
  if (error && typeof error === 'object') {
    const e = error as Record<string, unknown>;
    const data = (e?.response as Record<string, unknown> | undefined)?.data as Record<string, unknown> | undefined;
    return (data?.message ?? data?.error ?? e?.message ?? 'Error inesperado') as string;
  }
  return 'Error inesperado';
}

type CreateHorasData = Partial<HorasTrabajo> & {
  tutor_id: number;
  fecha: string;
  horas: number;
  clase_id?: number | null;
  notas?: string | null;
};

/**
 * Gestiona horas de trabajo: lista, creación, actualización y aprobación.
 *
 * @example
 * const { horasTrabajo, loading, createHoras, aprobarHoras, refresh } = useHorasTrabajo();
 */
export function useHorasTrabajo(params?: { fecha?: string; tutor_id?: number; estado?: string }) {
  const fetchFn = useCallback(() => horasTrabajoService.getAll(params), [
    params?.fecha,
    params?.tutor_id,
    params?.estado,
  ]);

  const { data: horasTrabajo, loading, error, refresh } = useAsyncList<HorasTrabajo>(fetchFn, { realtimeTable: 'horas_trabajo' });

  const [mutating, setMutating] = useState(false);
  const [mutationError, setMutationError] = useState<string | null>(null);

  const createHoras = useCallback(async (data: CreateHorasData): Promise<HorasTrabajo | undefined> => {
    setMutating(true);
    setMutationError(null);
    try {
      const created = await horasTrabajoService.create(data);
      await refresh();
      return created;
    } catch (err) {
      setMutationError(extractMessage(err));
      throw err;
    } finally {
      setMutating(false);
    }
  }, [refresh]);

  const updateHoras = useCallback(async (id: number, data: Partial<HorasTrabajo>): Promise<HorasTrabajo | undefined> => {
    setMutating(true);
    setMutationError(null);
    try {
      const updated = await horasTrabajoService.update(id, data);
      await refresh();
      return updated;
    } catch (err) {
      setMutationError(extractMessage(err));
      throw err;
    } finally {
      setMutating(false);
    }
  }, [refresh]);

  const aprobarHoras = useCallback(async (id: number) => {
    setMutating(true);
    setMutationError(null);
    try {
      const result = await horasTrabajoService.aprobar(id);
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
    horasTrabajo,
    loading,
    error,
    mutating,
    mutationError,
    createHoras,
    updateHoras,
    aprobarHoras,
    refresh,
  };
}
