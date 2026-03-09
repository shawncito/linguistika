import React from 'react';
import { AlertTriangle, Trash2 } from 'lucide-react';
import { Button, Dialog } from './UI';
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
  <Dialog isOpen={open} onClose={onCancel} title={title} maxWidthClass="max-w-md">
    <div className="flex flex-col gap-4">
      {/* Icon */}
      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${danger ? 'bg-rose-500/15 text-rose-400' : 'bg-[#00AEEF]/10 text-[#00AEEF]'}`}>
        {danger ? <Trash2 className="w-6 h-6" /> : <AlertTriangle className="w-6 h-6" />}
      </div>

      {description && (
        <p className="text-sm text-slate-400">{description}</p>
      )}

      {/* Actions */}
      <div className="flex gap-3 justify-end pt-2">
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
