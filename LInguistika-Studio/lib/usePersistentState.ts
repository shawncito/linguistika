import { Dispatch, SetStateAction, useEffect, useMemo, useState } from 'react';

type PersistEnvelope<T> = {
  v: number;
  value: T;
};

type Options<T> = {
  version?: number;
  /**
   * Por defecto usa localStorage. Si no existe (o falla), se comporta como useState normal.
   */
  storage?: Storage | null;
  /**
   * Si cambia la versión, se resetea al defaultValue.
   */
  resetOnVersionMismatch?: boolean;
  /**
   * Permite validar/normalizar valores leídos del storage.
   */
  validate?: (value: unknown) => value is T;
};

function getDefaultStorage(): Storage | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}

function safeRead<T>(storage: Storage | null, key: string): unknown {
  try {
    if (!storage) return undefined;
    const raw = storage.getItem(key);
    if (!raw) return undefined;
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

function safeWrite(storage: Storage | null, key: string, value: unknown): void {
  try {
    if (!storage) return;
    storage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore
  }
}

/**
 * Guarda el estado en localStorage (u otro storage).
 * Útil para recordar filtros/vistas aunque cierres y abras la app.
 */
export function usePersistentState<T>(
  key: string,
  defaultValue: T | (() => T),
  options?: Options<T>
): [T, Dispatch<SetStateAction<T>>] {
  const version = options?.version ?? 1;
  const storage = options?.storage ?? getDefaultStorage();
  const resetOnVersionMismatch = options?.resetOnVersionMismatch ?? true;

  const resolvedDefault = useMemo(() => {
    return typeof defaultValue === 'function' ? (defaultValue as any)() : defaultValue;
  }, []); // intencional: default solo se evalúa 1 vez

  const [state, setState] = useState<T>(() => {
    const raw = safeRead<T>(storage, key);
    if (raw == null) return resolvedDefault;

    // Soporta valores antiguos guardados como JSON plano
    // y valores nuevos guardados como {v, value}.
    const asObj = raw as any;
    if (asObj && typeof asObj === 'object' && 'value' in asObj && 'v' in asObj) {
      const env = asObj as PersistEnvelope<unknown>;
      if (resetOnVersionMismatch && Number(env.v) !== version) return resolvedDefault;
      const val = env.value;
      if (options?.validate && !options.validate(val)) return resolvedDefault;
      return val as T;
    }

    if (options?.validate && !options.validate(raw)) return resolvedDefault;
    return raw as T;
  });

  useEffect(() => {
    safeWrite(storage, key, { v: version, value: state } satisfies PersistEnvelope<T>);
  }, [key, state, storage, version]);

  return [state, setState];
}
