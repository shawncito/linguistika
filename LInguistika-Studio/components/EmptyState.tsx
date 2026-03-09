import React from 'react';
import { Inbox } from 'lucide-react';
import { Button } from './UI';

interface EmptyStateProps {
  title?: string;
  description?: string;
  icon?: React.ReactNode;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

/**
 * Estado vacío para listas sin resultados o sin datos cargados.
 *
 * @example
 * {cursos.length === 0 && !loading && (
 *   <EmptyState
 *     title="Sin cursos"
 *     description="Aún no has creado ningún curso."
 *     action={{ label: 'Crear primer curso', onClick: () => setShowModal(true) }}
 *   />
 * )}
 */
export const EmptyState: React.FC<EmptyStateProps> = ({
  title = 'Sin resultados',
  description = 'No se encontraron elementos que coincidan con los filtros.',
  icon,
  action,
  className = '',
}) => (
  <div className={`flex flex-col items-center justify-center py-20 text-center gap-4 ${className}`}>
    <div className="w-16 h-16 rounded-3xl bg-[#0F2445] border border-white/10 flex items-center justify-center text-slate-400">
      {icon ?? <Inbox className="w-7 h-7" />}
    </div>
    <div>
      <p className="text-lg font-semibold text-slate-200">{title}</p>
      <p className="text-sm text-slate-400 mt-1 max-w-xs">{description}</p>
    </div>
    {action && (
      <Button variant="outline" size="sm" onClick={action.onClick}>
        {action.label}
      </Button>
    )}
  </div>
);
