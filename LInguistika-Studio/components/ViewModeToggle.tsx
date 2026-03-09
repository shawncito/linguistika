import React from 'react';
import { Table as TableIcon, LayoutGrid } from 'lucide-react';

type ViewMode = 'tabla' | 'tarjetas';

interface ViewModeToggleProps {
  value: ViewMode;
  onChange: (mode: ViewMode) => void;
  className?: string;
}

/**
 * Toggle para alternar entre vista de tabla y tarjetas.
 *
 * @example
 * <ViewModeToggle value={viewMode} onChange={setViewMode} />
 */
export const ViewModeToggle: React.FC<ViewModeToggleProps> = ({ value, onChange, className = '' }) => (
  <div className={`flex items-center gap-1 rounded-2xl border border-white/10 bg-[#0A1628] p-1 ${className}`}>
    <button
      onClick={() => onChange('tarjetas')}
      className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
        value === 'tarjetas'
          ? 'bg-[#00AEEF]/15 text-[#00AEEF] border border-[#00AEEF]/30'
          : 'text-slate-400 hover:text-white'
      }`}
      aria-label="Vista de tarjetas"
    >
      <LayoutGrid className="w-4 h-4" />
      <span className="hidden sm:inline">Tarjetas</span>
    </button>
    <button
      onClick={() => onChange('tabla')}
      className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
        value === 'tabla'
          ? 'bg-[#00AEEF]/15 text-[#00AEEF] border border-[#00AEEF]/30'
          : 'text-slate-400 hover:text-white'
      }`}
      aria-label="Vista de tabla"
    >
      <TableIcon className="w-4 h-4" />
      <span className="hidden sm:inline">Tabla</span>
    </button>
  </div>
);
