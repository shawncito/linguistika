// services/api/apiClient.ts
// Shared axios instance + token manager for all feature services.
// Views continue to import from '../services/api' (the original monolith is preserved).
// This module is used internally by the per-feature service files under services/api/.
import axios from 'axios';

const TOKEN_KEY = 'linguistika_token';
let memoryToken: string | null = null;

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
  'http://localhost:5000/api';

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
  return config;
});

httpClient.interceptors.response.use(
  (res) => res,
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
      if (typeof window !== 'undefined' && window.location.hash !== '#/login') {
        window.location.hash = '#/login';
      }
    }
    return Promise.reject(err);
  }
);
