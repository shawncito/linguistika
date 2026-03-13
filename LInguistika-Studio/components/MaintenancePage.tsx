import React from 'react';
import { MascotMark } from './MascotMark';

interface MaintenancePageProps {
  pageName?: string;
  mensaje?: string | null;
}

const MaintenancePage: React.FC<MaintenancePageProps> = ({
  pageName = 'esta página',
  mensaje,
}) => {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-8 py-16 select-none">
      {/* Tika con animación flotante */}
      <div className="relative">
        <style>{`
          @keyframes tikaMaintenanceFloat {
            0%, 100% { transform: translateY(0px) rotate(-2deg); }
            50% { transform: translateY(-12px) rotate(2deg); }
          }
          @keyframes tikaMaintenanceGlow {
            0%, 100% { opacity: 0.4; transform: scale(0.95); }
            50% { opacity: 0.75; transform: scale(1.05); }
          }
          .tika-maintenance-float {
            animation: tikaMaintenanceFloat 3.5s ease-in-out infinite;
          }
          .tika-maintenance-glow {
            animation: tikaMaintenanceGlow 3.5s ease-in-out infinite;
          }
        `}</style>
        {/* Sombra bajo Tika */}
        <div className="tika-maintenance-glow absolute bottom-[-16px] left-1/2 -translate-x-1/2 w-24 h-5 rounded-full bg-[#FFC800]/20 blur-md" />
        <div className="tika-maintenance-float">
          <MascotMark size={100} trackMouse={false} />
        </div>
      </div>

      {/* Mensaje */}
      <div className="text-center space-y-3 max-w-sm px-6">
        <h2 className="text-2xl font-extrabold text-[#FFC800]">
          Página en mantenimiento
        </h2>
        <p className="text-slate-300 font-semibold leading-relaxed">
          Tika está trabajando en{' '}
          <span className="text-white font-black">{pageName}</span>.
          <br />
          Vuelve pronto.
        </p>
        {mensaje && (
          <p className="text-slate-400 text-sm bg-white/5 border border-white/10 rounded-xl px-5 py-3 leading-relaxed">
            {mensaje}
          </p>
        )}
        <p className="text-slate-600 text-xs pt-1">
          Si necesitas acceso urgente, contacta al administrador.
        </p>
      </div>
    </div>
  );
};

export default MaintenancePage;
