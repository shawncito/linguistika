import express from 'express';
import { supabaseAdmin } from '../supabase.js';
import { requireRoles } from '../middleware/roles.js';

const router = express.Router();

// Todas las rutas aquí requieren admin
router.use(requireRoles('admin'));

// POST - Crear empleado (usuario de oficina)
// Requiere SUPABASE_SERVICE_KEY configurado
router.post('/crear-empleado', async (req, res) => {
  try {
    if (!supabaseAdmin) {
      return res.status(500).json({
        error: 'SUPABASE_SERVICE_KEY no configurado; no se puede crear usuarios en auth desde el backend.'
      });
    }

    const {
      email,
      password,
      rol = 'tutor_view_only',
      nombre_completo = null,
      telefono = null,
      email_confirm = true
    } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Campos requeridos: email, password' });
    }

    // Crear en Supabase Auth
    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm
    });

    if (createErr) {
      return res.status(400).json({ error: createErr.message });
    }

    const userId = created.user?.id;
    if (!userId) {
      return res.status(500).json({ error: 'No se pudo obtener el id del usuario creado' });
    }

    // Crear/actualizar perfil en public.usuarios
    const { data: perfil, error: perfilErr } = await supabaseAdmin
      .from('usuarios')
      .upsert({
        id: userId,
        rol,
        nombre_completo,
        telefono,
        estado: true,
        updated_at: new Date().toISOString()
      })
      .select('id, rol, nombre_completo, telefono, estado')
      .single();

    if (perfilErr) {
      return res.status(400).json({ error: perfilErr.message });
    }

    return res.status(201).json({
      id: userId,
      email,
      perfil
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// GET - Listar empleados
router.get('/empleados', async (req, res) => {
  try {
    if (!supabaseAdmin) {
      return res.status(500).json({ error: 'SUPABASE_SERVICE_KEY no configurado' });
    }

    // Obtener usuarios de la tabla
    const { data: usuarios, error } = await supabaseAdmin
      .from('usuarios')
      .select('id, rol, nombre_completo, telefono, estado, created_at, updated_at')
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Obtener emails desde auth
    const { data: authUsers, error: authError } = await supabaseAdmin.auth.admin.listUsers({
      perPage: 1000,
    });

    if (authError) {
      console.error('Error obteniendo auth users:', authError);
      // Continuar sin emails si hay error
      return res.json(usuarios);
    }

    // Mapear emails a usuarios
    const emailMap = {};
    (authUsers?.users || []).forEach((user) => {
      emailMap[user.id] = user.email;
    });

    // Combinar datos
    const usuariosConEmail = usuarios.map((u) => ({
      ...u,
      email: emailMap[u.id] || null,
    }));

    return res.json(usuariosConEmail);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// PATCH - Actualizar rol/estado de empleado
router.patch('/empleados/:id', async (req, res) => {
  try {
    if (!supabaseAdmin) {
      return res.status(500).json({ error: 'SUPABASE_SERVICE_KEY no configurado' });
    }

    const { rol, estado, nombre_completo, telefono } = req.body;
    const update = { updated_at: new Date().toISOString() };

    if (rol !== undefined) update.rol = rol;
    if (estado !== undefined) update.estado = !!estado;
    if (nombre_completo !== undefined) update.nombre_completo = nombre_completo;
    if (telefono !== undefined) update.telefono = telefono;

    const { data, error } = await supabaseAdmin
      .from('usuarios')
      .update(update)
      .eq('id', req.params.id)
      .select('id, rol, nombre_completo, telefono, estado, created_at, updated_at')
      .single();

    if (error) throw error;
    return res.json(data);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// DELETE - Eliminar empleado (perfil + usuario auth)
router.delete('/empleados/:id', async (req, res) => {
  try {
    if (!supabaseAdmin) {
      return res.status(500).json({ error: 'SUPABASE_SERVICE_KEY no configurado' });
    }

    const userId = req.params.id;

    // 1) Eliminar perfil en public.usuarios
    const { error: delPerfilErr } = await supabaseAdmin
      .from('usuarios')
      .delete()
      .eq('id', userId);

    if (delPerfilErr) {
      return res.status(400).json({ error: delPerfilErr.message });
    }

    // 2) Eliminar usuario en auth
    const { error: delAuthErr } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (delAuthErr) {
      return res.status(400).json({ error: delAuthErr.message });
    }

    return res.json({ ok: true, id: userId });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

export default router;
