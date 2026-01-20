import express from 'express';
import { supabase } from '../supabase.js';

const router = express.Router();

// GET - Listar todas las matrículas
router.get('/', async (req, res) => {
  try {
    const { data: matriculas, error } = await supabase
      .from('matriculas')
      .select(`
        *,
        estudiantes:estudiante_id (nombre),
        cursos:curso_id (nombre),
        tutores:tutor_id (nombre)
      `)
      .eq('estado', true)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    
    // Reformatear respuesta para compatibilidad
    const formatted = matriculas.map(m => ({
      ...m,
      estudiante_nombre: m.estudiantes?.nombre,
      curso_nombre: m.cursos?.nombre,
      tutor_nombre: m.tutores?.nombre
    }));
    
    res.json(formatted);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET - Obtener una matrícula por ID
router.get('/:id', async (req, res) => {
  try {
    const { data: matricula, error } = await supabase
      .from('matriculas')
      .select(`
        *,
        estudiantes:estudiante_id (nombre),
        cursos:curso_id (nombre),
        tutores:tutor_id (nombre, tarifa_por_hora)
      `)
      .eq('id', req.params.id)
      .single();
    
    if (error) throw error;
    if (!matricula) {
      return res.status(404).json({ error: 'Matrícula no encontrada' });
    }
    
    // Reformatear respuesta
    const formatted = {
      ...matricula,
      estudiante_nombre: matricula.estudiantes?.nombre,
      curso_nombre: matricula.cursos?.nombre,
      tutor_nombre: matricula.tutores?.nombre,
      tarifa_por_hora: matricula.tutores?.tarifa_por_hora
    };
    
    res.json(formatted);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST - Crear nueva matrícula
router.post('/', async (req, res) => {
  try {
    const { estudiante_id, curso_id, tutor_id } = req.body;
    const userId = req.user?.id;
    
    if (!estudiante_id || !curso_id || !tutor_id) {
      return res.status(400).json({ error: 'Campos requeridos: estudiante_id, curso_id, tutor_id' });
    }

    // Verificar que estudiante, curso y tutor existan
    const [estudianteCheck, cursoCheck, tutorCheck] = await Promise.all([
      supabase.from('estudiantes').select('id').eq('id', estudiante_id).single(),
      supabase.from('cursos').select('id').eq('id', curso_id).single(),
      supabase.from('tutores').select('id').eq('id', tutor_id).single()
    ]);

    if (estudianteCheck.error || cursoCheck.error || tutorCheck.error) {
      return res.status(400).json({ error: 'Estudiante, curso o tutor no existen' });
    }

    const { data: nuevaMatricula, error } = await supabase
      .from('matriculas')
      .insert({
        estudiante_id,
        curso_id,
        tutor_id,
        created_by: userId,
        estado: true
      })
      .select(`
        *,
        estudiantes:estudiante_id (nombre),
        cursos:curso_id (nombre),
        tutores:tutor_id (nombre)
      `)
      .single();
    
    if (error) throw error;
    
    const formatted = {
      ...nuevaMatricula,
      estudiante_nombre: nuevaMatricula.estudiantes?.nombre,
      curso_nombre: nuevaMatricula.cursos?.nombre,
      tutor_nombre: nuevaMatricula.tutores?.nombre
    };
    
    res.status(201).json(formatted);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT - Actualizar matrícula
router.put('/:id', async (req, res) => {
  try {
    const { estudiante_id, curso_id, tutor_id, estado } = req.body;
    const userId = req.user?.id;
    
    const { data: matricula, error } = await supabase
      .from('matriculas')
      .update({
        estudiante_id,
        curso_id,
        tutor_id,
        estado,
        updated_by: userId,
        updated_at: new Date().toISOString()
      })
      .eq('id', req.params.id)
      .select(`
        *,
        estudiantes:estudiante_id (nombre),
        cursos:curso_id (nombre),
        tutores:tutor_id (nombre)
      `)
      .single();
    
    if (error) throw error;
    
    const formatted = {
      ...matricula,
      estudiante_nombre: matricula.estudiantes?.nombre,
      curso_nombre: matricula.cursos?.nombre,
      tutor_nombre: matricula.tutores?.nombre
    };
    
    res.json(formatted);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE - Desactivar matrícula
router.delete('/:id', async (req, res) => {
  try {
    const userId = req.user?.id;
    const { error } = await supabase
      .from('matriculas')
      .update({
        estado: false,
        updated_by: userId,
        updated_at: new Date().toISOString()
      })
      .eq('id', req.params.id);
    
    if (error) throw error;
    res.json({ message: 'Matrícula desactivada correctamente' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;

