import { useCallback, useEffect, useRef, useState } from 'react';

export interface AsyncListState<T> {
  data: T[];
  loading: boolean;
  error: string | null;
}

function extractMessage(error: unknown): string {
  if (error && typeof error === 'object') {
    const e = error as Record<string, unknown>;
    const data = (e?.response as Record<string, unknown> | undefined)?.data as Record<string, unknown> | undefined;
    return (data?.message ?? data?.error ?? e?.message ?? 'Error al cargar datos') as string;
  }
  return 'Error al cargar datos';
}

/**
 * Hook genérico para cargar y gestionar una lista de recursos desde la API.
 * Encapsula: fetch inicial, loading, error, y refresco manual.
 *
 * @example
 * const { data: cursos, loading, error, refresh } = useAsyncList(cursosService.getAll);
 */
export function useAsyncList<T>(
  fetchFn: () => Promise<T[]>,
  { immediate = true }: { immediate?: boolean } = {}
) {
  const [state, setState] = useState<AsyncListState<T>>({
    data: [],
    loading: immediate,
    error: null,
  });

  const fetchFnRef = useRef(fetchFn);
  fetchFnRef.current = fetchFn;

  const refresh = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    try {
      const data = await fetchFnRef.current();
      setState({ data, loading: false, error: null });
    } catch (err) {
      setState(prev => ({ ...prev, loading: false, error: extractMessage(err) }));
    }
  }, []);

  useEffect(() => {
    if (immediate) {
      refresh();
    }
  }, [immediate, refresh]);

  return { ...state, refresh };
}
