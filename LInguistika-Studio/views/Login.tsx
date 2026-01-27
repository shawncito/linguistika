import React, { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Lock, Mail } from 'lucide-react';
import { api, auth } from '../services/api';
import { Button, Card, Input, Label } from '../components/UI';

const Login: React.FC = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('admin@linguistika.com');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (auth.getToken()) {
    return <Navigate to="/" replace />;
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await api.auth.login(email, password);
      auth.setToken(res.token);
      navigate('/', { replace: true });
    } catch (err: any) {
      setError(err?.response?.data?.error || 'No se pudo iniciar sesión');
    } finally {
      setLoading(false);
    }
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
          <div className="w-24 h-24">
            <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" className="w-full h-full drop-shadow-2xl">
              {/* Mitad izquierda amarilla */}
              <path d="M 50 20 Q 30 20 30 40 L 30 160 Q 30 180 50 180 L 100 180 L 100 20 Z" fill="#FFC800" />
              
              {/* Mitad derecha azul */}
              <path d="M 100 20 L 100 180 L 150 180 Q 170 180 170 160 L 170 40 Q 170 20 150 20 Z" fill="#00AEEF" />
              
              {/* Ojo izquierdo */}
              <ellipse cx="60" cy="70" rx="8" ry="12" fill="#051026" />
              
              {/* Ojo derecho */}
              <ellipse cx="140" cy="70" rx="8" ry="12" fill="#051026" />
              
              {/* Sonrisa */}
              <path d="M 70 110 Q 100 140 130 110" stroke="#051026" strokeWidth="12" fill="none" strokeLinecap="round" />
            </svg>
          </div>
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
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="admin@linguistika.com"
                    className="pl-11 bg-white/5 border-white/10 text-white placeholder:text-slate-500"
                    autoComplete="email"
                  />
                </div>
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

              <p className="text-xs text-slate-400 font-semibold text-center">
                Correo inicial: <span className="font-black text-white">admin@linguistika.com</span> · Contraseña: <span className="font-black text-white">admin123</span>
              </p>
            </form>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default Login;
