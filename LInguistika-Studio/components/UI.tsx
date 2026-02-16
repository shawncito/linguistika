
import React from 'react';

// --- BUTTON (Material Style) ---
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive' | 'success';
  size?: 'sm' | 'md' | 'lg' | 'icon';
}

export const Button: React.FC<ButtonProps> = ({ 
  children, 
  variant = 'secondary', 
  size = 'md', 
  className = '', 
  ...props 
}) => {
  const base = "inline-flex items-center justify-center rounded-2xl text-sm font-semibold transition-all duration-200 active:scale-95 disabled:opacity-50 select-none shadow-lg shadow-black/30 hover:shadow-cyan-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00AEEF]/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#051026]";

  const variants = {
    primary: "bg-[#00AEEF] text-[#051026] hover:bg-[#00AEEF]/85",
    secondary: "bg-[#0F2445] text-slate-100 border border-white/10 hover:border-white/20 hover:bg-[#122b55]",
    outline: "border border-white/20 bg-transparent text-slate-100 hover:border-[#00AEEF] hover:text-white",
    ghost: "text-slate-200 hover:text-white hover:bg-white/10 shadow-none",
    destructive: "bg-rose-600 text-white hover:bg-rose-700",
    success: "bg-emerald-600 text-white hover:bg-emerald-700",
  };

  const sizes = {
    sm: "h-9 px-4 text-xs",
    md: "h-11 px-6",
    lg: "h-[52px] px-10 text-base",
    icon: "h-10 w-10 p-0 shadow-none",
  };

  return (
    <button className={`${base} ${variants[variant]} ${sizes[size]} ${className}`} {...props}>
      {children}
    </button>
  );
};

// --- CARD (Material Paper) ---
export const Card: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ children, className = "", ...props }) => (
  <div
    {...props}
    className={`rounded-3xl border border-white/8 bg-[#0F2445] shadow-[0_30px_90px_-45px_rgba(0,0,0,0.8)] hover:shadow-cyan-500/15 transition-all duration-300 ${className}`}
  >
    {children}
  </div>
);

export const CardHeader: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = "" }) => (
  <div className={`flex flex-col space-y-1.5 p-6 border-b border-white/10 ${className}`}>{children}</div>
);

export const CardTitle: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = "" }) => (
  <h3 className={`font-bold text-xl text-white tracking-tight ${className}`}>{children}</h3>
);

export const CardDescription: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = "" }) => (
  <p className={`text-sm font-medium text-slate-400 ${className}`}>{children}</p>
);

export const CardContent: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = "" }) => (
  <div className={`p-6 ${className}`}>{children}</div>
);

// --- FORM ---
export const Label: React.FC<React.LabelHTMLAttributes<HTMLLabelElement>> = ({ children, className = "", ...props }) => (
  <label {...props} className={`text-xs font-bold text-slate-300 mb-2 block uppercase tracking-wider ${className}`}>
    {children}
  </label>
);

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className = "", ...props }, ref) => (
    <input
      ref={ref}
      {...props}
      className={`flex h-12 w-full rounded-2xl border border-white/10 bg-[#0F2445] px-4 py-2 text-sm text-slate-100 placeholder:text-slate-500 transition-all focus:outline-none focus:ring-2 focus:ring-[#00AEEF]/50 focus:border-[#00AEEF] ${className}`}
    />
  )
);

Input.displayName = 'Input';

export const Select: React.FC<React.SelectHTMLAttributes<HTMLSelectElement>> = ({ children, className = "", ...props }) => (
  <div className="relative group">
    <select
      {...props}
      className={`flex h-12 w-full appearance-none rounded-2xl border border-white/10 bg-[#0F2445] px-4 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#00AEEF]/50 focus:border-[#00AEEF] transition-all ${className}`}
    >
      {children}
    </select>
    <div className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-slate-400">
      <svg className="h-4 w-4 fill-current" viewBox="0 0 20 20"><path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"/></svg>
    </div>
  </div>
);

// --- BADGE ---
export const Badge: React.FC<
  React.HTMLAttributes<HTMLDivElement> & {
    variant?: 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning' | 'info';
  }
> = ({ children, variant = 'default', className = "", ...props }) => {
  const variants = {
    default: "bg-brand-blue/10 text-brand-navy border border-brand-blue/20",
    secondary: "bg-brand-blue/10 text-brand-blue border border-brand-blue/20",
    info: "bg-brand-cyan/15 text-brand-cyan border border-brand-cyan/30",
    destructive: "bg-red-50 text-red-700 border border-red-100",
    outline: "border border-slate-300 text-slate-600",
    success: "bg-emerald-50 text-emerald-700 border border-emerald-100",
    warning: "bg-brand-yellow/20 text-brand-navy border border-brand-yellow/40",
  };
  return (
    <div
      {...props}
      className={`inline-flex items-center rounded-full px-3 py-1 text-[11px] font-bold ${variants[variant]} ${className}`}
    >
      {children}
    </div>
  );
};

// --- TABLE ---
export const Table: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = "" }) => (
  <div className="w-full overflow-x-auto">
    <table className={`w-full text-left border-separate border-spacing-y-3 ${className}`}>{children}</table>
  </div>
);

export const TableHeader: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <thead className="">{children}</thead>
);

export const TableBody: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <tbody>{children}</tbody>
);

export const TableRow: React.FC<React.HTMLAttributes<HTMLTableRowElement>> = ({ children, className = "", ...props }) => (
  <tr className={`bg-[#0F2445] rounded-2xl shadow-lg shadow-black/30 border border-white/10 hover:border-[#00AEEF]/40 transition-colors ${className}`} {...props}>{children}</tr>
);

export const TableHead: React.FC<React.ThHTMLAttributes<HTMLTableCellElement>> = ({ children, className = "", ...props }) => (
  <th className={`h-12 px-6 text-xs font-bold text-slate-300 uppercase tracking-wider align-middle ${className}`} {...props}>{children}</th>
);

export const TableCell: React.FC<React.TdHTMLAttributes<HTMLTableDataCellElement>> = ({ children, className = "", ...props }) => (
  <td className={`p-6 text-sm text-slate-100 align-middle ${className}`} {...props}>{children}</td>
);

// --- DIALOG ---
export const Dialog: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  maxWidthClass?: string;
  contentClassName?: string;
  zIndex?: number;
  containerClassName?: string;
  showBackdrop?: boolean;
  position?: 'left' | 'center' | 'right';
}> = ({
  isOpen,
  onClose,
  title,
  children,
  maxWidthClass = 'max-w-lg',
  contentClassName = '',
  zIndex = 100,
  containerClassName = '',
  showBackdrop = true,
  position = 'center',
}) => {
  if (!isOpen) return null;

  // Determinar la posición del modal
  const positionClasses = {
    left: 'left-2 top-1/2 -translate-y-1/2',
    center: 'left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2',
    right: 'right-2 top-1/2 -translate-y-1/2',
  };

  return (
    <>
      {showBackdrop && (
        <div 
          className="fixed inset-0 bg-[#051026]/70 backdrop-blur-sm transition-opacity" 
          style={{ zIndex }} 
          onClick={onClose} 
        />
      )}
      <div 
        className={`fixed w-full ${maxWidthClass} ${positionClasses[position]} p-4 ${containerClassName}`}
        style={{ zIndex: zIndex + 1 }}
      >
        <div className={`relative bg-[#0F2445] rounded-3xl border border-white/10 shadow-2xl shadow-black/40 animate-in fade-in zoom-in duration-300 overflow-hidden max-h-[calc(100vh-2rem)] flex flex-col ${contentClassName}`}>
          <div className="h-1 bg-[#FFC800]" />
          <div className="flex items-center justify-between p-6 border-b border-white/10 bg-white/5">
            <h2 className="text-xl font-bold text-white">{title}</h2>
            <button
              onClick={onClose}
              className="text-slate-200 hover:text-white transition-colors p-2 rounded-full bg-white/10 border border-white/10 hover:bg-[#FFC800]/20 hover:border-[#FFC800]/50"
              aria-label="Cerrar"
              title="Cerrar"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
            </button>
          </div>
          <div className="p-8 text-slate-100 flex-1 overflow-y-auto min-h-0">
            {children}
          </div>
        </div>
      </div>
    </>
  );
};
