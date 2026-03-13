// services/api/apiClient.ts
// Shared axios instance + token manager for all feature services.
// Views continue to import from '../services/api' (the original monolith is preserved).
// This module is used internally by the per-feature service files under services/api/.
import axios from 'axios';
import type { AxiosRequestConfig, AxiosResponse } from 'axios';

const TOKEN_KEY = 'linguistika_token';
let memoryToken: string | null = null;
const DEFAULT_GET_CACHE_TTL_MS = 5000;
const MAX_GET_CACHE_ENTRIES = 150;

type CachedHttpResponse = Pick<AxiosResponse, 'data' | 'status' | 'statusText' | 'headers'>;

const getResponseCache = new Map<string, { expiresAt: number; response: CachedHttpResponse }>();
const inflightGetRequests = new Map<string, Promise<AxiosResponse>>();

function stableSerialize(value: unknown): unknown {
  if (value == null) return value;
  if (value instanceof Date) return value.toISOString();
  if (typeof URLSearchParams !== 'undefined' && value instanceof URLSearchParams) return value.toString();
  if (Array.isArray(value)) return value.map(stableSerialize);
  if (typeof value === 'object') {
    const source = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(source).sort()) {
      out[key] = stableSerialize(source[key]);
    }
    return out;
  }
  return value;
}

function stableStringify(value: unknown): string {
  try {
    return JSON.stringify(stableSerialize(value));
  } catch {
    return String(value);
  }
}

function clearGetCache(): void {
  getResponseCache.clear();
}

export function clearHttpGetCache(): void {
  clearGetCache();
}

function pruneGetCache(now = Date.now()): void {
  for (const [key, entry] of getResponseCache) {
    if (entry.expiresAt <= now) getResponseCache.delete(key);
  }
  while (getResponseCache.size > MAX_GET_CACHE_ENTRIES) {
    const oldestKey = getResponseCache.keys().next().value;
    if (!oldestKey) break;
    getResponseCache.delete(oldestKey);
  }
}

function buildRequestCacheKey(config: AxiosRequestConfig): string {
  const method = String(config.method || 'get').toUpperCase();
  const base = String(config.baseURL || '');
  const url = String(config.url || '');
  const fullUrl = /^https?:\/\//i.test(url) || /^file:\/\//i.test(url)
    ? url
    : `${base.replace(/\/+$/, '')}/${url.replace(/^\/+/, '')}`;
  const paramsPart = stableStringify(config.params ?? null);
  return `${method}|${fullUrl}|${paramsPart}`;
}

function canCacheGetRequest(config: AxiosRequestConfig): boolean {
  const method = String(config.method || 'get').toLowerCase();
  if (method !== 'get') return false;

  const headers = (config.headers || {}) as Record<string, unknown>;
  const skipHeader = String(headers['x-skip-cache'] ?? headers['X-Skip-Cache'] ?? '').toLowerCase();
  if (skipHeader === 'true') return false;
  if ((config as any).__skipCache === true) return false;

  // Evita cachear lecturas de sesión actual para no mostrar permisos obsoletos.
  const rawUrl = String(config.url || '').toLowerCase();
  if (rawUrl.includes('/auth/me')) return false;

  return true;
}

function resolveAdapter(adapterLike: AxiosRequestConfig['adapter'] | undefined): ((config: AxiosRequestConfig) => Promise<AxiosResponse>) | null {
  if (typeof adapterLike === 'function') {
    return adapterLike as (config: AxiosRequestConfig) => Promise<AxiosResponse>;
  }

  const axiosAny = axios as any;
  if (typeof axiosAny?.getAdapter === 'function') {
    try {
      const resolved = axiosAny.getAdapter(adapterLike ?? httpClient.defaults.adapter);
      if (typeof resolved === 'function') {
        return resolved as (config: AxiosRequestConfig) => Promise<AxiosResponse>;
      }
    } catch {
      return null;
    }
  }

  return null;
}

// ── Storage helpers ──────────────────────────────────────────────────────────

function safeGetItem(storage: Storage | null, key: string): string | null {
  try { return storage ? storage.getItem(key) : null; } catch { return null; }
}

function safeSetItem(storage: Storage | null, key: string, value: string): void {
  try { if (storage) storage.setItem(key, value); } catch { /* ignore */ }
}

function safeRemoveItem(storage: Storage | null, key: string): void {
  try { if (storage) storage.removeItem(key); } catch { /* ignore */ }
}

function getSessionStorage(): Storage | null {
  try { return typeof window !== 'undefined' ? window.sessionStorage : null; } catch { return null; }
}

function getLocalStorage(): Storage | null {
  try { return typeof window !== 'undefined' ? window.localStorage : null; } catch { return null; }
}

function normalizeToken(raw: unknown): string | null {
  if (raw == null) return null;
  let t = String(raw).trim();
  if (!t || t === 'null' || t === 'undefined') return null;
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) t = t.slice(1, -1).trim();
  return t || null;
}

function tryGetJwtExpMs(token: string): number | null {
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = b64 + '==='.slice((b64.length + 3) % 4);
    const payload = JSON.parse(atob(padded));
    const exp = Number(payload?.exp);
    return Number.isFinite(exp) ? exp * 1000 : null;
  } catch { return null; }
}

const ENABLE_CLIENT_TOKEN_EXPIRY = false;

function isTokenExpired(token: string, skewMs = 30_000): boolean {
  if (!ENABLE_CLIENT_TOKEN_EXPIRY) return false;
  const expMs = tryGetJwtExpMs(token);
  if (!expMs) return false;
  return Date.now() >= expMs - skewMs;
}

// ── TokenManager ─────────────────────────────────────────────────────────────

export const TokenManager = {
  getToken(): string | null {
    const ls = getLocalStorage();
    const ss = getSessionStorage();

    // Remove legacy localStorage token if present
    const legacy = normalizeToken(safeGetItem(ls, TOKEN_KEY));
    if (legacy) safeRemoveItem(ls, TOKEN_KEY);

    let token = normalizeToken(safeGetItem(ss, TOKEN_KEY));
    if (!token) token = normalizeToken(safeGetItem(ls, TOKEN_KEY));
    if (!token) token = normalizeToken(memoryToken);
    if (!token) return null;
    if (isTokenExpired(token)) { safeRemoveItem(ss, TOKEN_KEY); return null; }
    if (token.split('.').length < 3) return null;
    return token;
  },

  setToken(token: string): void {
    const ls = getLocalStorage();
    const ss = getSessionStorage();
    const normalized = normalizeToken(token);
    if (!normalized) { this.clearToken(); return; }
    safeSetItem(ss, TOKEN_KEY, normalized);
    const sessionOk = Boolean(safeGetItem(ss, TOKEN_KEY));
    if (!sessionOk) {
      safeSetItem(ls, TOKEN_KEY, normalized);
      memoryToken = Boolean(safeGetItem(ls, TOKEN_KEY)) ? null : normalized;
    } else {
      safeRemoveItem(ls, TOKEN_KEY);
      memoryToken = null;
    }
  },

  clearToken(): void {
    safeRemoveItem(getSessionStorage(), TOKEN_KEY);
    safeRemoveItem(getLocalStorage(), TOKEN_KEY);
    memoryToken = null;
  },
};

// ── Base URL ─────────────────────────────────────────────────────────────────

export const API_BASE_URL =
  (typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('api') : null) ||
  (typeof import.meta !== 'undefined' ? (import.meta as any).env?.VITE_API_URL : null) ||
  'http://localhost:5000/api/v1';

// ── Axios instance ────────────────────────────────────────────────────────────

export const httpClient = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

httpClient.interceptors.request.use((config) => {
  const token = TokenManager.getToken();
  if (token) {
    config.headers = (config.headers ?? {}) as any;
    (config.headers as any).Authorization = `Bearer ${token}`;
  }
  // Let browser set Content-Type (with boundary) for multipart FormData
  if (typeof FormData !== 'undefined' && config.data instanceof FormData) {
    config.headers = (config.headers ?? {}) as any;
    delete (config.headers as any)['Content-Type'];
    delete (config.headers as any)['content-type'];
  }

  const method = String(config.method || 'get').toLowerCase();
  if (method !== 'get') {
    clearGetCache();
    return config;
  }

  if (!canCacheGetRequest(config)) return config;

  const cacheKey = buildRequestCacheKey(config);
  (config as any).__cacheKey = cacheKey;

  const now = Date.now();
  const cached = getResponseCache.get(cacheKey);
  if (cached && cached.expiresAt > now) {
    config.adapter = async (adapterConfig) => ({
      data: cached.response.data,
      status: cached.response.status,
      statusText: cached.response.statusText,
      headers: cached.response.headers,
      config: adapterConfig ?? config,
      request: undefined,
    });
    return config;
  }
  if (cached && cached.expiresAt <= now) getResponseCache.delete(cacheKey);

  const execute = resolveAdapter(config.adapter ?? httpClient.defaults.adapter);
  if (!execute) return config;

  config.adapter = async (adapterConfig) => {
    const sharedRequest = inflightGetRequests.get(cacheKey);
    if (sharedRequest) {
      const sharedResponse = await sharedRequest;
      return { ...sharedResponse, config: adapterConfig };
    }

    const requestPromise = Promise.resolve(execute(adapterConfig)) as Promise<AxiosResponse>;
    inflightGetRequests.set(cacheKey, requestPromise);

    try {
      return await requestPromise;
    } finally {
      inflightGetRequests.delete(cacheKey);
    }
  };

  return config;
});

httpClient.interceptors.response.use(
  (res) => {
    const config = res.config || {};
    if (canCacheGetRequest(config)) {
      const cacheKey = (config as any).__cacheKey || buildRequestCacheKey(config);
      const ttlRaw = Number((config as any).__cacheTtlMs);
      const ttlMs = Number.isFinite(ttlRaw) ? Math.max(0, ttlRaw) : DEFAULT_GET_CACHE_TTL_MS;
      if (ttlMs > 0) {
        getResponseCache.set(cacheKey, {
          expiresAt: Date.now() + ttlMs,
          response: {
            data: res.data,
            status: res.status,
            statusText: res.statusText,
            headers: res.headers,
          },
        });
        pruneGetCache();
      }
    }
    return res;
  },
  (err) => {
    const status = err?.response?.status;
    const url = String(err?.config?.url || '');
    const msg = String(err?.response?.data?.error || '').toLowerCase();
    const isAuthMe = url.includes('/auth/me');

    if (
      status === 401 ||
      (status === 403 && isAuthMe && (msg.includes('no es empleado') || msg.includes('desactivado') || msg))
    ) {
      TokenManager.clearToken();
      clearGetCache();
      if (typeof window !== 'undefined' && window.location.hash !== '#/login') {
        window.location.hash = '#/login';
      }
    }
    return Promise.reject(err);
  }
);
