import React from 'react';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  label?: string;
  className?: string;
  fullPage?: boolean;
}

const SIZES = {
  sm: 'w-5 h-5 border-2',
  md: 'w-8 h-8 border-2',
  lg: 'w-12 h-12 border-[3px]',
};

/**
 * Indicador de carga consistente. Puede mostrarse como overlay de página completa
 * o como spinner inline.
 *
 * @example
 * {loading && <LoadingSpinner label="Cargando cursos..." />}
 * {loading && <LoadingSpinner fullPage />}
 */
export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'md',
  label,
  className = '',
  fullPage = false,
}) => {
  const spinner = (
    <div className={`flex flex-col items-center justify-center gap-3 ${className}`}>
      <div
        className={`${SIZES[size]} rounded-full border-white/10 border-t-[#00AEEF] animate-spin`}
      />
      {label && <p className="text-sm text-slate-400">{label}</p>}
    </div>
  );

  if (fullPage) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#051026]/80 backdrop-blur-sm">
        {spinner}
      </div>
    );
  }

  return spinner;
};

/**
 * Versión row para sustituir el contenido de una tabla mientras carga.
 * Se usa dentro de un <tbody>.
 */
export const TableLoadingRows: React.FC<{ cols?: number }> = ({ cols = 5 }) => (
  <>
    {Array.from({ length: 4 }).map((_, i) => (
      <tr key={i} className="bg-[#0F2445] rounded-2xl opacity-50">
        {Array.from({ length: cols }).map((__, j) => (
          <td key={j} className="px-6 py-4">
            <div className="h-4 rounded-lg bg-white/5 animate-pulse" />
          </td>
        ))}
      </tr>
    ))}
  </>
);
