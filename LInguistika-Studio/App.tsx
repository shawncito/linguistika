
import React, { useState } from 'react';
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
import { auth } from './services/api';

const TopNav = () => {
  const location = useLocation();

  const navItems = [
    { name: 'Dashboard', path: '/', icon: <LayoutDashboard className="w-4 h-4" /> },
    { name: 'Estudiantes', path: '/estudiantes', icon: <GraduationCap className="w-4 h-4" /> },
    { name: 'Tutores', path: '/tutores', icon: <Users className="w-4 h-4" /> },
    { name: 'Cursos', path: '/cursos', icon: <BookOpen className="w-4 h-4" /> },
    { name: 'Matrículas', path: '/matriculas', icon: <ClipboardList className="w-4 h-4" /> },
    { name: 'Pagos', path: '/pagos', icon: <CreditCard className="w-4 h-4" /> },
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

const AppHeader = () => (
  <div className="bg-[#051026] border-b border-[#FFC800] sticky top-0 z-50">
    {/* Primera fila: Logo, Usuario y Notificaciones */}
    <div className="h-16 flex items-center justify-between px-6 border-b border-[#FFC800]/30">
      {/* Logo */}
      <Link to="/" className="flex items-center gap-3">
        <img src="/logo-icon.svg" alt="Linguistika" className="w-12 h-12" />
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
        <div className="flex items-center gap-2">
          <div className="flex flex-col items-end">
            <span className="text-sm font-bold text-white">Admin User</span>
            <span className="text-[9px] font-bold text-emerald-400 uppercase tracking-widest">Online</span>
          </div>
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[#FFC800]/20 to-[#00AEEF]/20 border border-[#FFC800]/50 flex items-center justify-center text-[#FFC800] font-bold">
            <User className="w-5 h-5" />
          </div>
        </div>
        <div className="hidden lg:flex items-center gap-2 ml-2 text-xs">
          <Phone className="w-3.5 h-3.5 text-[#FFC800]" />
          <span className="font-bold text-white">+506 7095-2430</span>
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
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  );
};

export default App;
