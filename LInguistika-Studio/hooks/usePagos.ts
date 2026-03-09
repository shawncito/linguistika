import { useCallback, useState } from 'react';
import { pagosService } from '../services/api/pagosService';
import { useAsyncList } from './useAsyncList';
import type { Pago } from '../types';

function extractMessage(error: unknown): string {
  if (error && typeof error === 'object') {
    const e = error as Record<string, unknown>;
    const data = (e?.response as Record<string, unknown> | undefined)?.data as Record<string, unknown> | undefined;
    return (data?.message ?? data?.error ?? e?.message ?? 'Error inesperado') as string;
  }
  return 'Error inesperado';
}

/**
 * Gestiona pagos: lista completa + creación + helpers de pagos pendientes.
 *
 * @example
 * const { pagos, loading, createPago, getPendientesResumenTutores } = usePagos();
 */
export function usePagos() {
  const { data: pagos, loading, error, refresh } = useAsyncList<Pago>(pagosService.getAll);

  const [mutating, setMutating] = useState(false);
  const [mutationError, setMutationError] = useState<string | null>(null);

  const createPago = useCallback(async (data: Partial<Pago>): Promise<Pago | undefined> => {
    setMutating(true);
    setMutationError(null);
    try {
      const created = await pagosService.create(data);
      await refresh();
      return created;
    } catch (err) {
      setMutationError(extractMessage(err));
      throw err;
    } finally {
      setMutating(false);
    }
  }, [refresh]);

  const getPendientesResumenTutores = useCallback(async () => {
    return pagosService.getPendientesResumenTutores();
  }, []);

  const getPendientesResumenEstudiantes = useCallback(async () => {
    return pagosService.getPendientesResumenEstudiantes();
  }, []);

  const getPendientesSesiones = useCallback(async (params?: {
    q?: string;
    tutor_id?: number;
    estudiante_id?: number;
    fecha_inicio?: string;
    fecha_fin?: string;
    limit?: number;
  }) => {
    return pagosService.getPendientesSesiones(params);
  }, []);

  return {
    pagos,
    loading,
    error,
    mutating,
    mutationError,
    createPago,
    getPendientesResumenTutores,
    getPendientesResumenEstudiantes,
    getPendientesSesiones,
    refresh,
  };
}
