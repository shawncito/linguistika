import React, { useEffect, useRef } from 'react';
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from 'lucide-react';
import type { Toast } from '../hooks/useToast';
import { MascotMark } from './MascotMark';

/* ── Tika-fly animation styles ─────────────────────────────────────
   The mascot slides in from the nav-logo position (top-left) and
   returns there on dismiss. The bubble fades in after the mascot
   lands, and fades out before the mascot flies back.

   Horizontal offset logic:
     The toast container is centered (left:50vw). The mascot icon is
     at the left edge of a max-640px container, so its screen-x ≈
     max(0, 50vw-320px). The nav logo is at ~24px from left (px-6).
     Delta ≈ calc(344px - 50vw) — negative on wide screens (flies left).
   ──────────────────────────────────────────────────────────────── */
const TOAST_ANIM_STYLES = `
  @keyframes tikaFlyIn {
    0%   { transform: translate(var(--tika-flight-dx, calc(344px - 50vw)), var(--tika-flight-dy, -60px)) scale(0.64); opacity: 0; }
    60%  { transform: translate(0px, 2px) scale(1.04); opacity: 1; }
    78%  { transform: translate(0px, -1px) scale(0.99); opacity: 1; }
    100% { transform: translate(0, 0) scale(1); opacity: 1; }
  }
  @keyframes tikaFlyOut {
    0%   { transform: translate(0, 0) scale(1); opacity: 1; }
    20%  { transform: translate(0px, -2px) scale(1.03); opacity: 1; }
    100% { transform: translate(var(--tika-flight-dx, calc(344px - 50vw)), var(--tika-flight-dy, -60px)) scale(0.64); opacity: 0; }
  }
  @keyframes tikaBubbleIn {
    from { opacity: 0; transform: translateX(-6px) scale(0.94); }
    to   { opacity: 1; transform: translateX(0) scale(1); }
  }
  @keyframes tikaBubbleOut {
    from { opacity: 1; transform: translateX(0) scale(1); }
    to   { opacity: 0; transform: translateX(-6px) scale(0.94); }
  }
`;

const CONFIG = {
  success: {
    icon: <CheckCircle2 className="w-3.5 h-3.5" />,
    classes: 'border-emerald-400/30 bg-[#0A2038]/95 text-emerald-100',
    badge: 'border-emerald-400/25 bg-emerald-400/12 text-emerald-200',
    progress: 'bg-emerald-300/60',
  },
  error: {
    icon: <XCircle className="w-3.5 h-3.5" />,
    classes: 'border-rose-400/30 bg-[#0A2038]/95 text-rose-100',
    badge: 'border-rose-400/25 bg-rose-400/12 text-rose-200',
    progress: 'bg-rose-300/60',
  },
  warning: {
    icon: <AlertTriangle className="w-3.5 h-3.5" />,
    classes: 'border-amber-300/30 bg-[#0A2038]/95 text-amber-100',
    badge: 'border-amber-300/25 bg-amber-300/12 text-amber-200',
    progress: 'bg-amber-200/60',
  },
  info: {
    icon: <Info className="w-3.5 h-3.5" />,
    classes: 'border-[#00AEEF]/30 bg-[#0A2038]/95 text-cyan-100',
    badge: 'border-[#00AEEF]/25 bg-[#00AEEF]/12 text-cyan-200',
    progress: 'bg-cyan-300/60',
  },
};

interface ToastItemProps {
  toast: Toast;
  onDismiss: (id: string) => void;
}

const ToastItem: React.FC<ToastItemProps> = ({ toast, onDismiss }) => {
  const { icon, classes, badge, progress } = CONFIG[toast.type];
  const barRef = useRef<HTMLDivElement>(null);
  const exiting = Boolean(toast.dismissing);

  useEffect(() => {
    if (!barRef.current || !toast.duration) return;
    barRef.current.style.transition = `width ${toast.duration}ms linear`;
    // trigger animation
    requestAnimationFrame(() => {
      if (barRef.current) barRef.current.style.width = '0%';
    });
  }, [toast.duration]);

  const mascotAnim = exiting
    ? 'tikaFlyOut 780ms cubic-bezier(0.55,0,0.9,0.45) 120ms both'
    : 'tikaFlyIn 1100ms cubic-bezier(0.2,0.95,0.35,1) both';

  const bubbleAnim = exiting
    ? 'tikaBubbleOut 180ms ease-in both'
    : 'tikaBubbleIn 420ms ease-out 760ms both';

  return (
    <div className="relative w-full" role="alert">
      <div className="flex items-start gap-2.5">
        <div data-tika-toast-anchor="true" className="mt-1 h-12 w-12 flex-shrink-0">
          <div
            data-tika-toast-mascot="true"
            className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[#FFC800]/25 bg-[#051026]/90 shadow-lg shadow-black/35"
            style={{ animation: mascotAnim }}
          >
            <MascotMark size={30} />
          </div>
        </div>

        <div
          className={`relative min-w-0 flex-1 overflow-hidden rounded-[24px] border shadow-2xl shadow-black/45 backdrop-blur-md ${classes}`}
          style={{ animation: bubbleAnim }}
        >
          <div className="absolute -left-[7px] top-5 h-[14px] w-[14px] rotate-45 border-b border-l border-white/10 bg-[#0A2038]/95" />

          <div className="flex items-start gap-2.5 px-3.5 py-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-[0.22em] text-[#FFC800]">Tika dice</span>
                <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold ${badge}`}>
                  {icon}
                  {toast.type === 'success' ? 'Exito' : toast.type === 'error' ? 'Error' : toast.type === 'warning' ? 'Aviso' : 'Info'}
                </span>
              </div>
              <p className="mt-1 text-sm font-semibold leading-snug break-words text-white/95">{toast.message}</p>
            </div>

            <button
              onClick={() => onDismiss(toast.id)}
              className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
              aria-label="Cerrar notificación"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {toast.duration && (
            <div
              ref={barRef}
              className={`absolute bottom-0 left-0 h-[2px] w-full ${progress}`}
            />
          )}
        </div>
      </div>
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
    <>
      <style>{TOAST_ANIM_STYLES}</style>
      <div
        aria-live="polite"
        aria-atomic="false"
        className="fixed top-4 left-1/2 z-[140] flex w-[min(100vw,640px)] -translate-x-1/2 flex-col items-center gap-3 px-4 pointer-events-none"
      >
        {toasts.map(t => (
          <div key={t.id} className="pointer-events-auto w-full max-w-[560px]">
            <ToastItem toast={t} onDismiss={onDismiss} />
          </div>
        ))}
      </div>
    </>
  );
};
