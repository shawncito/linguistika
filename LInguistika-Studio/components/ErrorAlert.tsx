import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface ErrorAlertProps {
  message: string | null | undefined;
  title?: string;
  onDismiss?: () => void;
  className?: string;
}

/**
 * Alerta de error inline con botón opcional para cerrar.
 *
 * @example
 * {error && <ErrorAlert message={error} onDismiss={() => setError(null)} />}
 */
export const ErrorAlert: React.FC<ErrorAlertProps> = ({
  message,
  title = 'Error',
  onDismiss,
  className = '',
}) => {
  if (!message) return null;

  return (
    <div
      role="alert"
      className={`flex items-start gap-3 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 ${className}`}
    >
      <AlertTriangle className="w-5 h-5 text-rose-400 flex-shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-rose-300">{title}</p>
        <p className="text-sm text-rose-400/90 mt-0.5 break-words">{message}</p>
      </div>
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="flex-shrink-0 text-rose-400 hover:text-rose-200 transition-colors"
          aria-label="Cerrar"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};
