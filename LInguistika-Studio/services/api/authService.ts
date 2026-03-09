// services/api/authService.ts
import { httpClient, TokenManager } from './apiClient';

export const authService = {
  getToken: () => TokenManager.getToken(),
  setToken: (t: string) => TokenManager.setToken(t),
  clear: () => TokenManager.clearToken(),

  login: async (email: string, password: string): Promise<{ token: string; user: any }> => {
    const res = await httpClient.post('/auth/login', { email, password });
    return res.data as any;
  },
  logout: async (): Promise<{ message: string }> => {
    const res = await httpClient.post('/auth/logout');
    return res.data as any;
  },
  me: async (): Promise<{ user: any }> => {
    const res = await httpClient.get('/auth/me');
    return res.data as any;
  },
};
