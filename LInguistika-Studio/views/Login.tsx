import React, { useEffect, useRef, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Lock, Mail, X } from 'lucide-react';
import { api, auth } from '../services/api';
import { Button, Card, Input, Label, Select } from '../components/UI';

const Login: React.FC = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('admin@linguistika.com');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sad, setSad] = useState(false);
  const sadTimerRef = useRef<number | null>(null);
  const isSad = sad && !loading;
  const logoRef = useRef<HTMLDivElement | null>(null);
  const [pupilOffset, setPupilOffset] = useState({ x: 0, y: 0 });
  const [blink, setBlink] = useState({ left: false, right: false });
  const [isHoverLogo, setIsHoverLogo] = useState(false);
  const [tapCount, setTapCount] = useState(0);
  const [eggActive, setEggActive] = useState(false);
  const tapTimerRef = useRef<number | null>(null);
  const eggTimerRef = useRef<number | null>(null);

  // Estados para correos guardados
  const [savedEmails, setSavedEmails] = useState<string[]>([]);
  const [useCustomEmail, setUseCustomEmail] = useState(false);
  const [customEmail, setCustomEmail] = useState('');

  const faceOffset = { x: pupilOffset.x * 0.9, y: pupilOffset.y * 0.6 };
  const mouthPath = isSad
    ? 'M 70 128 Q 100 100 130 128'
    : eggActive
    ? 'M 65 108 Q 100 150 135 108'
    : 'M 70 110 Q 100 140 130 110';

  // Cargar correos: primero obtener activos de la API
  useEffect(() => {
    const loadEmails = async () => {
      try {
        // Obtener lista de correos activos desde la API (solo si NO estamos en login)
        try {
          // No intentar cargar desde API en la pantalla de login (no hay token aún)
          const stored = localStorage.getItem('saved_emails');
          const savedEmails = stored ? JSON.parse(stored) as string[] : [];
          
          if (savedEmails.length > 0) {
            setSavedEmails(Array.from(new Set(savedEmails)));
            setEmail(savedEmails[0]);
            setUseCustomEmail(false);
          }
        } catch (apiErr) {
          // Si falla, usar solo los guardados
          const stored = localStorage.getItem('saved_emails');
          const savedEmails = stored ? JSON.parse(stored) as string[] : [];
          if (savedEmails.length > 0) {
            setSavedEmails(Array.from(new Set(savedEmails)));
            setEmail(savedEmails[0]);
            setUseCustomEmail(false);
          }
        }
      } catch {
        setSavedEmails([]);
      }
    };

    loadEmails();
  }, []);

  if (auth.getToken()) {
    return <Navigate to="/" replace />;
  }

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
    return () => {
      if (sadTimerRef.current) window.clearTimeout(sadTimerRef.current);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (tapTimerRef.current) window.clearTimeout(tapTimerRef.current);
      if (eggTimerRef.current) window.clearTimeout(eggTimerRef.current);
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

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    setSad(false);
    if (sadTimerRef.current) {
      window.clearTimeout(sadTimerRef.current);
      sadTimerRef.current = null;
    }

    const loginEmail = useCustomEmail ? customEmail : email;

    try {
      const res = await api.auth.login(loginEmail, password);
      auth.setToken(res.token);
      
      // Guardar correo en localStorage
      const stored = localStorage.getItem('saved_emails');
      const emails = stored ? JSON.parse(stored) : [];
      const updatedEmails = [loginEmail, ...emails.filter((e: string) => e !== loginEmail)].slice(0, 5); // Guardar últimos 5
      localStorage.setItem('saved_emails', JSON.stringify(updatedEmails));
      
      navigate('/', { replace: true });
    } catch (err: any) {
      const msg = err?.response?.data?.error;
      const details = err?.response?.data?.details;
      setError(details ? `${msg}: ${details}` : (msg || 'No se pudo iniciar sesión'));
      setSad(true);
      if (sadTimerRef.current) window.clearTimeout(sadTimerRef.current);
      sadTimerRef.current = window.setTimeout(() => {
        setSad(false);
      }, 5000);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectSavedEmail = (selectedEmail: string) => {
    if (selectedEmail === 'custom') {
      setUseCustomEmail(true);
      setCustomEmail('');
    } else {
      setUseCustomEmail(false);
      setEmail(selectedEmail);
    }
  };

  const handleRemoveSavedEmail = (emailToRemove: string) => {
    const updated = savedEmails.filter(e => e !== emailToRemove);
    setSavedEmails(updated);
    localStorage.setItem('saved_emails', JSON.stringify(updated));
    if (emailToRemove === email && updated.length > 0) {
      setEmail(updated[0]);
    } else if (emailToRemove === email && updated.length === 0) {
      setUseCustomEmail(true);
      setCustomEmail('');
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

  return (
    <div 
      className="min-h-screen flex items-center justify-center p-6 relative"
      style={{
        background: `
          radial-gradient(circle at 20% 50%, rgba(0, 174, 239, 0.15) 0%, transparent 50%),
          radial-gradient(circle at 80% 80%, rgba(255, 200, 0, 0.15) 0%, transparent 50%),
          radial-gradient(circle at 40% 20%, rgba(5, 16, 38, 0.6) 0%, transparent 40%),
          linear-gradient(135deg, #051026 0%, #0F2445 50%, #051026 100%)
        `,
      }}
    >
      <style>{`
        @keyframes loginFaceFloat {
          0%, 100% { transform: translateY(0px) rotate(0deg) scale(1); }
          50% { transform: translateY(3px) rotate(0.8deg) scale(1.01); }
        }
        @keyframes loginMouthIdle {
          0%, 100% { stroke-dasharray: 120; stroke-dashoffset: 0; }
          50% { stroke-dasharray: 120; stroke-dashoffset: 18; }
        }
        @keyframes loginEggPulse {
          0%, 100% { transform: rotate(0deg) scale(1); }
          50% { transform: rotate(2.5deg) scale(1.06); }
        }
        @keyframes loginEggSparkle {
          0%, 100% { opacity: 0; transform: scale(0.8); }
          50% { opacity: 1; transform: scale(1); }
        }
        .login-mouth {
          animation: loginMouthIdle 4.5s ease-in-out infinite;
          transform-origin: 100px 120px;
        }
        .login-face {
          animation: loginFaceFloat 6s ease-in-out infinite;
          transform-origin: 50% 50%;
          transform-box: fill-box;
        }
        .login-egg {
          animation: loginEggPulse 1.8s ease-in-out infinite;
          filter: drop-shadow(0 0 12px rgba(255, 200, 0, 0.45));
        }
        .login-egg-sparkles {
          animation: loginEggSparkle 1.2s ease-in-out infinite;
          transform-origin: 50% 50%;
        }
      `}</style>
      {/* Pattern overlay */}
      <div className="absolute inset-0 opacity-[0.03]" style={{
        backgroundImage: `
          repeating-linear-gradient(45deg, transparent, transparent 35px, rgba(255,255,255,.5) 35px, rgba(255,255,255,.5) 36px),
          repeating-linear-gradient(-45deg, transparent, transparent 35px, rgba(255,255,255,.3) 35px, rgba(255,255,255,.3) 36px)
        `
      }} />
      
      <div className="w-full max-w-md relative z-10">
        {/* Logo y texto */}
        <div className="flex flex-col items-center gap-4 mb-8">
          <div
            className={`w-24 h-24 ${eggActive ? 'login-egg' : ''}`}
            ref={logoRef}
            onMouseEnter={() => setIsHoverLogo(true)}
            onMouseLeave={() => setIsHoverLogo(false)}
            onClick={handleLogoTap}
            title="Toca 7 veces"
          >
            <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" className="w-full h-full drop-shadow-2xl">
              <defs>
                <filter id="faceShadow" x="-20%" y="-20%" width="140%" height="140%">
                  <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="#000000" floodOpacity="0.45" />
                  <feDropShadow dx="0" dy="5" stdDeviation="6" floodColor="#000000" floodOpacity="0.25" />
                </filter>
              </defs>
              {eggActive && (
                <g className="login-egg-sparkles">
                  <circle cx="22" cy="32" r="4" fill="#FFC800" opacity="0.7" />
                  <circle cx="178" cy="42" r="3" fill="#00AEEF" opacity="0.65" />
                  <circle cx="28" cy="160" r="3" fill="#FFC800" opacity="0.6" />
                  <circle cx="170" cy="158" r="4" fill="#00AEEF" opacity="0.6" />
                </g>
              )}
              {/* Mitad izquierda amarilla */}
              <path d="M 50 20 Q 30 20 30 40 L 30 160 Q 30 180 50 180 L 100 180 L 100 20 Z" fill="#FFC800" />
              
              {/* Mitad derecha azul */}
              <path d="M 100 20 L 100 180 L 150 180 Q 170 180 170 160 L 170 40 Q 170 20 150 20 Z" fill="#00AEEF" />
              
              {/* Cara (se mueve sutilmente con el mouse) */}
              <g className="login-face">
                <g transform={`translate(${faceOffset.x} ${faceOffset.y})`} filter="url(#faceShadow)">
                  {/* Ojo izquierdo */}
                  <g transform={`translate(60 70) scale(1 ${blink.left ? 0.2 : 1}) translate(-60 -70)`}>
                    <ellipse cx="60" cy="70" rx="10" ry="13" fill="#051026" />
                    <circle cx={60 + pupilOffset.x} cy={70 + pupilOffset.y} r="4.2" fill="#0F2445" />
                  </g>
                
                  {/* Ojo derecho */}
                  <g transform={`translate(140 70) scale(1 ${blink.right ? 0.2 : 1}) translate(-140 -70)`}>
                    <ellipse cx="140" cy="70" rx="10" ry="13" fill="#051026" />
                    <circle cx={140 + pupilOffset.x} cy={70 + pupilOffset.y} r="4.2" fill="#0F2445" />
                  </g>
                  
                  {/* Boca */}
                  <path
                    className="login-mouth"
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
          {eggActive && (
            <div className="text-[11px] font-semibold text-[#FFC800] tracking-wide">
              Hecho por Reyshawn Lawrence con amor
            </div>
          )}
          <div className="text-center">
            <h1 className="text-4xl font-black text-white tracking-tight" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
              Linguistika
            </h1>
            <p className="text-sm font-bold text-[#00AEEF] uppercase tracking-wider mt-1">UNADECA Language Center</p>
          </div>
        </div>

        <Card className="border-white/10 overflow-hidden bg-[#0F2445]/95 backdrop-blur-xl shadow-2xl">
          <div className="bg-gradient-to-r from-[#FFC800] to-[#00AEEF] h-2 w-full" />
          <div className="p-8">
            <h1 className="text-xl font-black text-white mb-2">Iniciar sesión</h1>
            <p className="text-slate-300 font-medium mb-8">Usa tu correo y contraseña para continuar.</p>

            {error && (
              <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
                {error}
              </div>
            )}

            <form onSubmit={onSubmit} className="space-y-6">
              <div>
                <Label className="text-slate-300">Correo</Label>
                {savedEmails.length > 0 && !useCustomEmail ? (
                  <div className="space-y-3">
                    <Select
                      value={email}
                      onChange={(e) => handleSelectSavedEmail(e.target.value)}
                      className="bg-gradient-to-r from-blue-600 to-blue-500 border-2 border-blue-400 text-white font-semibold shadow-lg"
                    >
                      {savedEmails.map((savedEmail) => (
                        <option key={savedEmail} value={savedEmail}>
                          {savedEmail}
                        </option>
                      ))}
                      <option value="custom">+ Otro correo</option>
                    </Select>
                    {savedEmails.length > 1 && (
                      <div className="flex flex-wrap gap-2">
                        {savedEmails.map((savedEmail) => (
                          <div
                            key={savedEmail}
                            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-slate-300 hover:bg-white/10 transition"
                          >
                            <span className="truncate max-w-[150px]">{savedEmail}</span>
                            {savedEmail !== email && (
                              <button
                                type="button"
                                onClick={() => handleRemoveSavedEmail(savedEmail)}
                                className="hover:text-red-400 transition"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="relative">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <Input
                        type="email"
                        value={useCustomEmail ? customEmail : email}
                        onChange={(e) => useCustomEmail ? setCustomEmail(e.target.value) : setEmail(e.target.value)}
                        placeholder="admin@linguistika.com"
                        className="pl-11 bg-white/5 border-white/10 text-white placeholder:text-slate-500"
                        autoComplete="email"
                      />
                    </div>
                    {useCustomEmail && savedEmails.length > 0 && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setUseCustomEmail(false);
                          setCustomEmail('');
                          setEmail(savedEmails[0]);
                        }}
                        className="w-full text-xs"
                      >
                        ← Usar correo guardado
                      </Button>
                    )}
                  </div>
                )}
              </div>

              <div>
                <Label className="text-slate-300">Contraseña</Label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="pl-11 bg-white/5 border-white/10 text-white placeholder:text-slate-500"
                    autoComplete="current-password"
                  />
                </div>
              </div>

              <Button
                type="submit"
                variant="primary"
                className="w-full h-14 text-base font-black shadow-lg mt-4 rounded-2xl bg-gradient-to-r from-[#FFC800] to-[#00AEEF] hover:from-[#FFC800]/80 hover:to-[#00AEEF]/80 text-[#051026]"
                disabled={loading}
              >
                {loading ? 'Entrando…' : 'Entrar'}
              </Button>

              
            </form>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default Login;
