import { useCallback, useState } from 'react';
import { tesoreriaService } from '../services/api/tesoreriaService';

/**
 * Gestiona el estado de tesorería: resúmenes, movimientos diarios y pagos a encargados/tutores.
 * Expone los datos más usados con `refresh` manual.
 *
 * @example
 * const { resumen, loadingResumen, refreshResumen, registrarPagoEncargado } = useTesoreria();
 */
export function useTesoreria() {
  const [resumen, setResumen] = useState<unknown>(null);
  const [loadingResumen, setLoadingResumen] = useState(false);
  const [resumenError, setResumenError] = useState<string | null>(null);

  const [mutating, setMutating] = useState(false);
  const [mutationError, setMutationError] = useState<string | null>(null);

  const refreshResumen = useCallback(async () => {
    setLoadingResumen(true);
    setResumenError(null);
    try {
      const data = await tesoreriaService.getResumen();
      setResumen(data);
    } catch (err) {
      setResumenError(extractMessage(err));
    } finally {
      setLoadingResumen(false);
    }
  }, []);

  const getDiario = useCallback(async (params: Parameters<typeof tesoreriaService.getDiario>[0]) => {
    return tesoreriaService.getDiario(params);
  }, []);

  const getEncargadosResumen = useCallback(async () => {
    return tesoreriaService.getEncargadosResumen();
  }, []);

  const getTutoresResumen = useCallback(async () => {
    return tesoreriaService.getTutoresResumen();
  }, []);

  const getBolsa = useCallback(async () => {
    return tesoreriaService.getBolsa();
  }, []);

  const registrarPagoEncargado = useCallback(async (
    encargadoId: number,
    data: Parameters<typeof tesoreriaService.registrarPagoEncargado>[1]
  ) => {
    setMutating(true);
    setMutationError(null);
    try {
      const result = await tesoreriaService.registrarPagoEncargado(encargadoId, data);
      return result;
    } catch (err) {
      setMutationError(extractMessage(err));
      throw err;
    } finally {
      setMutating(false);
    }
  }, []);

  const registrarPagoTutor = useCallback(async (
    tutorId: number,
    data: Parameters<typeof tesoreriaService.registrarPagoTutor>[1]
  ) => {
    setMutating(true);
    setMutationError(null);
    try {
      const result = await tesoreriaService.registrarPagoTutor(tutorId, data);
      return result;
    } catch (err) {
      setMutationError(extractMessage(err));
      throw err;
    } finally {
      setMutating(false);
    }
  }, []);

  return {
    resumen,
    loadingResumen,
    resumenError,
    mutating,
    mutationError,
    refreshResumen,
    getDiario,
    getEncargadosResumen,
    getTutoresResumen,
    getBolsa,
    registrarPagoEncargado,
    registrarPagoTutor,
  };
}

function extractMessage(error: unknown): string {
  if (error && typeof error === 'object') {
    const e = error as Record<string, unknown>;
    const data = (e?.response as Record<string, unknown> | undefined)?.data as Record<string, unknown> | undefined;
    return (data?.message ?? data?.error ?? e?.message ?? 'Error inesperado') as string;
  }
  return 'Error inesperado';
}
