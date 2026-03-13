import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRealtimeSubscription } from './useRealtimeSubscription';

export interface AsyncListState<T> {
  data: T[];
  loading: boolean;
  error: string | null;
}

interface AsyncListOptions {
  immediate?: boolean;
  realtimeTable?: string | string[];
  cacheKey?: string;
  cacheMs?: number;
}

const DEFAULT_LIST_CACHE_MS = 120_000;
const MAX_LIST_CACHE_ENTRIES = 80;
const LIST_SNAPSHOT_STORAGE_PREFIX = 'asyncListSnapshot:';

type ListCacheEntry = {
  expiresAt: number;
  data: unknown[];
};

const listSnapshotCache = new Map<string, ListCacheEntry>();

function normalizeTablesKey(realtimeTable?: string | string[]): string {
  if (!realtimeTable) return '';
  const list = (Array.isArray(realtimeTable) ? realtimeTable : [realtimeTable])
    .map((table) => String(table || '').trim())
    .filter(Boolean)
    .sort();
  return list.join(',');
}

function resolveListCacheKey(realtimeTable?: string | string[], explicitKey?: string): string {
  const custom = String(explicitKey || '').trim();
  if (custom) return custom;
  const tablesKey = normalizeTablesKey(realtimeTable);
  if (tablesKey) return `rt:${tablesKey}`;
  return '';
}

function pruneListSnapshotCache(now = Date.now()): void {
  for (const [key, value] of listSnapshotCache) {
    if (value.expiresAt <= now) listSnapshotCache.delete(key);
  }
  while (listSnapshotCache.size > MAX_LIST_CACHE_ENTRIES) {
    const oldestKey = listSnapshotCache.keys().next().value;
    if (!oldestKey) break;
    listSnapshotCache.delete(oldestKey);
  }
}

function readPersistedList<T>(cacheKey: string): ListCacheEntry | null {
  if (!cacheKey || typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage?.getItem(`${LIST_SNAPSHOT_STORAGE_PREFIX}${cacheKey}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { expiresAt?: unknown; data?: unknown };
    const expiresAt = Number(parsed?.expiresAt);
    const data = parsed?.data;
    if (!Number.isFinite(expiresAt) || !Array.isArray(data)) {
      window.sessionStorage?.removeItem(`${LIST_SNAPSHOT_STORAGE_PREFIX}${cacheKey}`);
      return null;
    }
    if (expiresAt <= Date.now()) {
      window.sessionStorage?.removeItem(`${LIST_SNAPSHOT_STORAGE_PREFIX}${cacheKey}`);
      return null;
    }
    return { expiresAt, data };
  } catch {
    return null;
  }
}

function persistList(cacheKey: string, entry: ListCacheEntry): void {
  if (!cacheKey || typeof window === 'undefined') return;
  try {
    window.sessionStorage?.setItem(
      `${LIST_SNAPSHOT_STORAGE_PREFIX}${cacheKey}`,
      JSON.stringify(entry),
    );
  } catch {
    // ignore storage quota / serialization issues
  }
}

function getCachedList<T>(cacheKey: string): T[] | null {
  if (!cacheKey) return null;
  const now = Date.now();
  const hit = listSnapshotCache.get(cacheKey);
  if (!hit) return null;
  if (hit.expiresAt <= now) {
    listSnapshotCache.delete(cacheKey);
    return null;
  }
  return hit.data as T[];
}

function getCachedOrPersistedList<T>(cacheKey: string): T[] | null {
  const memoryHit = getCachedList<T>(cacheKey);
  if (memoryHit) return memoryHit;
  const persisted = readPersistedList<T>(cacheKey);
  if (!persisted) return null;
  listSnapshotCache.set(cacheKey, persisted);
  return persisted.data as T[];
}

function setCachedList<T>(cacheKey: string, data: T[], cacheMs: number): void {
  if (!cacheKey || !Number.isFinite(cacheMs) || cacheMs <= 0) return;
  const entry: ListCacheEntry = {
    expiresAt: Date.now() + cacheMs,
    data: data as unknown[],
  };
  listSnapshotCache.set(cacheKey, entry);
  persistList(cacheKey, entry);
  pruneListSnapshotCache();
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
 * Opcionalmente se suscribe a cambios en tiempo real de Supabase.
 *
 * @example
 * const { data: cursos, loading, error, refresh } = useAsyncList(cursosService.getAll, { realtimeTable: 'cursos' });
 */
export function useAsyncList<T>(
  fetchFn: () => Promise<T[]>,
  { immediate = true, realtimeTable, cacheKey, cacheMs = DEFAULT_LIST_CACHE_MS }: AsyncListOptions = {}
) {
  const resolvedCacheKey = useMemo(
    () => resolveListCacheKey(realtimeTable, cacheKey),
    [cacheKey, realtimeTable],
  );

  const initialCached = useMemo(
    () => getCachedOrPersistedList<T>(resolvedCacheKey),
    [resolvedCacheKey],
  );

  const [state, setState] = useState<AsyncListState<T>>({
    data: initialCached ?? [],
    loading: immediate && !initialCached,
    error: null,
  });

  const fetchFnRef = useRef(fetchFn);
  fetchFnRef.current = fetchFn;
  const hasLoaded = useRef(Boolean(initialCached));
  const pendingRef = useRef<Promise<T[]> | null>(null);

  useEffect(() => {
    const cached = getCachedOrPersistedList<T>(resolvedCacheKey);
    hasLoaded.current = Boolean(cached);
    pendingRef.current = null;
    setState({
      data: cached ?? [],
      loading: immediate && !cached,
      error: null,
    });
  }, [immediate, resolvedCacheKey]);

  const refresh = useCallback(async () => {
    // Deduplicate: if a fetch is already in-flight, reuse it
    if (pendingRef.current) {
      await pendingRef.current;
      return;
    }
    // Only show loading spinner on first load, not on realtime refreshes
    setState(prev => ({
      ...prev,
      loading: !hasLoaded.current && prev.data.length === 0,
      error: null,
    }));
    const promise = fetchFnRef.current();
    pendingRef.current = promise;
    try {
      const data = await promise;
      hasLoaded.current = true;
      setState({ data, loading: false, error: null });
      setCachedList<T>(resolvedCacheKey, data, cacheMs);
    } catch (err) {
      setState(prev => ({ ...prev, loading: false, error: extractMessage(err) }));
    } finally {
      pendingRef.current = null;
    }
  }, [cacheMs, resolvedCacheKey]);

  useEffect(() => {
    if (immediate) {
      void refresh();
    }
  }, [immediate, refresh, resolvedCacheKey]);

  // Realtime subscription — silently refreshes on DB changes
  useRealtimeSubscription(
    realtimeTable || [],
    refresh,
    !!realtimeTable,
  );

  return { ...state, refresh };
}
