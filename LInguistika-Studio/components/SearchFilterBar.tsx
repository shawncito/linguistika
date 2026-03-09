import React from 'react';
import { Search, X } from 'lucide-react';
import { Input } from './UI';

interface FilterOption {
  value: string;
  label: string;
}

interface FilterConfig {
  key: string;
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  options: FilterOption[];
}

interface SearchFilterBarProps {
  search: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  filters?: FilterConfig[];
  extra?: React.ReactNode;
  className?: string;
}

/**
 * Barra de búsqueda y filtros horizontales. Reutilizable en cualquier vista con lista.
 *
 * @example
 * <SearchFilterBar
 *   search={search}
 *   onSearchChange={setSearch}
 *   searchPlaceholder="Buscar por nombre..."
 *   filters={[
 *     { key: 'estado', value: estadoFiltro, onChange: setEstadoFiltro, options: [
 *       { value: 'todos', label: 'Todos' },
 *       { value: 'activos', label: 'Activos' },
 *       { value: 'inactivos', label: 'Inactivos' },
 *     ]},
 *   ]}
 * />
 */
export const SearchFilterBar: React.FC<SearchFilterBarProps> = ({
  search,
  onSearchChange,
  searchPlaceholder = 'Buscar...',
  filters = [],
  extra,
  className = '',
}) => (
  <div className={`flex flex-wrap items-center gap-3 ${className}`}>
    {/* Search */}
    <div className="relative flex-1 min-w-[200px] max-w-[400px]">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
      <Input
        value={search}
        onChange={e => onSearchChange(e.target.value)}
        placeholder={searchPlaceholder}
        className="pl-10 pr-9"
      />
      {search && (
        <button
          onClick={() => onSearchChange('')}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
          aria-label="Limpiar búsqueda"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>

    {/* Dynamic filters */}
    {filters.map(filter => (
      <div key={filter.key} className="relative">
        <select
          value={filter.value}
          onChange={e => filter.onChange(e.target.value)}
          className="h-12 appearance-none rounded-2xl border border-white/10 bg-[#0F2445] px-4 pr-9 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#00AEEF]/50 focus:border-[#00AEEF] transition-all"
          aria-label={filter.placeholder ?? `Filtrar ${filter.key}`}
        >
          {filter.placeholder && (
            <option value="">{filter.placeholder}</option>
          )}
          {filter.options.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-slate-400">
          <svg className="h-4 w-4 fill-current" viewBox="0 0 20 20">
            <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
          </svg>
        </div>
      </div>
    ))}

    {extra}
  </div>
);
