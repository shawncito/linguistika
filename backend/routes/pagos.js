import express from 'express';
import { supabase } from '../supabase.js';

const router = express.Router();

// GET - Listar todos los pagos
router.get('/', async (req, res) => {
  try {
    const { data: pagos, error } = await supabase
      .from('pagos')
      .select(`
        *,
        tutores:tutor_id (nombre, email)
      `)
      .order('fecha_pago', { ascending: false });
    
    if (error) throw error;
    
    const formatted = pagos.map(p => ({
      ...p,
      tutor_nombre: p.tutores?.nombre,
      tutor_email: p.tutores?.email
    }));
    
    res.json(formatted);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET - Pagos de un tutor
router.get('/tutor/:tutor_id', async (req, res) => {
  try {
    const { data: pagos, error } = await supabase
      .from('pagos')
      .select('*')
      .eq('tutor_id', req.params.tutor_id)
      .order('fecha_pago', { ascending: false });
    
    if (error) throw error;
    res.json(pagos);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST - Registrar pago
router.post('/', async (req, res) => {
  try {
    const { tutor_id, clase_id, cantidad_clases, monto, descripcion } = req.body;
    const userId = req.user?.id;
    
    if (!tutor_id || !monto) {
      return res.status(400).json({ error: 'Campos requeridos: tutor_id, monto' });
    }

    const { data: pago, error } = await supabase
      .from('pagos')
      .insert({
        tutor_id,
        clase_id,
        cantidad_clases,
        monto,
        descripcion,
        created_by: userId,
        estado: 'pendiente'
      })
      .select(`
        *,
        tutores:tutor_id (nombre)
      `)
      .single();
    
    if (error) throw error;
    
    const formatted = {
      ...pago,
      tutor_nombre: pago.tutores?.nombre
    };
    
    res.status(201).json(formatted);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST - Calcular pago automático por clases dadas
router.post('/calcular', async (req, res) => {
  try {
    const { tutor_id, fecha_inicio, fecha_fin } = req.body;
    
    if (!tutor_id) {
      return res.status(400).json({ error: 'Campo requerido: tutor_id' });
    }

    // Construir query con filtros opcionales
    let query = supabase
      .from('clases')
      .select(`
        id,
        fecha,
        hora_inicio,
        hora_fin,
        matriculas!inner (
          tutor_id,
          tutores (tarifa_por_hora, nombre)
        )
      `)
      .eq('matriculas.tutor_id', tutor_id)
      .eq('estado', 'programada');
    
    if (fecha_inicio) {
      query = query.gte('fecha', fecha_inicio);
    }
    
    if (fecha_fin) {
      query = query.lte('fecha', fecha_fin);
    }

    const { data: clases, error } = await query;
    
    if (error) throw error;

    // Calcular monto total
    let monto_total = 0;
    const clases_procesadas = clases.map(clase => {
      const [hi, mi] = clase.hora_inicio.split(':').map(Number);
      const [hf, mf] = clase.hora_fin.split(':').map(Number);
      const duracion = ((hf - hi) + (mf - mi) / 60);
      const tarifa = clase.matriculas?.tutores?.tarifa_por_hora || 0;
      monto_total += duracion * tarifa;
      
      return {
        ...clase,
        tarifa_por_hora: tarifa,
        tutor_nombre: clase.matriculas?.tutores?.nombre
      };
    });

    res.json({
      tutor_id,
      cantidad_clases: clases.length,
      monto_total,
      clases_detalles: clases_procesadas
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT - Actualizar estado de pago
router.put('/:id', async (req, res) => {
  try {
    const { estado } = req.body;
    const userId = req.user?.id;
    
    const { data: pago, error } = await supabase
      .from('pagos')
      .update({
        estado,
        updated_by: userId,
        updated_at: new Date().toISOString()
      })
      .eq('id', req.params.id)
      .select(`
        *,
        tutores:tutor_id (nombre)
      `)
      .single();
    
    if (error) throw error;
    
    const formatted = {
      ...pago,
      tutor_nombre: pago.tutores?.nombre
    };
    
    res.json(formatted);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;

