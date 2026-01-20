import express from 'express';
import { supabase } from '../supabase.js';

const router = express.Router();

// GET - Listar todos los estudiantes
router.get('/', async (req, res) => {
  try {
    const { data: estudiantes, error } = await supabase
      .from('estudiantes')
      .select('*')
      .eq('estado', true)
      .order('created_at', { ascending: false });
    
    if (error) throw error;

    // Parse JSON fields
    const estudiantesResponse = estudiantes.map(e => ({
      ...e,
      dias: e.dias ? JSON.parse(e.dias) : null
    }));

    res.json(estudiantesResponse);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET - Obtener un estudiante por ID
router.get('/:id', async (req, res) => {
  try {
    const { data: estudiante, error } = await supabase
      .from('estudiantes')
      .select('*')
      .eq('id', req.params.id)
      .single();
    
    if (error) throw error;
    if (!estudiante) {
      return res.status(404).json({ error: 'Estudiante no encontrado' });
    }

    // Parse JSON fields
    const estudianteResponse = {
      ...estudiante,
      dias: estudiante.dias ? JSON.parse(estudiante.dias) : null
    };

    res.json(estudianteResponse);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST - Crear nuevo estudiante
router.post('/', async (req, res) => {
  try {
    const { 
      nombre, email, email_encargado, telefono, telefono_encargado, 
      grado = null,
      dias = null,
      turno = null,
      dias_turno = null
    } = req.body;
    const userId = req.user?.id;
    
    if (!nombre) {
      return res.status(400).json({ error: 'Campo requerido: nombre' });
    }

    // Validar formato de teléfono si se proporciona
    const phoneRegex = /^(\+506\s?)?\d{4}-\d{4}$/;
    if (telefono_encargado && !phoneRegex.test(telefono_encargado.trim())) {
      return res.status(400).json({ error: 'Formato de teléfono inválido. Usa: +506 8888-8888' });
    }

    const { data: estudiante, error } = await supabase
      .from('estudiantes')
      .insert({
        nombre,
        email: email || null,
        email_encargado: email_encargado || null,
        telefono: telefono || null,
        telefono_encargado: telefono_encargado || null,
        grado,
        dias: dias ? JSON.stringify(dias) : null,
        turno,
        dias_turno: dias_turno ? JSON.stringify(dias_turno) : null,
        created_by: userId,
        estado: true
      })
      .select()
      .single();
    
    if (error) {
      console.error('Error en Supabase:', error);
      throw error;
    }

    // Parse JSON fields for response
    const estudianteResponse = {
      ...estudiante,
      dias: estudiante.dias ? JSON.parse(estudiante.dias) : null,
      dias_turno: estudiante.dias_turno ? JSON.parse(estudiante.dias_turno) : null
    };

    res.status(201).json(estudianteResponse);
  } catch (error) {
    console.error('Error al crear estudiante:', error);
    res.status(500).json({ error: error.message });
  }
});

// PUT - Actualizar estudiante
router.put('/:id', async (req, res) => {
  try {
    const { 
      nombre, email, email_encargado, telefono, telefono_encargado,
      grado = null,
      dias = null,
      turno = null,
      dias_turno = null,
      estado 
    } = req.body;
    const userId = req.user?.id;
    
    // Validar formato de teléfono si se proporciona
    const phoneRegex = /^(\+506\s?)?\d{4}-\d{4}$/;
    if (telefono_encargado && !phoneRegex.test(telefono_encargado.trim())) {
      return res.status(400).json({ error: 'Formato de teléfono inválido. Usa: +506 8888-8888' });
    }

    const { data: estudiante, error } = await supabase
      .from('estudiantes')
      .update({
        nombre,
        email: email || null,
        email_encargado: email_encargado || null,
        telefono: telefono || null,
        telefono_encargado: telefono_encargado || null,
        grado,
        dias: dias ? JSON.stringify(dias) : null,
        turno,
        dias_turno: dias_turno ? JSON.stringify(dias_turno) : null,
        estado,
        updated_by: userId,
        updated_at: new Date().toISOString()
      })
      .eq('id', req.params.id)
      .select()
      .single();
    
    if (error) throw error;

    // Parse JSON fields for response
    const estudianteResponse = {
      ...estudiante,
      dias: estudiante.dias ? JSON.parse(estudiante.dias) : null,
      dias_turno: estudiante.dias_turno ? JSON.parse(estudiante.dias_turno) : null
    };

    res.json(estudianteResponse);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE - Desactivar estudiante
router.delete('/:id', async (req, res) => {
  try {
    const userId = req.user?.id;
    const { error } = await supabase
      .from('estudiantes')
      .update({
        estado: false,
        updated_by: userId,
        updated_at: new Date().toISOString()
      })
      .eq('id', req.params.id);
    
    if (error) throw error;
    res.json({ message: 'Estudiante desactivado correctamente' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;

