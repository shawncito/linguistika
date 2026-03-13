import React from 'react';
import { AlertTriangle, Trash2 } from 'lucide-react';
import { Button, Dialog } from './UI';
import { MascotMark } from './MascotMark';
import type { ConfirmState } from '../hooks/useConfirm';

interface ConfirmDialogProps extends ConfirmState {
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
}

/**
 * Diálogo de confirmación genérico. Se empareja con el hook useConfirm.
 *
 * @example
 * const { confirmState, confirm, handleConfirm, handleCancel } = useConfirm();
 *
 * <ConfirmDialog
 *   {...confirmState}
 *   onConfirm={handleConfirm}
 *   onCancel={handleCancel}
 * />
 */
export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  open,
  title,
  description,
  confirmLabel = 'Confirmar',
  danger = false,
  onConfirm,
  onCancel,
  loading = false,
}) => (
  <Dialog isOpen={open} onClose={onCancel} title={title} maxWidthClass="max-w-[430px]">
    <div className="flex flex-col gap-5">
      <div className="flex items-start gap-3">
        <div className="relative mt-0.5 flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl border border-[#FFC800]/25 bg-[#051026]/90 shadow-lg shadow-black/35">
          <MascotMark size={34} />
          <div
            className={`absolute -bottom-2 -right-2 flex h-8 w-8 items-center justify-center rounded-2xl border ${danger ? 'border-rose-400/25 bg-rose-500/15 text-rose-300' : 'border-[#00AEEF]/25 bg-[#00AEEF]/15 text-[#7DDCFF]'}`}
          >
            {danger ? <Trash2 className="h-[18px] w-[18px]" /> : <AlertTriangle className="h-[18px] w-[18px]" />}
          </div>
        </div>

        <div className="relative min-w-0 flex-1 rounded-2xl border border-white/10 bg-[#0A2038]/90 px-3.5 py-3 text-left shadow-inner shadow-black/20">
          <div className="absolute -left-[7px] top-4 h-[14px] w-[14px] rotate-45 border-b border-l border-white/10 bg-[#0A2038]/95" />
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#FFC800]">Tika te pregunta</p>
          <p className="mt-1 text-sm leading-relaxed text-slate-100">
            {description || 'Confirma esta accion para continuar.'}
          </p>
        </div>
      </div>

      <div className="flex w-full justify-center gap-3 pt-1">
        <Button variant="ghost" size="sm" onClick={onCancel} disabled={loading}>
          Cancelar
        </Button>
        <Button
          variant={danger ? 'destructive' : 'primary'}
          size="sm"
          onClick={onConfirm}
          disabled={loading}
        >
          {loading ? 'Procesando...' : confirmLabel}
        </Button>
      </div>
    </div>
  </Dialog>
);
