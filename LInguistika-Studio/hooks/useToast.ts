import { useCallback, useRef, useState } from 'react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
  dismissing?: boolean;
}

let counter = 0;

/**
 * Hook para gestionar notificaciones toast en memoria.
 * Las vistas obtienen este hook y muestran <ToastContainer toasts={toasts} onDismiss={dismiss} />.
 *
 * @example
 * const { toasts, toast, dismiss } = useToast();
 * toast.success('Curso guardado');
 * toast.error('Error al eliminar');
 */
export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: string) => {
    // mark as exiting first for the fly-out animation
    setToasts(prev => {
      const t = prev.find(t => t.id === id);
      if (!t || t.dismissing) return prev; // already dismissing
      return prev.map(t => t.id === id ? { ...t, dismissing: true } : t);
    });
    clearTimeout(timers.current.get(id));
    timers.current.delete(id);
    // remove after bubble-out + mascot fly-out complete (slightly faster reappearance)
    const exitTimer = setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
      timers.current.delete(`exit-${id}`);
    }, 980);
    timers.current.set(`exit-${id}`, exitTimer);
  }, []);

  const addToast = useCallback(
    (type: ToastType, message: string, duration = 4000) => {
      const id = `toast-${++counter}`;
      setToasts(prev => [...prev, { id, type, message, duration }]);
      if (duration > 0) {
        const timer = setTimeout(() => dismiss(id), duration);
        timers.current.set(id, timer);
      }
      return id;
    },
    [dismiss]
  );

  const toast = {
    success: (msg: string, duration?: number) => addToast('success', msg, duration),
    error: (msg: string, duration?: number) => addToast('error', msg, duration),
    warning: (msg: string, duration?: number) => addToast('warning', msg, duration),
    info: (msg: string, duration?: number) => addToast('info', msg, duration),
  };

  return { toasts, toast, dismiss };
}
