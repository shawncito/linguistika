// services/api/activityService.ts
import { httpClient } from './apiClient';

export const activityService = {
  list: async (params?: {
    limit?: number;
    offset?: number;
    q?: string;
  }): Promise<{ items: any[]; count: number | null; limit: number; offset: number }> => {
    const res = await httpClient.get('/activity', { params });
    return res.data as any;
  },
};
