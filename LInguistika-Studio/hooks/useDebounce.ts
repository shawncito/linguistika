import { useEffect, useState } from 'react';

/**
 * Retrasa la actualización de un valor hasta que el usuario deje de escribir.
 * Útil para búsquedas por texto que disparan llamadas a la API.
 *
 * @example
 * const debouncedSearch = useDebounce(search, 300);
 * useEffect(() => { fetchData(debouncedSearch); }, [debouncedSearch]);
 */
export function useDebounce<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}
