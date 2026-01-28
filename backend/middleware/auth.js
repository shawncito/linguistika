import { supabase, supabaseAdmin, supabaseForToken } from '../supabase.js';

export async function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  
  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'No autenticado' });
  }

  try {
    // Verificar token con Supabase
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
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
    return res.status(401).json({ error: 'Error de autenticación: ' + err.message });
  }
}
