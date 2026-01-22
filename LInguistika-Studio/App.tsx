
import React, { useState } from 'react';
import { HashRouter, Routes, Route, Link, useLocation, Navigate, Outlet } from 'react-router-dom';
import { 
  LayoutDashboard, Users, BookOpen, GraduationCap, 
  ClipboardList, CreditCard, Menu, X, Languages, Phone, 
  Search, Bell, User, Settings, LogOut
} from 'lucide-react';

import Dashboard from './views/Dashboard';
import Tutores from './views/Tutores';
import Cursos from './views/Cursos';
import Estudiantes from './views/Estudiantes';
import Matriculas from './views/Matriculas';
import Pagos from './views/Pagos';
import Login from './views/Login';
import { auth } from './services/api';

const Sidebar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();

  const navItems = [
    { name: 'Dashboard', path: '/', icon: <LayoutDashboard className="w-5 h-5" /> },
    { name: 'Estudiantes', path: '/estudiantes', icon: <GraduationCap className="w-5 h-5" /> },
    { name: 'Tutores', path: '/tutores', icon: <Users className="w-5 h-5" /> },
    { name: 'Cursos', path: '/cursos', icon: <BookOpen className="w-5 h-5" /> },
    { name: 'Matrículas', path: '/matriculas', icon: <ClipboardList className="w-5 h-5" /> },
    { name: 'Pagos', path: '/pagos', icon: <CreditCard className="w-5 h-5" /> },
  ];

  const SidebarContent = () => (
    <div className="flex flex-col h-full bg-white border-r border-slate-200">
      <div className="h-20 flex items-center px-8 border-b border-slate-100">
        <Link to="/" className="flex items-center gap-3">
          <div className="bg-blue-600 p-2 rounded-xl text-white shadow-lg shadow-blue-200">
            <Languages className="w-6 h-6" />
          </div>
          <div className="flex flex-col">
            <span className="font-extrabold text-lg tracking-tight text-slate-900 leading-none">Lingüistika</span>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Admin Panel</span>
          </div>
        </Link>
      </div>

      <nav className="flex-grow py-8 px-4 space-y-1.5">
        <p className="px-4 text-[10px] font-extrabold text-slate-400 uppercase tracking-[0.2em] mb-4">Gestión Academia</p>
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={() => setIsOpen(false)}
              className={`flex items-center px-4 py-3 rounded-xl text-sm font-semibold transition-all group ${
                isActive
                  ? 'bg-blue-50 text-blue-700 shadow-sm border border-blue-100'
                  : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <span className={`mr-3 transition-colors ${isActive ? 'text-blue-600' : 'text-slate-400 group-hover:text-slate-600'}`}>
                {item.icon}
              </span>
              {item.name}
            </Link>
          );
        })}
      </nav>

      <div className="p-6 border-t border-slate-100">
        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
            <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-white rounded-lg text-amber-500 border border-slate-200 shadow-sm">
                    <Phone className="w-4 h-4" />
                </div>
                <span className="text-xs font-bold text-slate-700">Central Telefónica</span>
            </div>
            <p className="text-sm font-bold text-slate-900">+506 7095-2430</p>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <div className="lg:hidden fixed top-6 right-6 z-[60]">
        <button onClick={() => setIsOpen(!isOpen)} className="p-3 bg-white border border-slate-200 text-slate-900 rounded-2xl shadow-xl">
          {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      <aside className="hidden lg:flex flex-col w-64 h-screen fixed top-0 left-0 z-50">
        <SidebarContent />
      </aside>

      {isOpen && (
        <div className="lg:hidden fixed inset-0 z-[55] animate-in fade-in duration-300">
            <div className="absolute inset-0 bg-slate-900/20 backdrop-blur-sm" onClick={() => setIsOpen(false)} />
            <aside className="relative w-64 h-full animate-in slide-in-from-left duration-300 shadow-2xl">
                <SidebarContent />
            </aside>
        </div>
      )}
    </>
  );
};

const AppBar = () => (
    <div className="h-20 flex items-center justify-between px-10 border-b border-slate-200 bg-white/80 backdrop-blur-md sticky top-0 z-40">
        <div className="flex items-center gap-6 w-full max-w-xl">
            <div className="relative w-full group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-blue-600 transition-colors" />
                <input 
                    type="text" 
                    placeholder="Búsqueda rápida de alumnos..." 
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 pl-12 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition-all text-slate-900 placeholder:text-slate-400"
                />
            </div>
        </div>
        <div className="flex items-center gap-6">
            <button className="p-2 text-slate-400 hover:text-blue-600 transition-colors relative rounded-full hover:bg-slate-50">
                <Bell className="w-5 h-5" />
                <span className="absolute top-2 right-2.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white" />
            </button>
            <div className="h-8 w-px bg-slate-200" />
            <div className="flex items-center gap-3">
                <div className="flex flex-col items-end">
                    <span className="text-sm font-bold text-slate-900">Admin User</span>
                    <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">Online</span>
                </div>
                <div className="w-11 h-11 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shadow-sm">
                    <User className="w-6 h-6" />
                </div>
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
  <div className="flex min-h-screen bg-[#f8fafc]">
    <Sidebar />
    <main className="flex-grow lg:ml-64 flex flex-col">
      <AppBar />
      <div className="p-10 max-w-7xl mx-auto w-full animate-in fade-in duration-700">
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
