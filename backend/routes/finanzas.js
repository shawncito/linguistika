import express from 'express';
import { supabaseAdmin } from '../supabase.js';
import { requireRoles } from '../middleware/roles.js';

const router = express.Router();

// Solo admin/contador pueden entrar a finanzas
router.use(requireRoles(['admin', 'contador']));

router.get('/movimientos', async (req, res) => {
  try {
    if (!supabaseAdmin) {
      return res.status(500).json({ error: 'SUPABASE_SERVICE_KEY no configurado' });
    }

    const {
      tipo,
      estado,
      referencia_tabla,
      referencia_id,
      curso_id,
      matricula_grupo_id,
      fecha_inicio,
      fecha_fin
    } = req.query;

    let query = supabaseAdmin
      .from('movimientos_financieros')
      .select('*')
      .order('fecha_movimiento', { ascending: false });

    if (tipo) query = query.eq('tipo', tipo);
    if (estado) query = query.eq('estado', estado);
    if (referencia_tabla) query = query.eq('referencia_tabla', referencia_tabla);
    if (referencia_id) query = query.eq('referencia_id', Number(referencia_id));
    if (curso_id) query = query.eq('curso_id', Number(curso_id));
    if (matricula_grupo_id) query = query.eq('matricula_grupo_id', Number(matricula_grupo_id));
    if (fecha_inicio) query = query.gte('fecha_movimiento', `${fecha_inicio}T00:00:00.000Z`);
    if (fecha_fin) query = query.lte('fecha_movimiento', `${fecha_fin}T23:59:59.999Z`);

    const { data, error } = await query;
    if (error) throw error;
    return res.json(data);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.post('/comprobantes', async (req, res) => {
  try {
    if (!supabaseAdmin) {
      return res.status(500).json({ error: 'SUPABASE_SERVICE_KEY no configurado' });
    }

    const userId = req.user?.id;
    const {
      numero_comprobante,
      monto,
      fecha_comprobante,
      pagador_nombre,
      pagador_contacto = null,
      detalle = null,
      movimiento_financiero_id = null,
      foto_url = null
    } = req.body;

    if (!numero_comprobante || !monto || !fecha_comprobante || !pagador_nombre) {
      return res.status(400).json({
        error: 'Campos requeridos: numero_comprobante, monto, fecha_comprobante, pagador_nombre'
      });
    }

    const { data, error } = await supabaseAdmin
      .from('comprobantes_ingresos')
      .insert({
        numero_comprobante,
        monto,
        fecha_comprobante,
        pagador_nombre,
        pagador_contacto,
        detalle,
        movimiento_financiero_id,
        foto_url,
        created_by: userId
      })
      .select('*')
      .single();

    if (error) throw error;
    return res.status(201).json(data);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.get('/comprobantes', async (req, res) => {
  try {
    if (!supabaseAdmin) {
      return res.status(500).json({ error: 'SUPABASE_SERVICE_KEY no configurado' });
    }

    const { data, error } = await supabaseAdmin
      .from('comprobantes_ingresos')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return res.json(data);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.patch('/comprobantes/:id', async (req, res) => {
  try {
    if (!supabaseAdmin) {
      return res.status(500).json({ error: 'SUPABASE_SERVICE_KEY no configurado' });
    }

    const { estado } = req.body;
    if (!estado) {
      return res.status(400).json({ error: 'Campo requerido: estado' });
    }

    const { data, error } = await supabaseAdmin
      .from('comprobantes_ingresos')
      .update({ estado, updated_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .select('*')
      .single();

    if (error) throw error;
    return res.json(data);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

export default router;
