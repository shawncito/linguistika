import crypto from 'crypto';
import { supabase } from '../config/supabaseClient.mjs';

const cache = new Map();
const CACHE_TTL_MS = 2 * 60 * 1000;

const NETWORK_CODES = new Set([
  'UND_ERR_CONNECT_TIMEOUT',
  'ETIMEDOUT',
  'ECONNRESET',
  'ECONNREFUSED',
  'ENOTFOUND',
  'EAI_AGAIN',
]);

function isNetworkError(err) {
  const code = err?.cause?.code || err?.code;
  const name = err?.cause?.name || err?.name;
  const msg = String(err?.message || '').toLowerCase();
  return NETWORK_CODES.has(code) || name === 'AbortError' || msg.includes('fetch failed');
}

function isExpiredJWT(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return false;
    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
    if (!payload.exp) return false;
    return payload.exp < Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
}

export async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token no proporcionado' });
  }

  const token = authHeader.slice(7);

  if (isExpiredJWT(token)) {
    return res.status(401).json({ error: 'Token expirado', code: 'TOKEN_EXPIRED' });
  }

  const cacheKey = crypto.createHash('sha256').update(token).digest('hex');
  const now = Date.now();
  const cached = cache.get(cacheKey);

  if (cached && cached.expiresAt > now) {
    req.user = cached.user;
    req.accessToken = token;
    req.userRole = cached.role;
    req.userName = cached.name;
    return next();
  }

  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({ error: 'Token inválido o expirado' });
    }

    const { data: perfil } = await supabase
      .from('usuarios')
      .select('rol, estado, nombre_completo')
      .eq('id', user.id)
      .maybeSingle();

    if (perfil?.estado === false) {
      return res.status(403).json({ error: 'Cuenta desactivada' });
    }

    cache.set(cacheKey, {
      user,
      role: perfil?.rol ?? null,
      name: perfil?.nombre_completo ?? null,
      expiresAt: now + CACHE_TTL_MS,
    });

    req.user = user;
    req.accessToken = token;
    req.userRole = perfil?.rol ?? null;
    req.userName = perfil?.nombre_completo ?? null;
    return next();
  } catch (err) {
    if (isNetworkError(err)) {
      return res.status(503).json({
        error: 'Servicio de autenticación no disponible temporalmente',
        code: 'AUTH_SERVICE_UNAVAILABLE',
      });
    }
    return res.status(500).json({ error: 'Error al verificar autenticación' });
  }
}
