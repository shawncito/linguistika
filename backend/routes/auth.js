import express from 'express';
import { supabase } from '../supabase.js';
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

    // Obtener datos del usuario desde la tabla usuarios si existen
    const { data: userData } = await supabase
      .from('usuarios')
      .select('*')
      .eq('id', data.user.id)
      .single();

    return res.json({ 
      token: data.session.access_token,
      user: {
        id: data.user.id,
        email: data.user.email,
        rol: userData?.rol || 'usuario',
        estado: userData?.estado !== false
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
    const { data: userData } = await supabase
      .from('usuarios')
      .select('*')
      .eq('id', req.user.id)
      .single();
    
    return res.json({ 
      user: {
        id: req.user.id,
        email: req.user.email,
        rol: userData?.rol || 'usuario',
        estado: userData?.estado !== false
      }
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

export default router;

