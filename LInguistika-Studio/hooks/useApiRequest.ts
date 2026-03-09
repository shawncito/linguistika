import { useCallback, useRef, useState } from 'react';

export type RequestState<T> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: T }
  | { status: 'error'; message: string };

function extractMessage(error: unknown): string {
  if (error && typeof error === 'object') {
    const e = error as Record<string, unknown>;
    const data = e?.response as Record<string, unknown> | undefined;
    return (
      (data?.data as Record<string, string>)?.message ??
      (data?.data as Record<string, string>)?.error ??
      (e?.message as string) ??
      'Error inesperado'
    );
  }
  return 'Error inesperado';
}

/**
 * Hook genérico para ejecutar una operación asíncrona (mutación o consulta puntual)
 * con estado de carga, éxito y error.
 *
 * @example
 * const { state, execute } = useApiRequest(cursosService.create);
 * await execute({ nombre: 'Nuevo curso', ... });
 */
export function useApiRequest<TArgs extends unknown[], TResult>(
  fn: (...args: TArgs) => Promise<TResult>
) {
  const [state, setState] = useState<RequestState<TResult>>({ status: 'idle' });
  const fnRef = useRef(fn);
  fnRef.current = fn;

  const execute = useCallback(async (...args: TArgs): Promise<TResult | undefined> => {
    setState({ status: 'loading' });
    try {
      const data = await fnRef.current(...args);
      setState({ status: 'success', data });
      return data;
    } catch (err) {
      setState({ status: 'error', message: extractMessage(err) });
      return undefined;
    }
  }, []);

  const reset = useCallback(() => setState({ status: 'idle' }), []);

  return { state, execute, reset, isLoading: state.status === 'loading' };
}
