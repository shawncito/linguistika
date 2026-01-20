import express from 'express';
import { supabase } from '../supabase.js';

const router = express.Router();

// GET - Listar todos los cursos
router.get('/', async (req, res) => {
  try {
    const { data: cursos, error } = await supabase
      .from('cursos')
      .select('*')
      .eq('estado', true)
      .order('created_at', { ascending: false });
    
    if (error) throw error;

    // Parse JSON fields
    const cursosResponse = cursos.map(c => ({
      ...c,
      dias_turno: c.dias_turno ? JSON.parse(c.dias_turno) : null
    }));

    res.json(cursosResponse);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET - Obtener un curso por ID
router.get('/:id', async (req, res) => {
  try {
    const { data: curso, error } = await supabase
      .from('cursos')
      .select('*')
      .eq('id', req.params.id)
      .single();
    
    if (error) throw error;
    if (!curso) {
      return res.status(404).json({ error: 'Curso no encontrado' });
    }

    // Parse JSON fields
    const cursoResponse = {
      ...curso,
      dias_turno: curso.dias_turno ? JSON.parse(curso.dias_turno) : null
    };

    res.json(cursoResponse);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST - Crear nuevo curso
router.post('/', async (req, res) => {
  try {
    const { 
      nombre, descripcion, nivel, max_estudiantes = null,
      tipo_clase = 'grupal', dias_turno = null
    } = req.body;
    const userId = req.user?.id;
    
    if (!nombre) {
      return res.status(400).json({ error: 'Campo requerido: nombre' });
    }

    // Si es tutoría, max_estudiantes debe ser null
    const maxEstudiantes = tipo_clase === 'tutoria' ? null : (max_estudiantes || 10);

    const { data: curso, error } = await supabase
      .from('cursos')
      .insert({
        nombre,
        descripcion,
        nivel: nivel || 'None',
        max_estudiantes: maxEstudiantes,
        tipo_clase,
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
    const cursoResponse = {
      ...curso,
      dias_turno: curso.dias_turno ? JSON.parse(curso.dias_turno) : null
    };

    res.status(201).json(cursoResponse);
  } catch (error) {
    console.error('Error al crear curso:', error);
    res.status(500).json({ error: error.message });
  }
});

// PUT - Actualizar curso
router.put('/:id', async (req, res) => {
  try {
    const { 
      nombre, descripcion, nivel, max_estudiantes = null,
      tipo_clase = 'grupal', dias_turno = null, estado 
    } = req.body;
    const userId = req.user?.id;
    
    // Si es tutoría, max_estudiantes debe ser null
    const maxEstudiantes = tipo_clase === 'tutoria' ? null : max_estudiantes;

    const { data: curso, error } = await supabase
      .from('cursos')
      .update({
        nombre,
        descripcion,
        nivel,
        max_estudiantes: maxEstudiantes,
        tipo_clase,
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
    const cursoResponse = {
      ...curso,
      dias_turno: curso.dias_turno ? JSON.parse(curso.dias_turno) : null
    };

    res.json(cursoResponse);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE - Desactivar curso
router.delete('/:id', async (req, res) => {
  try {
    const userId = req.user?.id;
    const { error } = await supabase
      .from('cursos')
      .update({
        estado: false,
        updated_by: userId,
        updated_at: new Date().toISOString()
      })
      .eq('id', req.params.id);
    
    if (error) throw error;
    res.json({ message: 'Curso desactivado correctamente' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;

