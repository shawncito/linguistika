import express from 'express';
import { supabase } from '../supabase.js';

const router = express.Router();

// GET - Listar horas (filtros opcionales: fecha, tutor_id, estado)
router.get('/', async (req, res) => {
  try {
    const { fecha, tutor_id, estado } = req.query;

    let query = supabase
      .from('horas_trabajo')
      .select(`
        *,
        tutores:tutor_id (nombre)
      `)
      .order('fecha', { ascending: false })
      .order('created_at', { ascending: false });

    if (fecha) {
      query = query.eq('fecha', fecha);
    }
    if (tutor_id) {
      query = query.eq('tutor_id', tutor_id);
    }
    if (estado) {
      query = query.eq('estado', estado);
    }

    const { data: rows, error } = await query;
    if (error) throw error;
    
    const formatted = rows.map(r => ({
      ...r,
      tutor_nombre: r.tutores?.nombre
    }));
    
    return res.json(formatted);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// GET - Obtener una entrada
router.get('/:id', async (req, res) => {
  try {
    const { data: row, error } = await supabase
      .from('horas_trabajo')
      .select('*')
      .eq('id', req.params.id)
      .single();
    
    if (error) throw error;
    if (!row) return res.status(404).json({ error: 'Registro no encontrado' });
    return res.json(row);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// POST - Crear (pendiente)
router.post('/', async (req, res) => {
  try {
    const { tutor_id, clase_id = null, fecha, horas, tarifa_por_hora, notas = null } = req.body;
    const userId = req.user?.id;

    if (!tutor_id || !fecha || !horas) {
      return res.status(400).json({ error: 'Campos requeridos: tutor_id, fecha, horas' });
    }

    let tarifa = Number(tarifa_por_hora);
    if (!tarifa || Number.isNaN(tarifa)) {
      const { data: tutor, error: tutorError } = await supabase
        .from('tutores')
        .select('tarifa_por_hora')
        .eq('id', tutor_id)
        .single();
      
      if (tutorError || !tutor) return res.status(400).json({ error: 'Tutor inválido' });
      tarifa = Number(tutor.tarifa_por_hora);
    }

    const horasNum = Number(horas);
    const monto = Math.round(horasNum * tarifa * 100) / 100;

    const { data: row, error } = await supabase
      .from('horas_trabajo')
      .insert({
        tutor_id,
        clase_id,
        fecha,
        horas: horasNum,
        tarifa_por_hora: tarifa,
        monto,
        estado: 'pendiente',
        notas,
        created_by: userId
      })
      .select()
      .single();

    if (error) throw error;
    return res.status(201).json(row);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// PUT - Editar (solo si está pendiente)
router.put('/:id', async (req, res) => {
  try {
    const { data: existing, error: fetchError } = await supabase
      .from('horas_trabajo')
      .select('*')
      .eq('id', req.params.id)
      .single();
    
    if (fetchError) throw fetchError;
    if (!existing) return res.status(404).json({ error: 'Registro no encontrado' });
    if (existing.estado !== 'pendiente') {
      return res.status(400).json({ error: 'Solo se puede editar si está pendiente' });
    }

    const { horas, tarifa_por_hora, notas } = req.body;

    const horasNum = horas === undefined ? Number(existing.horas) : Number(horas);
    const tarifa = tarifa_por_hora === undefined ? Number(existing.tarifa_por_hora) : Number(tarifa_por_hora);
    const monto = Math.round(horasNum * tarifa * 100) / 100;

    const { data: updated, error: updateError } = await supabase
      .from('horas_trabajo')
      .update({
        horas: horasNum,
        tarifa_por_hora: tarifa,
        monto,
        notas: notas ?? existing.notas,
        updated_at: new Date().toISOString()
      })
      .eq('id', req.params.id)
      .select()
      .single();

    if (updateError) throw updateError;
    return res.json(updated);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// POST - Aprobar (crea pago pendiente)
router.post('/:id/aprobar', async (req, res) => {
  try {
    const { data: existing, error: fetchError } = await supabase
      .from('horas_trabajo')
      .select('*')
      .eq('id', req.params.id)
      .single();
    
    if (fetchError) throw fetchError;
    if (!existing) return res.status(404).json({ error: 'Registro no encontrado' });
    if (existing.estado !== 'pendiente') {
      return res.status(400).json({ error: 'El registro ya fue procesado' });
    }

    const approverId = req.user?.id;

    // Actualizar estado a aprobado
    const { data: updated, error: updateError } = await supabase
      .from('horas_trabajo')
      .update({
        estado: 'aprobado',
        approved_by: approverId,
        updated_at: new Date().toISOString()
      })
      .eq('id', req.params.id)
      .select()
      .single();

    if (updateError) throw updateError;

    // Crear pago pendiente
    const descripcion = `Horas trabajadas (${existing.fecha})`;
    const { error: pagoError } = await supabase
      .from('pagos')
      .insert({
        tutor_id: existing.tutor_id,
        clase_id: existing.clase_id,
        monto: existing.monto,
        estado: 'pendiente',
        descripcion,
        created_by: approverId
      });

    if (pagoError) throw pagoError;

    return res.json({ horas_trabajo: updated, pago_creado: true });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

export default router;

