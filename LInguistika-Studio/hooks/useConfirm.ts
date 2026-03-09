import { useCallback, useRef, useState } from 'react';

export interface ConfirmState {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  danger?: boolean;
}

const CLOSED: ConfirmState = { open: false, title: '' };

/**
 * Hook para gestionar un diálogo de confirmación genérico.
 * Empareja con el componente ConfirmDialog.
 *
 * @example
 * const { confirmState, confirm, handleConfirm, handleCancel } = useConfirm();
 *
 * async function onDelete(id: number) {
 *   const ok = await confirm({ title: '¿Eliminar?', description: 'No se puede deshacer.', danger: true });
 *   if (ok) await deleteFn(id);
 * }
 */
export function useConfirm() {
  const [confirmState, setConfirmState] = useState<ConfirmState>(CLOSED);
  const resolverRef = useRef<(ok: boolean) => void>(() => {});

  const confirm = useCallback((opts: Omit<ConfirmState, 'open'>): Promise<boolean> => {
    return new Promise<boolean>(resolve => {
      resolverRef.current = resolve;
      setConfirmState({ open: true, ...opts });
    });
  }, []);

  const handleConfirm = useCallback(() => {
    resolverRef.current(true);
    setConfirmState(CLOSED);
  }, []);

  const handleCancel = useCallback(() => {
    resolverRef.current(false);
    setConfirmState(CLOSED);
  }, []);

  return { confirmState, confirm, handleConfirm, handleCancel };
}
