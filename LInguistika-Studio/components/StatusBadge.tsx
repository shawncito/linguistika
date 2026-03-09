import React from 'react';
import { CheckCircle2, XCircle, Clock, AlertCircle } from 'lucide-react';

type StatusVariant = 'active' | 'inactive' | 'pending' | 'warning' | 'info';

interface StatusBadgeProps {
  status: number | string | boolean;
  /**
   * Mapa personalizado: valor → variante.
   * Por defecto: 1/true/"activo" → active, 0/false/"inactivo" → inactive.
   */
  map?: Record<string | number, StatusVariant>;
  labels?: Record<StatusVariant, string>;
  className?: string;
  showIcon?: boolean;
}

const COLORS: Record<StatusVariant, string> = {
  active:   'bg-emerald-500/15 text-emerald-400  border border-emerald-500/30',
  inactive: 'bg-slate-500/15  text-slate-400     border border-slate-500/30',
  pending:  'bg-amber-500/15   text-amber-400    border border-amber-500/30',
  warning:  'bg-orange-500/15  text-orange-400   border border-orange-500/30',
  info:     'bg-[#00AEEF]/15   text-[#00AEEF]    border border-[#00AEEF]/30',
};

const ICONS: Record<StatusVariant, React.ReactNode> = {
  active:   <CheckCircle2 className="w-3 h-3" />,
  inactive: <XCircle className="w-3 h-3" />,
  pending:  <Clock className="w-3 h-3" />,
  warning:  <AlertCircle className="w-3 h-3" />,
  info:     <AlertCircle className="w-3 h-3" />,
};

const DEFAULT_LABELS: Record<StatusVariant, string> = {
  active:   'Activo',
  inactive: 'Inactivo',
  pending:  'Pendiente',
  warning:  'Atención',
  info:     'Info',
};

function resolveVariant(status: number | string | boolean, map?: Record<string | number, StatusVariant>): StatusVariant {
  if (map) {
    const key = status as string | number;
    if (map[key] !== undefined) return map[key];
  }
  if (status === 1 || status === true || status === 'activo' || status === 'active') return 'active';
  if (status === 0 || status === false || status === 'inactivo' || status === 'inactive') return 'inactive';
  if (status === 'pendiente' || status === 'pending') return 'pending';
  return 'info';
}

/**
 * Badge de estado con color, icono y label consistentes en toda la app.
 *
 * @example
 * <StatusBadge status={tutor.estado} />
 * <StatusBadge status={pago.estado} map={{ pendiente: 'pending', pagado: 'active' }} />
 */
export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  map,
  labels,
  className = '',
  showIcon = true,
}) => {
  const variant = resolveVariant(status, map);
  const label = (labels?.[variant] ?? DEFAULT_LABELS[variant]);

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold ${COLORS[variant]} ${className}`}>
      {showIcon && ICONS[variant]}
      {label}
    </span>
  );
};
