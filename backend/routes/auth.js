import express from 'express';
import { supabase, supabaseForToken } from '../supabase.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Campos requeridos: email, password' });
    }

    // Usar autenticación nativa de Supabase
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    
    if (error) {
      return res.status(401).json({ error: error.message || 'Credenciales inválidas' });
    }

    const accessToken = data?.session?.access_token;
    if (!accessToken) {
      return res.status(401).json({ error: 'No se pudo obtener sesión de Supabase' });
    }

    // Solo empleados: validar que exista fila en public.usuarios (usando el JWT para que RLS aplique)
    const db = supabaseForToken(accessToken);
    const { data: usuarioRow, error: usuarioErr } = await db
      .from('usuarios')
      .select('id, rol, estado, nombre_completo, telefono')
      .eq('id', data.user.id)
      .maybeSingle();

    if (usuarioErr) {
      return res.status(500).json({ error: 'Error consultando perfil de empleado', details: usuarioErr.message });
    }

    if (!usuarioRow) {
      return res.status(403).json({ error: 'Usuario no autorizado (no es empleado)' });
    }

    if (usuarioRow.estado === false) {
      return res.status(403).json({ error: 'Usuario desactivado' });
    }

    return res.json({
      token: accessToken,
      user: {
        id: data.user.id,
        email: data.user.email,
        rol: usuarioRow.rol || 'tutor_view_only',
        estado: true,
        nombre_completo: usuarioRow.nombre_completo,
        telefono: usuarioRow.telefono
      }
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.post('/register', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Campos requeridos: email, password' });
    }

    // Registrar usuario en Supabase Auth
    const { data, error } = await supabase.auth.signUp({
      email,
      password
    });
    
    if (error) {
      return res.status(400).json({ error: error.message });
    }

    return res.status(201).json({ 
      message: 'Usuario registrado exitosamente',
      user: {
        id: data.user.id,
        email: data.user.email
      }
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.post('/logout', async (req, res) => {
  try {
    const { error } = await supabase.auth.signOut();
    
    if (error) {
      return res.status(400).json({ error: error.message });
    }

    return res.json({ message: 'Sesión cerrada' });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.get('/me', requireAuth, async (req, res) => {
  try {
    // requireAuth ya valida empleado + estado y adjunta req.userRole y req.accessToken
    const db = supabaseForToken(req.accessToken);
    const { data: usuarioRow, error: usuarioErr } = await db
      .from('usuarios')
      .select('id, rol, estado, nombre_completo, telefono')
      .eq('id', req.user.id)
      .maybeSingle();

    if (usuarioErr) {
      return res.status(500).json({ error: 'Error consultando perfil', details: usuarioErr.message });
    }

    return res.json({
      user: {
        id: req.user.id,
        email: req.user.email,
        rol: req.userRole,
        estado: usuarioRow?.estado !== false,
        nombre_completo: usuarioRow?.nombre_completo ?? null,
        telefono: usuarioRow?.telefono ?? null
      }
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

export default router;

