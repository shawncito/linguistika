import { useCallback, useEffect, useState } from 'react';
import { authService } from '../services/api/authService';

export interface AuthUser {
  id: number | string;
  username?: string;
  email?: string;
  rol?: string;
  estado?: number;
  [key: string]: unknown;
}

/**
 * Gestiona el estado de autenticación del usuario actual.
 * Lee el token de TokenManager al montar y expone login/logout.
 *
 * @example
 * const { user, isAuthenticated, login, logout } = useAuth();
 */
export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Re-validate current session on mount
  useEffect(() => {
    const token = authService.getToken();
    if (!token) {
      setLoading(false);
      return;
    }
    authService
      .me()
      .then(res => {
        setUser(res.user as AuthUser);
      })
      .catch(() => {
        authService.clear();
      })
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setError(null);
    setLoading(true);
    try {
      const { token, user: loggedUser } = await authService.login(email, password);
      authService.setToken(token);
      setUser(loggedUser as AuthUser);
    } catch (err) {
      const msg = extractMessage(err);
      setError(msg);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await authService.logout();
    } catch {
      // ignore network errors on logout
    } finally {
      authService.clear();
      setUser(null);
    }
  }, []);

  return {
    user,
    isAuthenticated: user !== null,
    loading,
    error,
    login,
    logout,
  };
}

function extractMessage(error: unknown): string {
  if (error && typeof error === 'object') {
    const e = error as Record<string, unknown>;
    const data = (e?.response as Record<string, unknown> | undefined)?.data as Record<string, unknown> | undefined;
    return (data?.message ?? data?.error ?? e?.message ?? 'Credenciales inválidas') as string;
  }
  return 'Error de autenticación';
}
