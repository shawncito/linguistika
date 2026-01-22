import React, { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Languages, Lock, Mail } from 'lucide-react';
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
    <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="bg-blue-600 p-3 rounded-2xl text-white shadow-lg shadow-blue-200">
            <Languages className="w-7 h-7" />
          </div>
          <div className="flex flex-col">
            <span className="font-extrabold text-2xl tracking-tight text-slate-900 leading-none">Lingüistika</span>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Acceso</span>
          </div>
        </div>

        <Card className="border-slate-200 overflow-hidden">
          <div className="bg-blue-600 h-2 w-full" />
          <div className="p-8">
            <h1 className="text-xl font-black text-slate-900 mb-2">Iniciar sesión</h1>
            <p className="text-slate-500 font-medium mb-8">Usa tu correo y contraseña para continuar.</p>

            {error && (
              <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
                {error}
              </div>
            )}

            <form onSubmit={onSubmit} className="space-y-6">
              <div>
                <Label>Correo</Label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="admin@linguistika.com"
                    className="pl-11 bg-slate-50 border-slate-200"
                    autoComplete="email"
                  />
                </div>
              </div>

              <div>
                <Label>Contraseña</Label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="pl-11 bg-slate-50 border-slate-200"
                    autoComplete="current-password"
                  />
                </div>
              </div>

              <Button
                type="submit"
                variant="primary"
                className="w-full h-14 text-base font-black shadow-lg shadow-blue-100 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white"
                disabled={loading}
              >
                {loading ? 'Entrando…' : 'Entrar'}
              </Button>

              <p className="text-xs text-slate-400 font-semibold text-center">
                Correo inicial: <span className="font-black text-slate-600">admin@linguistika.com</span> · Contraseña: <span className="font-black text-slate-600">admin123</span>
              </p>
            </form>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default Login;
