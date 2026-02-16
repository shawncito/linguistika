import React, { useEffect, useState } from 'react';
import { Dialog, Input, Button, Label } from './UI';

type PasswordConfirmDialogProps = {
  open: boolean;
  title?: string;
  description?: string;
  confirmLabel?: string;
  busy?: boolean;
  onConfirm: (password: string) => void | Promise<void>;
  onClose: () => void;
};

export const PasswordConfirmDialog: React.FC<PasswordConfirmDialogProps> = ({
  open,
  title,
  description,
  confirmLabel,
  busy,
  onConfirm,
  onClose,
}) => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setPassword('');
    setError('');
  }, [open]);

  const handleConfirm = async () => {
    const trimmed = String(password || '').trim();
    if (!trimmed) {
      setError('Ingresa tu contraseña para confirmar.');
      return;
    }
    setError('');
    await onConfirm(trimmed);
  };

  return (
    <Dialog isOpen={open} onClose={onClose} title={title || 'Confirmar acción'} maxWidthClass="max-w-md">
      <div className="space-y-4">
        {description ? <div className="text-sm text-slate-200">{description}</div> : null}
        <div>
          <Label>Contraseña</Label>
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Tu contraseña"
          />
          {error ? <div className="text-xs text-rose-200 mt-2 font-semibold">{error}</div> : null}
        </div>
        <div className="flex items-center justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={busy}>Cancelar</Button>
          <Button type="button" variant="primary" onClick={handleConfirm} disabled={busy}>
            {busy ? 'Procesando...' : (confirmLabel || 'Confirmar')}
          </Button>
        </div>
      </div>
    </Dialog>
  );
};
