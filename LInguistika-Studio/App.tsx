
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { HashRouter, Routes, Route, Link, useLocation, Navigate, Outlet } from 'react-router-dom';
import { 
  LayoutDashboard, Users, BookOpen, GraduationCap, 
  ClipboardList, CreditCard, Menu, X, Languages, Phone, 
  Search, Bell, User
} from 'lucide-react';

import Dashboard from './views/Dashboard';
import Tutores from './views/Tutores';
import Cursos from './views/Cursos';
import Estudiantes from './views/Estudiantes';
import Matriculas from './views/Matriculas';
import Pagos from './views/Pagos';
import Login from './views/Login';
import Empleados from './views/Empleados';
import { auth } from './services/api';
import { api } from './services/api';

const TopNav = () => {
  const location = useLocation();

  const navItems = [
    { name: 'Dashboard', path: '/', icon: <LayoutDashboard className="w-4 h-4" /> },
    { name: 'Estudiantes', path: '/estudiantes', icon: <GraduationCap className="w-4 h-4" /> },
    { name: 'Tutores', path: '/tutores', icon: <Users className="w-4 h-4" /> },
    { name: 'Cursos', path: '/cursos', icon: <BookOpen className="w-4 h-4" /> },
    { name: 'Matrículas', path: '/matriculas', icon: <ClipboardList className="w-4 h-4" /> },
    { name: 'Pagos', path: '/pagos', icon: <CreditCard className="w-4 h-4" /> },
    { name: 'Empleados', path: '/empleados', icon: <Users className="w-4 h-4" /> },
  ];

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

const AppHeader = () => {
  const [me, setMe] = useState<any | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

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

  return (
  <div className="bg-[#051026] border-b border-[#FFC800] sticky top-0 z-50">
    {/* Primera fila: Logo, Usuario y Notificaciones */}
    <div className="h-16 flex items-center justify-between px-6 border-b border-[#FFC800]/30">
      {/* Logo */}
      <Link to="/" className="flex items-center gap-3">
        <div className="w-12 h-12 drop-shadow-2xl">
          <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
            <path d="M 50 20 Q 30 20 30 40 L 30 160 Q 30 180 50 180 L 100 180 L 100 20 Z" fill="#FFC800" />
            <path d="M 100 20 L 100 180 L 150 180 Q 170 180 170 160 L 170 40 Q 170 20 150 20 Z" fill="#00AEEF" />
            <ellipse cx="60" cy="70" rx="8" ry="12" fill="#051026" />
            <ellipse cx="140" cy="70" rx="8" ry="12" fill="#051026" />
            <path d="M 70 110 Q 100 140 130 110" stroke="#051026" strokeWidth="12" fill="none" strokeLinecap="round" />
          </svg>
        </div>
        <div className="flex flex-col">
          <span className="font-extrabold text-lg tracking-tight text-[#FFC800] leading-none">Lingüistika</span>
          <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">UNADECA Language Center</span>
        </div>
      </Link>

      {/* Usuario y notificaciones */}
      <div className="flex items-center gap-4">
        <button className="p-2 text-gray-400 hover:text-[#FFC800] transition-colors relative rounded-full hover:bg-[#051026]/50">
          <Bell className="w-5 h-5" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border-2 border-[#051026]" />
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


    {/* Segunda fila: Navegación y Búsqueda */}
    <div className="h-14 flex items-center justify-between px-6 bg-[#051026]/50 gap-4 border-b border-[#FFC800]/20">
      {/* Navegación horizontal */}
      <TopNav />
      
      {/* Barra de búsqueda */}
      <div className="relative flex-1 max-w-xl group">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-[#FFC800] transition-colors" />
        <input 
          type="text" 
          placeholder="Búsqueda rápida de alumnos, tutores, cursos..." 
          className="w-full bg-white border border-[#FFC800]/20 rounded-lg py-2 pl-11 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-[#00AEEF]/20 focus:border-[#00AEEF] transition-all text-[#051026] placeholder:text-gray-400 shadow-sm"
        />
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

const ProtectedLayout: React.FC = () => (
  <div className="flex flex-col min-h-screen bg-[#051026]">
    <AppHeader />
    <main className="flex-grow">
      <div className="p-8 max-w-[1600px] mx-auto w-full animate-in fade-in duration-700">
        <Outlet />
      </div>
    </main>
  </div>
);

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
          <Route path="/pagos" element={<Pagos />} />
          <Route path="/empleados" element={<Empleados />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  );
};

export default App;
