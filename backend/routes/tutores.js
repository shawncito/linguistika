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
      .eq('estado', true)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    // No parse: devolver como viene (jsonb llega como objeto)
    res.json(tutores);
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
      dias_turno = null
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
    const { 
      nombre, email, telefono, especialidad,
      dias_turno = null, estado 
    } = req.body;
    const userId = req.user?.id;
    
    // Validar formato de teléfono si se proporciona
    const phoneRegex = /^(\+506\s?)?\d{4}-\d{4}$/;
    if (telefono && !phoneRegex.test(telefono.trim())) {
      return res.status(400).json({ error: 'Formato de teléfono inválido. Usa: +506 8888-8888' });
    }

    const { data: tutor, error } = await supabase
      .from('tutores')
      .update({
        nombre,
        email: email || null,
        telefono: telefono || null,
        especialidad,
        dias_turno: dias_turno || null,
        estado,
        updated_by: userId,
        updated_at: new Date().toISOString()
      })
      .eq('id', req.params.id)
      .select()
      .single();
    
    if (error) throw error;

    res.json(tutor);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE - Desactivar tutor
router.delete('/:id', async (req, res) => {
  try {
    const userId = req.user?.id;
    const { error } = await supabase
      .from('tutores')
      .update({
        estado: false,
        updated_by: userId,
        updated_at: new Date().toISOString()
      })
      .eq('id', req.params.id);
    
    if (error) throw error;
    res.json({ message: 'Tutor desactivado correctamente' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;

