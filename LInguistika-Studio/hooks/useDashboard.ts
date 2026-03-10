import { useCallback, useRef, useState } from 'react';
import { dashboardService } from '../services/api/dashboardService';
import { useRealtimeSubscription } from './useRealtimeSubscription';
import type { Clase, Stats } from '../types';

/**
 * Gestiona datos del dashboard: estadísticas generales, agenda del día y resúmenes.
 * Se suscribe a cambios en tiempo real para actualizar automáticamente.
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

  const statsLoaded = useRef(false);
  const agendaLoaded = useRef(false);

  const refreshStats = useCallback(async () => {
    setLoadingStats(!statsLoaded.current);
    setStatsError(null);
    try {
      const data = await dashboardService.getStats();
      statsLoaded.current = true;
      setStats(data);
    } catch (err) {
      setStatsError(extractMessage(err));
    } finally {
      setLoadingStats(false);
    }
  }, []);

  const refreshAgenda = useCallback(async (fecha: string) => {
    setLoadingAgenda(!agendaLoaded.current);
    setAgendaError(null);
    try {
      const data = await dashboardService.getAgenda(fecha);
      agendaLoaded.current = true;
      setAgenda(data);
    } catch (err) {
      setAgendaError(extractMessage(err));
    } finally {
      setLoadingAgenda(false);
    }
  }, []);

  // Suscripción realtime — actualiza stats y agenda automáticamente
  useRealtimeSubscription(
    ['matriculas', 'sesiones_clases', 'clases', 'cursos', 'estudiantes', 'tutores', 'movimientos_dinero'],
    refreshStats,
  );

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
