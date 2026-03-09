import React, { useEffect, useRef } from 'react';
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from 'lucide-react';
import type { Toast } from '../hooks/useToast';

const CONFIG = {
  success: { icon: <CheckCircle2 className="w-5 h-5" />, classes: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' },
  error:   { icon: <XCircle className="w-5 h-5" />,      classes: 'border-rose-500/30 bg-rose-500/10 text-rose-300' },
  warning: { icon: <AlertTriangle className="w-5 h-5" />, classes: 'border-amber-500/30 bg-amber-500/10 text-amber-300' },
  info:    { icon: <Info className="w-5 h-5" />,          classes: 'border-[#00AEEF]/30 bg-[#00AEEF]/10 text-[#00AEEF]' },
};

interface ToastItemProps {
  toast: Toast;
  onDismiss: (id: string) => void;
}

const ToastItem: React.FC<ToastItemProps> = ({ toast, onDismiss }) => {
  const { icon, classes } = CONFIG[toast.type];
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!barRef.current || !toast.duration) return;
    barRef.current.style.transition = `width ${toast.duration}ms linear`;
    // trigger animation
    requestAnimationFrame(() => {
      if (barRef.current) barRef.current.style.width = '0%';
    });
  }, [toast.duration]);

  return (
    <div
      className={`relative flex items-start gap-3 rounded-2xl border px-4 py-3 shadow-2xl shadow-black/40 backdrop-blur-sm min-w-[260px] max-w-sm overflow-hidden ${classes}`}
      role="alert"
    >
      <span className="flex-shrink-0 mt-0.5">{icon}</span>
      <p className="flex-1 text-sm font-medium break-words leading-snug">{toast.message}</p>
      <button
        onClick={() => onDismiss(toast.id)}
        className="flex-shrink-0 text-current opacity-60 hover:opacity-100 transition-opacity ml-1"
        aria-label="Cerrar notificación"
      >
        <X className="w-4 h-4" />
      </button>
      {/* Progress bar */}
      {toast.duration && (
        <div
          ref={barRef}
          className="absolute bottom-0 left-0 h-[2px] bg-current opacity-30 w-full"
        />
      )}
    </div>
  );
};

interface ToastContainerProps {
  toasts: Toast[];
  onDismiss: (id: string) => void;
}

/**
 * Contenedor de notificaciones toast. Se monta una sola vez, normalmente en App.tsx.
 * Se alimenta desde el hook useToast.
 *
 * @example
 * const { toasts, toast, dismiss } = useToast();
 * // En App.tsx:
 * <ToastContainer toasts={toasts} onDismiss={dismiss} />
 * // En cualquier vista/hook:
 * toast.success('Guardado correctamente');
 */
export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onDismiss }) => {
  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      aria-atomic="false"
      className="fixed bottom-6 right-6 z-[100] flex flex-col gap-3 items-end pointer-events-none"
    >
      {toasts.map(t => (
        <div key={t.id} className="pointer-events-auto">
          <ToastItem toast={t} onDismiss={onDismiss} />
        </div>
      ))}
    </div>
  );
};
