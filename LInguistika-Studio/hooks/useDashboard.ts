import { useCallback, useState } from 'react';
import { dashboardService } from '../services/api/dashboardService';
import type { Clase, Stats } from '../types';

/**
 * Gestiona datos del dashboard: estadísticas generales, agenda del día y resúmenes.
 *
 * @example
 * const { stats, agenda, loadingStats, loadingAgenda, refreshStats, refreshAgenda } = useDashboard(fecha);
 */
export function useDashboard(fechaInicial?: string) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const [statsError, setStatsError] = useState<string | null>(null);

  const [agenda, setAgenda] = useState<Clase[]>([]);
  const [loadingAgenda, setLoadingAgenda] = useState(false);
  const [agendaError, setAgendaError] = useState<string | null>(null);

  const refreshStats = useCallback(async () => {
    setLoadingStats(true);
    setStatsError(null);
    try {
      const data = await dashboardService.getStats();
      setStats(data);
    } catch (err) {
      setStatsError(extractMessage(err));
    } finally {
      setLoadingStats(false);
    }
  }, []);

  const refreshAgenda = useCallback(async (fecha: string) => {
    setLoadingAgenda(true);
    setAgendaError(null);
    try {
      const data = await dashboardService.getAgenda(fecha);
      setAgenda(data);
    } catch (err) {
      setAgendaError(extractMessage(err));
    } finally {
      setLoadingAgenda(false);
    }
  }, []);

  const completarSesion = useCallback(async (matriculaId: number, fecha: string) => {
    return dashboardService.completarSesion(matriculaId, fecha);
  }, []);

  const cancelarSesionDia = useCallback(async (matriculaId: number, fecha: string, motivo?: string) => {
    return dashboardService.cancelarSesionDia(matriculaId, fecha, motivo);
  }, []);

  const getResumenTutores = useCallback(async (fecha: string) => {
    return dashboardService.getResumenTutores(fecha);
  }, []);

  const getResumenTutoresEstudiantes = useCallback(async () => {
    return dashboardService.getResumenTutoresEstudiantes();
  }, []);

  const getResumenCursosGrupos = useCallback(async () => {
    return dashboardService.getResumenCursosGrupos();
  }, []);

  return {
    stats,
    agenda,
    loadingStats,
    loadingAgenda,
    statsError,
    agendaError,
    fechaInicial,
    refreshStats,
    refreshAgenda,
    completarSesion,
    cancelarSesionDia,
    getResumenTutores,
    getResumenTutoresEstudiantes,
    getResumenCursosGrupos,
  };
}

function extractMessage(error: unknown): string {
  if (error && typeof error === 'object') {
    const e = error as Record<string, unknown>;
    const data = (e?.response as Record<string, unknown> | undefined)?.data as Record<string, unknown> | undefined;
    return (data?.message ?? data?.error ?? e?.message ?? 'Error inesperado') as string;
  }
  return 'Error inesperado';
}
