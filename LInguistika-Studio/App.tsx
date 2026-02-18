
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { HashRouter, Routes, Route, Link, useLocation, Navigate, Outlet } from 'react-router-dom';
import { 
  LayoutDashboard, Users, BookOpen, GraduationCap, 
  ClipboardList, CreditCard, Menu, X, Languages, Phone, 
  Search, Bell, User,
  Plus, Minus, RotateCcw
} from 'lucide-react';

import Dashboard from './views/Dashboard';
import Tutores from './views/Tutores';
import Cursos from './views/Cursos';
import Estudiantes from './views/Estudiantes';
import Matriculas from './views/Matriculas';
import Tesoreria from './views/Tesoreria';
import Login from './views/Login';
import Empleados from './views/Empleados';
import { auth } from './services/api';
import { api } from './services/api';
import { ActivityLogDrawer, ACTIVITY_LAST_SEEN_KEY } from './components/ActivityLogDrawer';

const TopNav: React.FC<{ canSeeTesoreria?: boolean }> = ({ canSeeTesoreria = true }) => {
  const location = useLocation();

  const navItems = [
    { name: 'Dashboard', path: '/', icon: <LayoutDashboard className="w-4 h-4" /> },
    { name: 'Estudiantes', path: '/estudiantes', icon: <GraduationCap className="w-4 h-4" /> },
    { name: 'Tutores', path: '/tutores', icon: <Users className="w-4 h-4" /> },
    { name: 'Cursos', path: '/cursos', icon: <BookOpen className="w-4 h-4" /> },
    { name: 'Matrículas', path: '/matriculas', icon: <ClipboardList className="w-4 h-4" /> },
    { name: 'Tesoreria', path: '/pagos', icon: <CreditCard className="w-4 h-4" />, requiresTesoreria: true },
    { name: 'Empleados', path: '/empleados', icon: <Users className="w-4 h-4" /> },
  ].filter(item => !item.requiresTesoreria || canSeeTesoreria);

  return (
    <nav className="flex items-center gap-2">
      {navItems.map((item) => {
        const isActive = location.pathname === item.path;
        return (
          <Link
            key={item.path}
            to={item.path}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              isActive
                ? 'bg-[#00AEEF] text-[#051026] shadow-md'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            {item.icon}
            <span className="hidden lg:inline">{item.name}</span>
          </Link>
        );
      })}
    </nav>
  );
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const AppHeader: React.FC<{
  uiScale: number;
  setUiScale: React.Dispatch<React.SetStateAction<number>>;
}> = ({ uiScale, setUiScale }) => {
  const [me, setMe] = useState<any | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [activityOpen, setActivityOpen] = useState(false);
  const [activityHasNew, setActivityHasNew] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const logoRef = useRef<HTMLDivElement | null>(null);
  const [pupilOffset, setPupilOffset] = useState({ x: 0, y: 0 });
  const [blink, setBlink] = useState({ left: false, right: false });
  const [isHoverLogo, setIsHoverLogo] = useState(false);
  const [tapCount, setTapCount] = useState(0);
  const [eggActive, setEggActive] = useState(false);
  const tapTimerRef = useRef<number | null>(null);
  const eggTimerRef = useRef<number | null>(null);
  const faceOffset = { x: pupilOffset.x * 0.9, y: pupilOffset.y * 0.6 };
  const mouthPath = eggActive ? 'M 65 108 Q 100 150 135 108' : 'M 70 110 Q 100 140 130 110';

  useEffect(() => {
    let cancelled = false;
    const token = auth.getToken();
    if (!token) {
      setMe(null);
      return;
    }

    api.auth
      .me()
      .then((res) => {
        if (!cancelled) setMe(res.user ?? null);
      })
      .catch(() => {
        // El interceptor ya redirige en 401.
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let raf = 0;
    const handleMove = (event: MouseEvent) => {
      if (!logoRef.current) return;
      const rect = logoRef.current.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const dx = event.clientX - centerX;
      const dy = event.clientY - centerY;

      const maxOffset = 6;
      const distance = Math.hypot(dx, dy);
      const scale = Math.min(distance / 90, 1);
      const angle = Math.atan2(dy, dx);
      const x = Math.cos(angle) * maxOffset * scale;
      const y = Math.sin(angle) * maxOffset * scale;

      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => setPupilOffset({ x, y }));
    };

    window.addEventListener('mousemove', handleMove);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('mousemove', handleMove);
    };
  }, []);

  useEffect(() => {
    let blinkTimer: number | null = null;
    let resetTimer: number | null = null;

    const scheduleBlink = () => {
      const delay = 2200 + Math.random() * 3800;
      blinkTimer = window.setTimeout(() => {
        const roll = Math.random();
        if (isHoverLogo && roll < 0.25) {
          const winkLeft = Math.random() < 0.5;
          setBlink({ left: winkLeft, right: !winkLeft });
        } else {
          setBlink({ left: true, right: true });
        }

        resetTimer = window.setTimeout(() => {
          setBlink({ left: false, right: false });
          scheduleBlink();
        }, 140);
      }, delay);
    };

    scheduleBlink();
    return () => {
      if (blinkTimer) window.clearTimeout(blinkTimer);
      if (resetTimer) window.clearTimeout(resetTimer);
    };
  }, [isHoverLogo]);

  useEffect(() => {
    return () => {
      if (tapTimerRef.current) window.clearTimeout(tapTimerRef.current);
      if (eggTimerRef.current) window.clearTimeout(eggTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const onMouseDown = (e: MouseEvent) => {
      const el = menuRef.current;
      if (!el) return;
      if (e.target instanceof Node && !el.contains(e.target)) {
        setMenuOpen(false);
      }
    };
    window.addEventListener('mousedown', onMouseDown);
    return () => window.removeEventListener('mousedown', onMouseDown);
  }, [menuOpen]);

  const rol: string = (me?.rol ?? 'tutor_view_only') as string;
  const canSeeActivity = rol === 'admin' || rol === 'contador';
  const canSeeTesoreria = rol === 'admin' || rol === 'contador';

  const roleLabel = useMemo(() => {
    switch (rol) {
      case 'admin':
        return 'Admin';
      case 'contador':
        return 'Contador';
      case 'tutor_view_only':
        return 'Oficina';
      default:
        return 'Oficina';
    }
  }, [rol]);

  const displayName = useMemo(() => {
    const nombre = (me?.nombre_completo ?? '').toString().trim();
    if (nombre) return nombre;

    switch (rol) {
      case 'admin':
        return 'Admin User';
      case 'contador':
        return 'Contador User';
      case 'tutor_view_only':
        return 'Oficina User';
      default:
        return 'Admin User';
    }
  }, [me?.nombre_completo, rol]);

  const onLogout = async () => {
    try {
      await api.auth.logout();
    } catch {
      // Ignorar: el logout real del lado cliente es limpiar el token.
    } finally {
      auth.clear();
      window.location.hash = '#/login';
    }
  };

  const handleLogoTap = () => {
    setTapCount((prev) => {
      const next = prev + 1;
      if (tapTimerRef.current) window.clearTimeout(tapTimerRef.current);
      tapTimerRef.current = window.setTimeout(() => setTapCount(0), 1500);

      if (next >= 7) {
        setTapCount(0);
        setEggActive(true);
        if (eggTimerRef.current) window.clearTimeout(eggTimerRef.current);
        eggTimerRef.current = window.setTimeout(() => setEggActive(false), 4000);
        return 0;
      }
      return next;
    });
  };

  useEffect(() => {
    if (!canSeeActivity) return;
    let cancelled = false;

    const getLastSeen = () => {
      try {
        const raw = localStorage.getItem(ACTIVITY_LAST_SEEN_KEY);
        const d = raw ? new Date(raw) : new Date(0);
        if (Number.isNaN(d.getTime())) return new Date(0);
        return d;
      } catch {
        return new Date(0);
      }
    };

    const check = async () => {
      try {
        const res = await api.activity.list({ limit: 1, offset: 0 });
        const latest = res.items?.[0]?.created_at ? new Date(res.items[0].created_at) : null;
        if (!latest || Number.isNaN(latest.getTime())) return;
        const lastSeen = getLastSeen();
        if (latest.getTime() > lastSeen.getTime()) {
          if (!cancelled) setActivityHasNew(true);
        }
      } catch {
        // Silenciar: puede fallar por permisos o configuración
      }
    };

    check();
    const t = window.setInterval(check, 20000);
    return () => {
      cancelled = true;
      window.clearInterval(t);
    };
  }, [canSeeActivity]);

  return (
  <div className="bg-[#051026] border-b border-[#FFC800] sticky top-0 z-50">
    <style>{`
      @keyframes appLogoFloat {
        0%, 100% { transform: translateY(0px) rotate(0deg) scale(1); }
        50% { transform: translateY(3px) rotate(0.8deg) scale(1.01); }
      }
      @keyframes appMouthIdle {
        0%, 100% { stroke-dasharray: 120; stroke-dashoffset: 0; }
        50% { stroke-dasharray: 120; stroke-dashoffset: 18; }
      }
      @keyframes appEggPulse {
        0%, 100% { transform: rotate(0deg) scale(1); }
        50% { transform: rotate(2.5deg) scale(1.06); }
      }
      @keyframes appEggSparkle {
        0%, 100% { opacity: 0; transform: scale(0.8); }
        50% { opacity: 1; transform: scale(1); }
      }
      .app-logo-face {
        animation: appLogoFloat 6s ease-in-out infinite;
        transform-origin: 50% 50%;
        transform-box: fill-box;
      }
      .app-logo-mouth {
        animation: appMouthIdle 4.5s ease-in-out infinite;
        transform-origin: 100px 120px;
      }
      .app-logo-egg {
        animation: appEggPulse 1.8s ease-in-out infinite;
        filter: drop-shadow(0 0 12px rgba(255, 200, 0, 0.45));
      }
      .app-logo-sparkles {
        animation: appEggSparkle 1.2s ease-in-out infinite;
        transform-origin: 50% 50%;
      }
    `}</style>
    {/* Primera fila: Logo, Usuario y Notificaciones */}
    <div className="h-16 flex items-center justify-between px-6 border-b border-[#FFC800]/30">
      {/* Logo */}
      <Link to="/" className="flex items-center gap-3">
        <div
          className={`w-12 h-12 drop-shadow-2xl ${eggActive ? 'app-logo-egg' : ''}`}
          ref={logoRef}
          onMouseEnter={() => setIsHoverLogo(true)}
          onMouseLeave={() => setIsHoverLogo(false)}
          onClick={handleLogoTap}
          title="Toca 7 veces"
        >
          <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
            <defs>
              <filter id="appFaceShadow" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="#000000" floodOpacity="0.45" />
                <feDropShadow dx="0" dy="5" stdDeviation="6" floodColor="#000000" floodOpacity="0.25" />
              </filter>
            </defs>
            {eggActive && (
              <g className="app-logo-sparkles">
                <circle cx="22" cy="32" r="4" fill="#FFC800" opacity="0.7" />
                <circle cx="178" cy="42" r="3" fill="#00AEEF" opacity="0.65" />
                <circle cx="28" cy="160" r="3" fill="#FFC800" opacity="0.6" />
                <circle cx="170" cy="158" r="4" fill="#00AEEF" opacity="0.6" />
              </g>
            )}
            <path d="M 50 20 Q 30 20 30 40 L 30 160 Q 30 180 50 180 L 100 180 L 100 20 Z" fill="#FFC800" />
            <path d="M 100 20 L 100 180 L 150 180 Q 170 180 170 160 L 170 40 Q 170 20 150 20 Z" fill="#00AEEF" />
            <g className="app-logo-face">
              <g transform={`translate(${faceOffset.x} ${faceOffset.y})`} filter="url(#appFaceShadow)">
                <g transform={`translate(60 70) scale(1 ${blink.left ? 0.2 : 1}) translate(-60 -70)`}>
                  <ellipse cx="60" cy="70" rx="8" ry="12" fill="#051026" />
                  <circle cx={60 + pupilOffset.x} cy={70 + pupilOffset.y} r="3.6" fill="#0F2445" />
                </g>
                <g transform={`translate(140 70) scale(1 ${blink.right ? 0.2 : 1}) translate(-140 -70)`}>
                  <ellipse cx="140" cy="70" rx="8" ry="12" fill="#051026" />
                  <circle cx={140 + pupilOffset.x} cy={70 + pupilOffset.y} r="3.6" fill="#0F2445" />
                </g>
                <path
                  className="app-logo-mouth"
                  d={mouthPath}
                  stroke="#051026"
                  strokeWidth="12"
                  fill="none"
                  strokeLinecap="round"
                />
              </g>
            </g>
          </svg>
        </div>
        <div className="flex flex-col">
          <span className="font-extrabold text-lg tracking-tight text-[#FFC800] leading-none">Lingüistika</span>
          <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">UNADECA Language Center</span>
          {eggActive && (
            <span className="text-[9px] font-semibold text-[#FFC800] tracking-wide">
              Hecho por Reyshawn Lawrence con amor
            </span>
          )}
        </div>
      </Link>

      {/* Usuario y notificaciones */}
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => {
            setActivityOpen(true);
            setActivityHasNew(false);
            try {
              localStorage.setItem(ACTIVITY_LAST_SEEN_KEY, new Date().toISOString());
            } catch {
              // ignore
            }
          }}
          className="p-2 text-gray-400 hover:text-[#FFC800] transition-colors relative rounded-full hover:bg-[#051026]/50"
          title={canSeeActivity ? 'Log del sistema' : 'Notificaciones'}
        >
          <Bell className="w-5 h-5" />
          {activityHasNew && (
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border-2 border-[#051026]" />
          )}
        </button>
        <div className="h-6 w-px bg-[#FFC800]/30" />
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            className="flex items-center gap-2 rounded-lg px-2 py-1 hover:bg-white/5 transition-colors"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
          >
            <div className="flex flex-col items-end">
              <span className="text-sm font-bold text-white">{displayName}</span>
              <span className="text-[9px] font-bold text-emerald-400 uppercase tracking-widest">{roleLabel}</span>
            </div>
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[#FFC800]/20 to-[#00AEEF]/20 border border-[#FFC800]/50 flex items-center justify-center text-[#FFC800] font-bold">
              <User className="w-5 h-5" />
            </div>
          </button>

          {menuOpen && (
            <div
              role="menu"
              className="absolute right-0 mt-2 w-44 rounded-xl border border-[#FFC800]/20 bg-[#0B1A3A] shadow-xl overflow-hidden z-50"
            >
              <button
                type="button"
                onClick={onLogout}
                role="menuitem"
                className="w-full text-left px-4 py-3 text-sm font-semibold text-white hover:bg-white/5 transition-colors"
              >
                Cerrar sesión
              </button>
              <div className="hidden lg:flex items-center gap-2 ml-2 text-xs">
          <Phone className="w-3.5 h-3.5 text-[#FFC800]" />
          <div className="flex flex-col">
            <span className="font-bold text-white">Soporte:</span>
            <span className="text-[#00AEEF] font-semibold">+506 6126-8302</span>
          
          </div>
        </div>
            </div>
          )}
        </div>
      </div>
    </div>

    <ActivityLogDrawer open={activityOpen} onClose={() => setActivityOpen(false)} />


    {/* Segunda fila: Navegación y Búsqueda */}
    <div className="h-14 flex items-center justify-between px-6 bg-[#051026]/50 gap-4 border-b border-[#FFC800]/20">
      {/* Navegación horizontal */}
      <TopNav canSeeTesoreria={canSeeTesoreria} />
      
      {/* Barra de búsqueda */}
      <div className="flex items-center justify-end gap-3 flex-1">
        <div className="relative w-full max-w-xl group">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-[#FFC800] transition-colors" />
        <input 
          type="text" 
          placeholder="Búsqueda rápida de alumnos, tutores, cursos..." 
          className="w-full bg-white border border-[#FFC800]/20 rounded-lg py-2 pl-11 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-[#00AEEF]/20 focus:border-[#00AEEF] transition-all text-[#051026] placeholder:text-gray-400 shadow-sm"
        />
        </div>

        {/* Zoom global (para Electron / todo el sistema) */}
        <div className="hidden md:flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setUiScale((v) => clamp(Number((v - 0.05).toFixed(2)), 0.6, 1.3))}
            className="h-10 w-10 rounded-lg bg-white/10 border border-white/15 hover:bg-white/15 text-white flex items-center justify-center"
            title="Alejar (-)"
          >
            <Minus className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setUiScale(1)}
            className="h-10 px-3 rounded-lg bg-white/10 border border-white/15 hover:bg-white/15 text-white text-xs font-black tabular-nums"
            title="Restablecer zoom"
          >
            {Math.round(uiScale * 100)}%
          </button>
          <button
            type="button"
            onClick={() => setUiScale((v) => clamp(Number((v + 0.05).toFixed(2)), 0.6, 1.3))}
            className="h-10 w-10 rounded-lg bg-white/10 border border-white/15 hover:bg-white/15 text-white flex items-center justify-center"
            title="Acercar (+)"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  </div>
);
};

const RequireAuth: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  if (!auth.getToken()) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
};

const RequireTesoreria: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [me, setMe] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    api.auth.me()
      .then((res) => setMe(res?.user ?? null))
      .catch(() => setMe(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#051026]">
        <div className="text-white">Cargando...</div>
      </div>
    );
  }

  const rol: string = (me?.rol ?? 'tutor_view_only') as string;
  const canSeeTesoreria = rol === 'admin' || rol === 'contador';
  
  return canSeeTesoreria ? <>{children}</> : <Navigate to="/" replace />;
};

const ProtectedLayout: React.FC = () => {
  const [uiScale, setUiScale] = useState<number>(() => {
    try {
      const raw = localStorage.getItem('ui.scale');
      const value = Number(raw);
      if (Number.isFinite(value)) return clamp(value, 0.6, 1.3);
    } catch {
      // ignore
    }
    return 1;
  });

  useEffect(() => {
    try {
      localStorage.setItem('ui.scale', String(uiScale));
    } catch {
      // ignore
    }
  }, [uiScale]);

  return (
    <div className="flex flex-col min-h-screen bg-[#051026]" style={{ zoom: uiScale } as any}>
      <AppHeader uiScale={uiScale} setUiScale={setUiScale} />
      <main className="flex-grow">
        <div className="p-6 md:p-8 mx-auto w-full animate-in fade-in duration-700">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

const App: React.FC = () => {
  return (
    <HashRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          element={
            <RequireAuth>
              <ProtectedLayout />
            </RequireAuth>
          }
        >
          <Route path="/" element={<Dashboard />} />
          <Route path="/tutores" element={<Tutores />} />
          <Route path="/cursos" element={<Cursos />} />
          <Route path="/estudiantes" element={<Estudiantes />} />
          <Route path="/matriculas" element={<Matriculas />} />
          <Route path="/pagos" element={<RequireTesoreria><Tesoreria /></RequireTesoreria>} />
          <Route path="/empleados" element={<Empleados />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  );
};

export default App;
