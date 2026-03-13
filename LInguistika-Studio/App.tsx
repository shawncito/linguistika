
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { HashRouter, Routes, Route, Link, useLocation, useNavigate, Navigate, Outlet } from 'react-router-dom';
import { 
  LayoutDashboard, Users, BookOpen, GraduationCap, 
  ClipboardList, CreditCard, Menu, X, Languages, Phone, 
  Search, Bell, User,
  Plus, Minus, RotateCcw, Sun, Moon
} from 'lucide-react';

import Dashboard from './views/Dashboard';
import Tutores from './views/Tutores';
import Cursos from './views/Cursos';
import Estudiantes from './views/Estudiantes';
import Matriculas from './views/Matriculas';
import Tesoreria from './views/Tesoreria';
import Login from './views/Login';
import Empleados from './views/Empleados';
import MaintenancePage from './components/MaintenancePage';
import { auth } from './services/api';
import { api } from './services/api';
import { dashboardService } from './services/api/dashboardService';
import { paginasService } from './services/api/paginasService';
import { ConfirmDialog, ToastContainer } from './components';
import { ActivityLogDrawer, ACTIVITY_LAST_SEEN_KEY } from './components/ActivityLogDrawer';
import { useConfirm } from './hooks/useConfirm';
import { useToast } from './hooks/useToast';
import { UI_FEEDBACK_EVENTS, type UiConfirmRequest, uiToast } from './lib/uiFeedback';
import type { Curso, Estudiante, Matricula, Tutor } from './types';

const LOGIN_SUCCESS_FLASH_KEY = 'ui.login.success.flash';
const LOGIN_SUCCESS_TS_KEY = 'ui.login.success.ts';

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

type UiTheme = 'dark' | 'light';

type SearchEntity = 'estudiante' | 'tutor' | 'curso' | 'matricula';

type SearchResult = {
  id: string;
  entity: SearchEntity;
  title: string;
  subtitle: string;
  route: string;
  keywords: string;
};

type SearchCache = {
  fetchedAt: number;
  estudiantes: Estudiante[];
  tutores: Tutor[];
  cursos: Curso[];
  matriculas: Matricula[];
};

const SEARCH_CACHE_TTL_MS = 120000;

const normalizeSearchText = (value: unknown) =>
  String(value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

const SEARCH_ENTITY_META: Record<SearchEntity, { label: string; lightClass: string; darkClass: string }> = {
  estudiante: {
    label: 'Estudiante',
    lightClass: 'bg-sky-100 text-sky-800 border border-sky-200',
    darkClass: 'bg-[#00AEEF]/15 text-[#7DDCFF] border border-[#00AEEF]/25',
  },
  tutor: {
    label: 'Tutor',
    lightClass: 'bg-emerald-100 text-emerald-800 border border-emerald-200',
    darkClass: 'bg-emerald-500/12 text-emerald-200 border border-emerald-400/25',
  },
  curso: {
    label: 'Curso',
    lightClass: 'bg-amber-100 text-amber-800 border border-amber-200',
    darkClass: 'bg-[#FFC800]/15 text-[#FFE082] border border-[#FFC800]/25',
  },
  matricula: {
    label: 'Matrícula',
    lightClass: 'bg-slate-100 text-slate-700 border border-slate-200',
    darkClass: 'bg-white/10 text-slate-200 border border-white/15',
  },
};

const AppHeader: React.FC<{
  uiScale: number;
  setUiScale: React.Dispatch<React.SetStateAction<number>>;
  uiTheme: UiTheme;
  setUiTheme: React.Dispatch<React.SetStateAction<UiTheme>>;
}> = ({ uiScale, setUiScale, uiTheme, setUiTheme }) => {
  const location = useLocation();
  const navigate = useNavigate();
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
  const searchWrapRef = useRef<HTMLDivElement | null>(null);
  const searchCacheRef = useRef<SearchCache | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
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

  useEffect(() => {
    if (!searchOpen) return;
    const onMouseDown = (event: MouseEvent) => {
      const el = searchWrapRef.current;
      if (!el) return;
      if (event.target instanceof Node && !el.contains(event.target)) {
        setSearchOpen(false);
      }
    };

    window.addEventListener('mousedown', onMouseDown);
    return () => window.removeEventListener('mousedown', onMouseDown);
  }, [searchOpen]);

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

  const manualRapidoHref = `${import.meta.env.BASE_URL}manuales/Manual_Rapido_Linguistika.pdf`;
  const manualCompletoHref = `${import.meta.env.BASE_URL}manuales/Manual_Completo_Linguistika.pdf`;
  const isLightTheme = uiTheme === 'light';

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

  const fetchSearchCache = useCallback(async (): Promise<SearchCache> => {
    const now = Date.now();
    if (searchCacheRef.current && (now - searchCacheRef.current.fetchedAt) < SEARCH_CACHE_TTL_MS) {
      return searchCacheRef.current;
    }

    const [estudiantes, tutores, cursos, matriculas] = await Promise.all([
      api.estudiantes.getAll().catch(() => [] as Estudiante[]),
      api.tutores.getAll().catch(() => [] as Tutor[]),
      api.cursos.getAll().catch(() => [] as Curso[]),
      api.matriculas.getAll().catch(() => [] as Matricula[]),
    ]);

    const cache: SearchCache = {
      fetchedAt: now,
      estudiantes,
      tutores,
      cursos,
      matriculas,
    };
    searchCacheRef.current = cache;
    return cache;
  }, []);

  const computeSearchResults = useCallback((cache: SearchCache, query: string): SearchResult[] => {
    const q = normalizeSearchText(query);
    if (q.length < 2) return [];

    const rows: Array<SearchResult & { score: number }> = [];
    const rank = (title: string, keywords: string) => {
      const titleNorm = normalizeSearchText(title);
      const keywordsNorm = normalizeSearchText(keywords);
      if (titleNorm.startsWith(q)) return 5;
      if (titleNorm.includes(` ${q}`)) return 4;
      if (keywordsNorm.startsWith(q)) return 3;
      if (keywordsNorm.includes(q)) return 2;
      return 0;
    };

    const pushIfMatch = (item: SearchResult) => {
      const score = rank(item.title, item.keywords);
      if (score > 0) rows.push({ ...item, score });
    };

    cache.estudiantes.forEach((estudiante) => {
      const title = estudiante.nombre || `Estudiante #${estudiante.id}`;
      const subtitle = [
        'Estudiante',
        estudiante.grado ? `Grado ${estudiante.grado}` : null,
        estudiante.nombre_encargado ? `Encargado: ${estudiante.nombre_encargado}` : null,
      ].filter(Boolean).join(' · ');

      pushIfMatch({
        id: `est-${estudiante.id}`,
        entity: 'estudiante',
        title,
        subtitle,
        route: `/estudiantes`,
        keywords: [title, estudiante.nombre_encargado, estudiante.email_encargado, estudiante.telefono_encargado, estudiante.telefono, estudiante.grado].filter(Boolean).join(' '),
      });
    });

    cache.tutores.forEach((tutor) => {
      const title = tutor.nombre || `Tutor #${tutor.id}`;
      const subtitle = ['Tutor', tutor.especialidad || null, tutor.telefono || null].filter(Boolean).join(' · ');
      pushIfMatch({
        id: `tut-${tutor.id}`,
        entity: 'tutor',
        title,
        subtitle,
        route: `/tutores`,
        keywords: [title, tutor.especialidad, tutor.email, tutor.telefono].filter(Boolean).join(' '),
      });
    });

    cache.cursos.forEach((curso) => {
      const title = curso.nombre || `Curso #${curso.id}`;
      const subtitle = ['Curso', curso.nivel || null, curso.metodo || null].filter(Boolean).join(' · ');
      pushIfMatch({
        id: `cur-${curso.id}`,
        entity: 'curso',
        title,
        subtitle,
        route: `/cursos`,
        keywords: [title, curso.nivel, curso.metodo, curso.tipo_pago, curso.descripcion].filter(Boolean).join(' '),
      });
    });

    cache.matriculas.forEach((matricula) => {
      const title = matricula.estudiante_nombre || matricula.grupo_nombre || `Matrícula #${matricula.id}`;
      const subtitle = [
        'Matrícula',
        matricula.curso_nombre ? `Curso: ${matricula.curso_nombre}` : null,
        matricula.tutor_nombre ? `Tutor: ${matricula.tutor_nombre}` : null,
      ].filter(Boolean).join(' · ');

      pushIfMatch({
        id: `mat-${matricula.id}`,
        entity: 'matricula',
        title,
        subtitle,
        route: `/matriculas`,
        keywords: [
          title,
          matricula.curso_nombre,
          matricula.tutor_nombre,
          matricula.estudiante_nombre,
          matricula.grupo_nombre,
          matricula.grupo_id,
        ].filter(Boolean).join(' '),
      });
    });

    return rows
      .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title, 'es'))
      .slice(0, 12)
      .map(({ score, ...item }) => item);
  }, []);

  const handleSearchResultClick = useCallback((result: SearchResult) => {
    setSearchOpen(false);
    setSearchQuery('');
    navigate(result.route);
  }, [navigate]);

  useEffect(() => {
    if (!searchOpen) {
      setSearchLoading(false);
      setSearchError(null);
      setSearchResults([]);
      return;
    }

    const q = normalizeSearchText(searchQuery);
    if (q.length < 2) {
      setSearchLoading(false);
      setSearchError(null);
      setSearchResults([]);
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setSearchLoading(true);
      setSearchError(null);
      try {
        const cache = await fetchSearchCache();
        if (cancelled) return;
        setSearchResults(computeSearchResults(cache, q));
      } catch {
        if (cancelled) return;
        setSearchResults([]);
        setSearchError('No se pudo completar la búsqueda en este momento.');
      } finally {
        if (!cancelled) setSearchLoading(false);
      }
    }, 220);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [computeSearchResults, fetchSearchCache, searchOpen, searchQuery]);

  useEffect(() => {
    setSearchOpen(false);
    setSearchQuery('');
    setSearchResults([]);
  }, [location.pathname]);

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
  <div className={`sticky top-0 z-50 border-b backdrop-blur-sm ${isLightTheme ? 'bg-white/95 border-slate-200 shadow-sm shadow-slate-200/50' : 'bg-[#051026] border-[#FFC800]'}`}>
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
      #app-tika-logo-wrap {
        transition: opacity 100ms linear;
        will-change: opacity;
      }
      body[data-tika-flying='true'] #app-tika-logo-wrap {
        opacity: 0;
        pointer-events: none;
      }
    `}</style>
    {/* Primera fila: Logo, Usuario y Notificaciones */}
    <div className={`h-16 flex items-center justify-between px-6 border-b ${isLightTheme ? 'border-slate-200' : 'border-[#FFC800]/30'}`}>
      {/* Logo */}
      <Link to="/" className="flex items-center gap-3">
        <div
          id="app-tika-logo-wrap"
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
          className={`relative rounded-full p-2 transition-colors ${isLightTheme ? 'text-slate-500 hover:text-[#D9A900] hover:bg-slate-100' : 'text-gray-400 hover:text-[#FFC800] hover:bg-[#051026]/50'}`}
          title={canSeeActivity ? 'Log del sistema' : 'Notificaciones'}
        >
          <Bell className="w-5 h-5" />
          {activityHasNew && (
            <span className={`absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border-2 ${isLightTheme ? 'border-white' : 'border-[#051026]'}`} />
          )}
        </button>
        <div className="h-6 w-px bg-[#FFC800]/30" />
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            className={`flex items-center gap-2 rounded-lg px-2 py-1 transition-colors ${isLightTheme ? 'hover:bg-slate-100' : 'hover:bg-white/5'}`}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
          >
            <div className="flex flex-col items-end">
              <span className={`text-sm font-bold ${isLightTheme ? 'text-slate-900' : 'text-white'}`}>{displayName}</span>
              <span className="text-[9px] font-bold text-[#00AEEF] uppercase tracking-widest">{roleLabel}</span>
            </div>
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[#FFC800]/20 to-[#00AEEF]/20 border border-[#FFC800]/50 flex items-center justify-center text-[#FFC800] font-bold">
              <User className="w-5 h-5" />
            </div>
          </button>

          {menuOpen && (
            <div
              role="menu"
              className={`absolute right-0 mt-2 w-80 rounded-xl border shadow-xl overflow-hidden z-50 ${isLightTheme ? 'border-slate-200 bg-white' : 'border-[#FFC800]/20 bg-[#0B1A3A]'}`}
            >
              <div className="px-4 py-3 space-y-2">
                <a
                  href={manualRapidoHref}
                  download="Manual_Rapido_Linguistika.pdf"
                  role="menuitem"
                  onClick={() => setMenuOpen(false)}
                  className={`block w-full text-left rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${isLightTheme ? 'bg-slate-50 text-[#008FC6] hover:bg-slate-100' : 'bg-white/5 text-[#00AEEF] hover:bg-white/10'}`}
                >
                  Descargar manual rápido (PDF)
                </a>
                <a
                  href={manualCompletoHref}
                  download="Manual_Completo_Linguistika.pdf"
                  role="menuitem"
                  onClick={() => setMenuOpen(false)}
                  className={`block w-full text-left rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${isLightTheme ? 'bg-slate-50 text-[#008FC6] hover:bg-slate-100' : 'bg-white/5 text-[#00AEEF] hover:bg-white/10'}`}
                >
                  Descargar manual completo (PDF)
                </a>
              </div>
              <div className={`h-px ${isLightTheme ? 'bg-slate-200' : 'bg-white/10'}`} />
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  onLogout();
                }}
                role="menuitem"
                className={`w-full text-left px-4 py-3 text-sm font-semibold transition-colors ${isLightTheme ? 'text-slate-700 hover:bg-slate-100' : 'text-white hover:bg-white/5'}`}
              >
                Cerrar sesión
              </button>
              <div className={`h-px ${isLightTheme ? 'bg-slate-200' : 'bg-white/10'}`} />
              <div className="px-4 py-3 flex items-start gap-3 text-xs">
                <Phone className="w-3.5 h-3.5 text-[#FFC800] mt-0.5" />
                <div className="flex flex-col">
                  <span className={`font-bold ${isLightTheme ? 'text-slate-900' : 'text-white'}`}>Soporte:</span>
                  <a
                    href="tel:+50661268302"
                    className="text-[#00AEEF] font-semibold hover:text-[#7DDCFF] transition-colors"
                  >
                    +506 6126-8302
                  </a>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>

    <ActivityLogDrawer open={activityOpen} onClose={() => setActivityOpen(false)} />


    {/* Segunda fila: Navegación y Búsqueda */}
    <div className={`h-14 flex items-center justify-between px-6 gap-4 border-b ${isLightTheme ? 'bg-white/80 border-slate-200' : 'bg-[#051026]/50 border-[#FFC800]/20'}`}>
      {/* Navegación horizontal */}
      <TopNav canSeeTesoreria={canSeeTesoreria} />
      
      {/* Barra de búsqueda */}
      <div className="flex items-center justify-end gap-3 flex-1">
        <div className="relative w-full max-w-xl group" ref={searchWrapRef}>
        <Search className={`absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 transition-colors ${isLightTheme ? 'text-slate-500 group-focus-within:text-[#D9A900]' : 'text-gray-400 group-focus-within:text-[#FFC800]'}`} />
        <input 
          type="text"
          value={searchQuery}
          onChange={(event) => {
            setSearchQuery(event.target.value);
            if (!searchOpen) setSearchOpen(true);
          }}
          onFocus={() => setSearchOpen(true)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              setSearchOpen(false);
              return;
            }

            if (event.key === 'Enter' && searchResults.length > 0) {
              event.preventDefault();
              handleSearchResultClick(searchResults[0]);
            }
          }}
          placeholder="Buscar estudiante, curso, tutor o matrícula..."
          className={`w-full rounded-lg py-2 pl-11 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-[#00AEEF]/20 focus:border-[#00AEEF] transition-all shadow-sm ${isLightTheme ? 'bg-white border border-slate-200 text-slate-900 placeholder:text-slate-400' : 'bg-white border border-[#FFC800]/20 text-[#051026] placeholder:text-gray-400'}`}
        />
        {searchOpen && (
          <div className={`absolute left-0 right-0 top-[calc(100%+0.4rem)] rounded-xl border shadow-xl overflow-hidden z-50 ${isLightTheme ? 'border-slate-200 bg-white' : 'border-[#FFC800]/20 bg-[#0B1A3A]'}`}>
            <div className={`px-3 py-2 text-[11px] font-bold uppercase tracking-wider ${isLightTheme ? 'text-slate-500 bg-slate-50 border-b border-slate-200' : 'text-slate-300 bg-white/5 border-b border-white/10'}`}>
              Buscador global
            </div>

            <div className="max-h-80 overflow-y-auto">
              {searchLoading && (
                <div className={`px-4 py-3 text-sm ${isLightTheme ? 'text-slate-600' : 'text-slate-300'}`}>
                  Buscando...
                </div>
              )}

              {!searchLoading && searchError && (
                <div className="px-4 py-3 text-sm text-red-500">
                  {searchError}
                </div>
              )}

              {!searchLoading && !searchError && normalizeSearchText(searchQuery).length < 2 && (
                <div className={`px-4 py-3 text-sm ${isLightTheme ? 'text-slate-600' : 'text-slate-300'}`}>
                  Escribe al menos 2 letras para buscar.
                </div>
              )}

              {!searchLoading && !searchError && normalizeSearchText(searchQuery).length >= 2 && searchResults.length === 0 && (
                <div className={`px-4 py-3 text-sm ${isLightTheme ? 'text-slate-600' : 'text-slate-300'}`}>
                  No se encontraron coincidencias.
                </div>
              )}

              {!searchLoading && !searchError && searchResults.map((result) => {
                const entityMeta = SEARCH_ENTITY_META[result.entity];
                return (
                  <button
                    key={result.id}
                    type="button"
                    onClick={() => handleSearchResultClick(result)}
                    className={`w-full px-4 py-3 text-left border-b last:border-b-0 transition-colors ${isLightTheme ? 'border-slate-100 hover:bg-slate-50' : 'border-white/10 hover:bg-white/5'}`}
                  >
                    <div className="flex items-start gap-3">
                      <span className={`mt-0.5 rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ${isLightTheme ? entityMeta.lightClass : entityMeta.darkClass}`}>
                        {entityMeta.label}
                      </span>
                      <div className="min-w-0">
                        <div className={`text-sm font-bold truncate ${isLightTheme ? 'text-slate-900' : 'text-white'}`}>
                          {result.title}
                        </div>
                        <div className={`text-xs truncate mt-0.5 ${isLightTheme ? 'text-slate-500' : 'text-slate-400'}`}>
                          {result.subtitle}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
        </div>

        <button
          type="button"
          onClick={() => setUiTheme((prev) => (prev === 'light' ? 'dark' : 'light'))}
          className={`inline-flex h-10 items-center gap-2 rounded-lg px-3 text-xs font-black transition-colors ${isLightTheme ? 'bg-slate-100 border border-slate-200 text-slate-700 hover:bg-slate-200' : 'bg-white/10 border border-white/15 text-white hover:bg-white/15'}`}
          title={isLightTheme ? 'Cambiar a modo oscuro' : 'Cambiar a modo claro'}
        >
          {isLightTheme ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
          <span className="hidden xl:inline">{isLightTheme ? 'Modo oscuro' : 'Modo claro'}</span>
        </button>

        {/* Zoom global (para Electron / todo el sistema) */}
        <div className="hidden md:flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setUiScale((v) => clamp(Number((v - 0.05).toFixed(2)), 0.6, 1.3))}
            className={`h-10 w-10 rounded-lg border flex items-center justify-center transition-colors ${isLightTheme ? 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200' : 'bg-white/10 border-white/15 hover:bg-white/15 text-white'}`}
            title="Alejar (-)"
          >
            <Minus className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setUiScale(1)}
            className={`h-10 px-3 rounded-lg border text-xs font-black tabular-nums transition-colors ${isLightTheme ? 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200' : 'bg-white/10 border-white/15 hover:bg-white/15 text-white'}`}
            title="Restablecer zoom"
          >
            {Math.round(uiScale * 100)}%
          </button>
          <button
            type="button"
            onClick={() => setUiScale((v) => clamp(Number((v + 0.05).toFixed(2)), 0.6, 1.3))}
            className={`h-10 w-10 rounded-lg border flex items-center justify-center transition-colors ${isLightTheme ? 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200' : 'bg-white/10 border-white/15 hover:bg-white/15 text-white'}`}
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

/**
 * Guarda de mantenimiento: si la página está desactivada por un admin,
 * muestra la pantalla de mantenimiento en lugar del contenido real.
 * Los admins siempre tienen acceso directo.
 */
const RequirePageActive: React.FC<{ slug: string; children: React.ReactNode }> = ({ slug, children }) => {
  const [status, setStatus] = useState<{ activa: boolean; nombre: string; mensaje: string | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [userRol, setUserRol] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      api.auth.me().catch(() => ({ user: null })),
      paginasService.getPaginasEstado().catch(() => [] as any[]),
    ]).then(([meRes, paginas]) => {
      if (cancelled) return;
      const rol = meRes?.user?.rol ?? null;
      setUserRol(rol);
      const found = (paginas as any[]).find((p: any) => p.slug === slug);
      setStatus(found ? { activa: found.activa, nombre: found.nombre, mensaje: found.mensaje ?? null } : null);
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [slug]);

  if (loading) return null; // espera silenciosa; el layout ya muestra el shell

  // Admins siempre pasan
  if (userRol === 'admin') return <>{children}</>;

  // Página desactivada → mostrar mantenimiento
  if (status && !status.activa) {
    return <MaintenancePage pageName={status.nombre} mensaje={status.mensaje} />;
  }

  return <>{children}</>;
};

const RouteTransitionFrame: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  return (
    <div key={location.pathname} className="ui-page-transition">
      {children}
    </div>
  );
};

const GlobalFeedbackHost: React.FC = () => {
  const location = useLocation();
  const { toasts, toast, dismiss } = useToast();
  const { confirmState, confirm, handleConfirm, handleCancel } = useConfirm();
  const confirmChainRef = useRef<Promise<void>>(Promise.resolve());
  const toastRef = useRef(toast);

  useEffect(() => {
    toastRef.current = toast;
  }, [toast]);

  const sessionReminderScheduledRef = useRef(false);
  const loginReminderTimerRef = useRef<number | null>(null);

  useEffect(() => {
    try {
      const message = sessionStorage.getItem(LOGIN_SUCCESS_FLASH_KEY);
      if (!message) return;
      sessionStorage.removeItem(LOGIN_SUCCESS_FLASH_KEY);
      uiToast(message, 'success', 4200);

      if (!sessionReminderScheduledRef.current) {
        sessionReminderScheduledRef.current = true;
        const hoy = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Costa_Rica' });
        const loginTs = Number(sessionStorage.getItem(LOGIN_SUCCESS_TS_KEY) || '0');
        const elapsedFromLogin = loginTs > 0 ? Math.max(0, Date.now() - loginTs) : 0;
        const delay = Math.max(0, 10000 - elapsedFromLogin);

        if (loginReminderTimerRef.current) {
          window.clearTimeout(loginReminderTimerRef.current);
          loginReminderTimerRef.current = null;
        }

        loginReminderTimerRef.current = window.setTimeout(async () => {
          try {
            const sessions = await dashboardService.getAgenda(hoy);
            const waiting = sessions.filter((s: any) => Boolean(s?.avisado) && !Boolean(s?.confirmado));
            if (waiting.length > 0) {
              uiToast(
                `${waiting.length} sesión${waiting.length !== 1 ? 'es' : ''} de hoy sigue${waiting.length !== 1 ? 'n' : ''} en espera — recuerda confirmar o marcar como dada cuando corresponda`,
                'warning',
                7000
              );
            }
          } catch { /* ignore */ }
        }, delay);
      }
    } catch {
      // ignore
    }
  }, [location.pathname]);

  useEffect(() => {
    return () => {
      if (loginReminderTimerRef.current) {
        window.clearTimeout(loginReminderTimerRef.current);
        loginReminderTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const onToast = (event: Event) => {
      const detail = (event as CustomEvent<{ message?: string; type?: 'success' | 'error' | 'warning' | 'info'; duration?: number }>).detail;
      if (!detail?.message) return;

      const type = detail.type ?? 'info';
      if (type === 'success') toastRef.current.success(detail.message, detail.duration);
      if (type === 'error') toastRef.current.error(detail.message, detail.duration);
      if (type === 'warning') toastRef.current.warning(detail.message, detail.duration);
      if (type === 'info') toastRef.current.info(detail.message, detail.duration);
    };

    window.addEventListener(UI_FEEDBACK_EVENTS.TOAST_EVENT, onToast as EventListener);
    return () => window.removeEventListener(UI_FEEDBACK_EVENTS.TOAST_EVENT, onToast as EventListener);
  }, []);

  useEffect(() => {
    const onConfirm = (event: Event) => {
      const detail = (event as CustomEvent<UiConfirmRequest>).detail;
      if (!detail || typeof detail.resolve !== 'function') return;

      const { resolve, ...options } = detail;
      confirmChainRef.current = confirmChainRef.current
        .then(async () => {
          const ok = await confirm(options);
          resolve(ok);
        })
        .catch(() => resolve(false));
    };

    window.addEventListener(UI_FEEDBACK_EVENTS.CONFIRM_EVENT, onConfirm as EventListener);
    return () => window.removeEventListener(UI_FEEDBACK_EVENTS.CONFIRM_EVENT, onConfirm as EventListener);
  }, [confirm]);

  useEffect(() => {
    const runtime = window as typeof window & { __uiAlertPatched?: boolean; __uiAlertOriginal?: typeof window.alert };
    if (runtime.__uiAlertPatched) return;

    runtime.__uiAlertOriginal = window.alert.bind(window);
    window.alert = ((message?: any) => {
      const text = String(message ?? '').trim();
      if (!text) return;
      uiToast(text, 'info', 4200);
    }) as typeof window.alert;
    runtime.__uiAlertPatched = true;

    return () => {
      if (runtime.__uiAlertPatched && runtime.__uiAlertOriginal) {
        window.alert = runtime.__uiAlertOriginal;
      }
      runtime.__uiAlertPatched = false;
      delete runtime.__uiAlertOriginal;
    };
  }, []);

  useEffect(() => {
    const hasToastVisible = toasts.length > 0;
    document.body.dataset.tikaFlying = hasToastVisible ? 'true' : '';
    if (!hasToastVisible) {
      document.body.style.removeProperty('--tika-flight-dx');
      document.body.style.removeProperty('--tika-flight-dy');
    }
    return () => {
      document.body.dataset.tikaFlying = '';
      document.body.style.removeProperty('--tika-flight-dx');
      document.body.style.removeProperty('--tika-flight-dy');
    };
  }, [toasts.length]);

  useEffect(() => {
    if (toasts.length === 0) return;

    const syncFlightVector = () => {
      const logo = document.getElementById('app-tika-logo-wrap');
      const mascotAnchor = document.querySelector('[data-tika-toast-anchor]') as HTMLElement | null;
      if (!logo || !mascotAnchor) return;

      const logoRect = logo.getBoundingClientRect();
      const mascotRect = mascotAnchor.getBoundingClientRect();

      const logoX = logoRect.left + logoRect.width / 2;
      const logoY = logoRect.top + logoRect.height / 2;
      const mascotX = mascotRect.left + mascotRect.width / 2;
      const mascotY = mascotRect.top + mascotRect.height / 2;

      const dx = logoX - mascotX;
      const dy = logoY - mascotY;

      document.body.style.setProperty('--tika-flight-dx', `${dx.toFixed(2)}px`);
      document.body.style.setProperty('--tika-flight-dy', `${dy.toFixed(2)}px`);
    };

    const raf = window.requestAnimationFrame(syncFlightVector);
    window.addEventListener('resize', syncFlightVector);

    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener('resize', syncFlightVector);
    };
  }, [toasts.length]);

  return (
    <>
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
      <ConfirmDialog
        {...confirmState}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    </>
  );
};

const ProtectedLayout: React.FC = () => {
  const location = useLocation();
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
  const [uiTheme, setUiTheme] = useState<UiTheme>(() => {
    try {
      const saved = localStorage.getItem('ui.theme');
      return saved === 'light' ? 'light' : 'dark';
    } catch {
      return 'dark';
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('ui.scale', String(uiScale));
    } catch {
      // ignore
    }
  }, [uiScale]);

  useEffect(() => {
    try {
      localStorage.setItem('ui.theme', uiTheme);
    } catch {
      // ignore
    }

    document.body.classList.remove('theme-dark', 'theme-light');
    document.body.classList.add(uiTheme === 'light' ? 'theme-light' : 'theme-dark');
    document.body.dataset.theme = uiTheme;
  }, [uiTheme]);

  return (
    <div className={`flex flex-col min-h-screen ${uiTheme === 'light' ? 'bg-[#f8fbff]' : 'bg-[#051026]'}`} style={{ zoom: uiScale, ['--ui-scale' as any]: String(uiScale) } as any}>
      <AppHeader uiScale={uiScale} setUiScale={setUiScale} uiTheme={uiTheme} setUiTheme={setUiTheme} />
      <main className="flex-grow">
        <div className="p-6 md:p-8 mx-auto w-full">
          <div key={location.pathname} className="ui-page-transition">
            <Outlet />
          </div>
        </div>
      </main>
    </div>
  );
};

const App: React.FC = () => {
  useEffect(() => {
    const initialTheme = (() => {
      try {
        return localStorage.getItem('ui.theme') === 'light' ? 'light' : 'dark';
      } catch {
        return 'dark';
      }
    })();

    document.body.classList.remove('theme-dark', 'theme-light');
    document.body.classList.add(initialTheme === 'light' ? 'theme-light' : 'theme-dark');
    document.body.dataset.theme = initialTheme;
  }, []);

  return (
    <HashRouter>
      <GlobalFeedbackHost />
      <Routes>
        <Route path="/login" element={<RouteTransitionFrame><Login /></RouteTransitionFrame>} />
        <Route
          element={
            <RequireAuth>
              <ProtectedLayout />
            </RequireAuth>
          }
        >
          <Route path="/" element={<RequirePageActive slug="dashboard"><Dashboard /></RequirePageActive>} />
          <Route path="/tutores" element={<RequirePageActive slug="tutores"><Tutores /></RequirePageActive>} />
          <Route path="/cursos" element={<RequirePageActive slug="cursos"><Cursos /></RequirePageActive>} />
          <Route path="/estudiantes" element={<RequirePageActive slug="estudiantes"><Estudiantes /></RequirePageActive>} />
          <Route path="/matriculas" element={<RequirePageActive slug="matriculas"><Matriculas /></RequirePageActive>} />
          <Route path="/pagos" element={<RequirePageActive slug="pagos"><RequireTesoreria><Tesoreria /></RequireTesoreria></RequirePageActive>} />
          <Route path="/empleados" element={<RequirePageActive slug="empleados"><Empleados /></RequirePageActive>} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  );
};

export default App;
