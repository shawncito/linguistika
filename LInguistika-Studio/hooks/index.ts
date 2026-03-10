// hooks/index.ts — barrel export
// Utility hooks
export { useDebounce } from './useDebounce';
export { useApiRequest } from './useApiRequest';
export type { RequestState } from './useApiRequest';
export { useAsyncList } from './useAsyncList';
export type { AsyncListState } from './useAsyncList';
export { useRealtimeSubscription } from './useRealtimeSubscription';
export { useToast } from './useToast';
export type { Toast, ToastType } from './useToast';
export { useConfirm } from './useConfirm';
export type { ConfirmState } from './useConfirm';

// Feature hooks — data layer
export { useAuth } from './useAuth';
export type { AuthUser } from './useAuth';
export { useCursos } from './useCursos';
export { useTutores } from './useTutores';
export { useEstudiantes } from './useEstudiantes';
export { useMatriculas } from './useMatriculas';
export { usePagos } from './usePagos';
export { useTesoreria } from './useTesoreria';
export { useDashboard } from './useDashboard';
export { useHorasTrabajo } from './useHorasTrabajo';
