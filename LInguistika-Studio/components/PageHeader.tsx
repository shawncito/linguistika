import React from 'react';
import { Button } from './UI';

interface PageHeaderProps {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  action?: {
    label: string;
    icon?: React.ReactNode;
    onClick: () => void;
    disabled?: boolean;
  };
  extra?: React.ReactNode;
}

/**
 * Encabezado estándar de página: icono + título + descripción + botón de acción principal.
 * Garantiza presentación uniforme en todas las vistas.
 *
 * @example
 * <PageHeader
 *   title="Cursos"
 *   description="Gestiona los cursos disponibles"
 *   icon={<BookOpen className="w-6 h-6" />}
 *   action={{ label: 'Nuevo curso', icon: <Plus />, onClick: () => setShowModal(true) }}
 * />
 */
export const PageHeader: React.FC<PageHeaderProps> = ({ title, description, icon, action, extra }) => (
  <div className="flex items-center justify-between gap-4 mb-6">
    <div className="flex items-center gap-3 min-w-0">
      {icon && (
        <div className="flex-shrink-0 w-10 h-10 rounded-2xl bg-[#00AEEF]/10 border border-[#00AEEF]/20 flex items-center justify-center text-[#00AEEF]">
          {icon}
        </div>
      )}
      <div className="min-w-0">
        <h1 className="text-2xl font-bold text-white truncate">{title}</h1>
        {description && (
          <p className="text-sm text-slate-400 mt-0.5 truncate">{description}</p>
        )}
      </div>
    </div>

    <div className="flex items-center gap-2 flex-shrink-0">
      {extra}
      {action && (
        <Button
          variant="primary"
          size="md"
          onClick={action.onClick}
          disabled={action.disabled}
          className="flex items-center gap-2"
        >
          {action.icon}
          {action.label}
        </Button>
      )}
    </div>
  </div>
);
