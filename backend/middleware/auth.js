import { supabase, supabaseAdmin, supabaseForToken } from '../supabase.js';

let lastAuthNetworkErrorLogAt = 0;

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
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  
  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'No autenticado' });
  }

  try {
    // Verificar token con Supabase
    const { data, error } = await supabase.auth.getUser(token);
    const user = data?.user;
    
    if (error || !user) {
      return res.status(401).json({ error: 'Token inválido o expirado' });
    }

    req.user = user;
    req.accessToken = token;

    // Cargar rol desde public.usuarios (solo empleados)
    const db = supabaseAdmin ?? supabaseForToken(token);
    const { data: usuarioRow, error: usuarioErr } = await db
      .from('usuarios')
      .select('id, rol, estado')
      .eq('id', user.id)
      .maybeSingle();

    if (usuarioErr) {
      return res.status(500).json({ error: 'Error consultando rol de usuario', details: usuarioErr.message });
    }

    if (!usuarioRow) {
      return res.status(403).json({ error: 'Usuario no autorizado (no es empleado)' });
    }

    if (usuarioRow.estado === false) {
      return res.status(403).json({ error: 'Usuario desactivado' });
    }

    req.userRole = usuarioRow.rol;
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
