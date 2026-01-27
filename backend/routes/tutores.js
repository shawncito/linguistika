import express from 'express';
import { supabase } from '../supabase.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

// GET - Listar todos los tutores
router.get('/', async (req, res) => {
  try {
    const { data: tutores, error } = await supabase
      .from('tutores')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    // Convertir estado booleano a número
    const tutoresResponse = tutores.map(t => ({
      ...t,
      estado: t.estado ? 1 : 0
    }));
    res.json(tutoresResponse);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET - Obtener un tutor por ID
router.get('/:id', async (req, res) => {
  try {
    const { data: tutor, error } = await supabase
      .from('tutores')
      .select('*')
      .eq('id', req.params.id)
      .single();
    
    if (error) throw error;
    if (!tutor) {
      return res.status(404).json({ error: 'Tutor no encontrado' });
    }

    res.json(tutor);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST - Crear nuevo tutor
router.post('/', async (req, res) => {
  try {
    const { 
      nombre, email, telefono, especialidad,
      dias_turno = null,
      dias_horarios = null,
      es_especializado = false,
      niveles_apto = []
    } = req.body;
    const userId = req.user?.id;
    
    if (!nombre || !especialidad) {
      return res.status(400).json({ error: 'Campos requeridos: nombre, especialidad' });
    }

    // Validar formato de teléfono si se proporciona
    const phoneRegex = /^(\+506\s?)?\d{4}-\d{4}$/;
    if (telefono && !phoneRegex.test(telefono.trim())) {
      return res.status(400).json({ error: 'Formato de teléfono inválido. Usa: +506 8888-8888' });
    }

    const { data: tutor, error } = await supabase
      .from('tutores')
      .insert({
        nombre,
        email: email || null,
        telefono: telefono || null,
        especialidad,
        // La columna en DB es NOT NULL: aseguramos valor por defecto
        tarifa_por_hora: 0,
        // si la columna es json/jsonb, enviar objeto; si es text, Supabase lo convertirá
        dias_turno: dias_turno || null,
        dias_horarios: dias_horarios || null,
        es_especializado: !!es_especializado,
        niveles_apto: Array.isArray(niveles_apto) ? niveles_apto : [],
        created_by: userId,
        estado: true
      })
      .select()
      .single();
    
    if (error) {
      console.error('Error en Supabase:', error);
      throw error;
    }

    res.status(201).json(tutor);
  } catch (error) {
    console.error('Error al crear tutor:', error);
    res.status(500).json({ error: error.message });
  }
});

// PUT - Actualizar tutor
router.put('/:id', async (req, res) => {
  try {
    const userId = req.user?.id;
    
    // Validar formato de teléfono si se proporciona
    const phoneRegex = /^(\+506\s?)?\d{4}-\d{4}$/;
    if (req.body.telefono && !phoneRegex.test(req.body.telefono.trim())) {
      return res.status(400).json({ error: 'Formato de teléfono inválido. Usa: +506 8888-8888' });
    }

    // Construir objeto de actualización solo con campos presentes
    const updateData = {
      updated_by: userId,
      updated_at: new Date().toISOString()
    };

    if (req.body.nombre !== undefined) updateData.nombre = req.body.nombre;
    if (req.body.email !== undefined) updateData.email = req.body.email || null;
    if (req.body.telefono !== undefined) updateData.telefono = req.body.telefono || null;
    if (req.body.especialidad !== undefined) updateData.especialidad = req.body.especialidad;
    if (req.body.dias_turno !== undefined) updateData.dias_turno = req.body.dias_turno || null;
    if (req.body.dias_horarios !== undefined) updateData.dias_horarios = req.body.dias_horarios || null;
    if (req.body.es_especializado !== undefined) updateData.es_especializado = !!req.body.es_especializado;
    if (req.body.niveles_apto !== undefined) updateData.niveles_apto = Array.isArray(req.body.niveles_apto) ? req.body.niveles_apto : [];
    if (req.body.estado !== undefined) updateData.estado = req.body.estado === 1 || req.body.estado === true;

    const { data: tutor, error } = await supabase
      .from('tutores')
      .update(updateData)
      .eq('id', req.params.id)
      .select()
      .single();
    
    if (error) throw error;

    // Convertir estado a número en la respuesta
    const tutorResponse = {
      ...tutor,
      estado: tutor.estado ? 1 : 0
    };

    res.json(tutorResponse);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE - Eliminar tutor permanentemente
router.delete('/:id', async (req, res) => {
  try {
    const { error } = await supabase
      .from('tutores')
      .delete()
      .eq('id', req.params.id);
    
    if (error) throw error;
    res.json({ message: 'Tutor eliminado correctamente' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;

