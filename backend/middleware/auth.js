import { supabase, supabaseAdmin, supabaseForToken } from '../supabase.js';
import crypto from 'crypto';

let lastAuthNetworkErrorLogAt = 0;

// Cache simple en memoria para evitar golpear Supabase en cada request.
// Ayuda especialmente cuando la red es intermitente o Supabase responde lento.
// Clave: hash del token; TTL corto.
const AUTH_CACHE_TTL_MS = 2 * 60_000;
const authCache = new Map();

function tokenHash(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function tryGetJwtExpMs(token) {
  try {
    const parts = String(token).split('.');
    if (parts.length < 2) return null;
    const payloadB64 = parts[1]
      .replace(/-/g, '+')
      .replace(/_/g, '/');
    const padded = payloadB64 + '==='.slice((payloadB64.length + 3) % 4);
    const json = Buffer.from(padded, 'base64').toString('utf8');
    const payload = JSON.parse(json);
    const expSec = Number(payload?.exp);
    if (!Number.isFinite(expSec)) return null;
    return expSec * 1000;
  } catch {
    return null;
  }
}

function getCachedAuth(token) {
  const key = tokenHash(token);
  const entry = authCache.get(key);
  if (!entry) return null;

  const now = Date.now();
  if (entry.expiresAtMs && entry.expiresAtMs <= now) {
    authCache.delete(key);
    return null;
  }
  if (now - entry.cachedAtMs > AUTH_CACHE_TTL_MS) {
    authCache.delete(key);
    return null;
  }
  return entry;
}

function setCachedAuth(token, data) {
  const key = tokenHash(token);
  authCache.set(key, { ...data, cachedAtMs: Date.now() });
}

function isNetworkOrTimeoutError(err) {
  const code = err?.cause?.code || err?.code;
  const name = err?.cause?.name || err?.name;
  const msg = String(err?.message || '').toLowerCase();
  return (
    code === 'UND_ERR_CONNECT_TIMEOUT' ||
    code === 'ETIMEDOUT' ||
    code === 'ECONNRESET' ||
    code === 'ECONNREFUSED' ||
    code === 'ENOTFOUND' ||
    code === 'EAI_AGAIN' ||
    code === 'ABORT_ERR' ||
    name === 'AbortError' ||
    // Node/undici suele lanzar TypeError: fetch failed (con o sin cause)
    msg.includes('fetch failed')
  );
}

function maybeLogAuthNetworkError(err) {
  const now = Date.now();
  if (now - lastAuthNetworkErrorLogAt < 30_000) return;
  lastAuthNetworkErrorLogAt = now;
  const code = err?.cause?.code || err?.code || 'UNKNOWN';
  const msg = err?.message || String(err);
  console.error(`❌ Supabase Auth no responde (${code}): ${msg}`);
}

export async function requireAuth(req, res, next) {
  const header = String(req.headers.authorization || '').trim();
  const match = header.match(/^Bearer\s+(.+)$/i);
  let token = match?.[1] ? String(match[1]).trim() : '';

  // Quitar comillas si vienen pegadas por accidente
  if ((token.startsWith('"') && token.endsWith('"')) || (token.startsWith("'") && token.endsWith("'"))) {
    token = token.slice(1, -1).trim();
  }

  if (!token) {
    return res.status(401).json({ error: 'No autenticado' });
  }

  const cached = getCachedAuth(token);
  if (cached) {
    req.user = cached.user;
    req.accessToken = token;
    req.userRole = cached.userRole;
    req.userName = cached.userName;
    return next();
  }

  try {
    // Verificar token con Supabase
    const { data, error } = await supabase.auth.getUser(token);
    const user = data?.user;
    
    if (error || !user) {
      // Importante: cuando Supabase está caído o hay timeout, auth-js puede
      // devolver un `error` en lugar de lanzar excepción. En ese caso NO
      // debemos responder 401 (porque el cliente borra el token y te "saca").
      if (isNetworkOrTimeoutError(error)) {
        maybeLogAuthNetworkError(error);
        return res.status(503).json({
          error: 'No se pudo validar el token porque Supabase no está respondiendo. Intenta de nuevo en unos segundos.',
          code: 'SUPABASE_AUTH_UNAVAILABLE',
        });
      }

      return res.status(401).json({ error: 'Token inválido o expirado' });
    }

    req.user = user;
    req.accessToken = token;

    // Cargar rol desde public.usuarios (solo empleados)
    const db = supabaseAdmin ?? supabaseForToken(token);
    const { data: usuarioRow, error: usuarioErr } = await db
      .from('usuarios')
      .select('id, rol, estado, nombre_completo')
      .eq('id', user.id)
      .maybeSingle();

    if (usuarioErr) {
      if (isNetworkOrTimeoutError(usuarioErr)) {
        maybeLogAuthNetworkError(usuarioErr);
        return res.status(503).json({
          error: 'Supabase no está respondiendo (consulta de rol). Intenta de nuevo en unos segundos.',
          code: 'SUPABASE_DB_UNAVAILABLE',
        });
      }
      return res.status(500).json({ error: 'Error consultando rol de usuario', details: usuarioErr.message });
    }

    if (!usuarioRow) {
      return res.status(403).json({ error: 'Usuario no autorizado (no es empleado)' });
    }

    if (usuarioRow.estado === false) {
      return res.status(403).json({ error: 'Usuario desactivado' });
    }

    req.userRole = usuarioRow.rol;
    req.userName = usuarioRow.nombre_completo || null;

    setCachedAuth(token, {
      user,
      userRole: usuarioRow.rol,
      userName: usuarioRow.nombre_completo || null,
      expiresAtMs: tryGetJwtExpMs(token),
    });

    return next();
  } catch (err) {
    if (isNetworkOrTimeoutError(err)) {
      maybeLogAuthNetworkError(err);
      return res.status(503).json({
        error: 'No se pudo validar el token porque Supabase no está respondiendo. Intenta de nuevo en unos segundos.',
        code: 'SUPABASE_AUTH_UNAVAILABLE',
      });
    }

    console.error('❌ Error inesperado en requireAuth:', err);
    return res.status(500).json({
      error: 'Error interno de autenticación. Intenta de nuevo.',
      code: 'AUTH_INTERNAL_ERROR',
    });
  }
}
