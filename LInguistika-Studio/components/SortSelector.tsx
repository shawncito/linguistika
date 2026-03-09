import React from 'react';
import { ArrowUpDown } from 'lucide-react';

interface SortOption {
  value: string;
  label: string;
}

interface SortSelectorProps {
  value: string;
  onChange: (value: string) => void;
  options: SortOption[];
  className?: string;
}

/**
 * Selector de ordenamiento reutilizable. Muestra el icono de orden + un dropdown.
 *
 * @example
 * <SortSelector
 *   value={sortMode}
 *   onChange={setSortMode}
 *   options={[
 *     { value: 'nombre_asc', label: 'Nombre A-Z' },
 *     { value: 'nombre_desc', label: 'Nombre Z-A' },
 *   ]}
 * />
 */
export const SortSelector: React.FC<SortSelectorProps> = ({ value, onChange, options, className = '' }) => (
  <div className={`relative flex items-center ${className}`}>
    <ArrowUpDown className="absolute left-3 w-4 h-4 text-slate-400 pointer-events-none" />
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="h-12 appearance-none rounded-2xl border border-white/10 bg-[#0F2445] pl-9 pr-9 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#00AEEF]/50 focus:border-[#00AEEF] transition-all"
      aria-label="Ordenar por"
    >
      {options.map(opt => (
        <option key={opt.value} value={opt.value}>{opt.label}</option>
      ))}
    </select>
    <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-slate-400">
      <svg className="h-4 w-4 fill-current" viewBox="0 0 20 20">
        <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
      </svg>
    </div>
  </div>
);
