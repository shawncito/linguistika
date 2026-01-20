import express from 'express';
import { supabase } from '../supabase.js';

const router = express.Router();

// GET - Listar todos los horarios de un tutor
router.get('/tutor/:tutor_id', async (req, res) => {
  try {
    const { data: horarios, error } = await supabase
      .from('horarios_tutores')
      .select('*')
      .eq('tutor_id', req.params.tutor_id)
      .eq('estado', true);
    
    if (error) throw error;
    res.json(horarios);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST - Crear nuevo horario para tutor
router.post('/', async (req, res) => {
  try {
    const { tutor_id, dia_semana, hora_inicio, hora_fin } = req.body;
    const userId = req.user?.id;
    
    if (!tutor_id || !dia_semana || !hora_inicio || !hora_fin) {
      return res.status(400).json({ error: 'Campos requeridos: tutor_id, dia_semana, hora_inicio, hora_fin' });
    }

    // Verificar que el tutor existe
    const { data: tutor, error: tutorError } = await supabase
      .from('tutores')
      .select('id')
      .eq('id', tutor_id)
      .single();
    
    if (tutorError || !tutor) {
      return res.status(400).json({ error: 'Tutor no existe' });
    }

    const { data: horario, error } = await supabase
      .from('horarios_tutores')
      .insert({
        tutor_id,
        dia_semana,
        hora_inicio,
        hora_fin,
        created_by: userId,
        estado: true
      })
      .select()
      .single();
    
    if (error) throw error;
    res.status(201).json(horario);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT - Actualizar horario
router.put('/:id', async (req, res) => {
  try {
    const { dia_semana, hora_inicio, hora_fin, estado } = req.body;
    const userId = req.user?.id;
    
    const { data: horario, error } = await supabase
      .from('horarios_tutores')
      .update({
        dia_semana,
        hora_inicio,
        hora_fin,
        estado,
        updated_by: userId,
        updated_at: new Date().toISOString()
      })
      .eq('id', req.params.id)
      .select()
      .single();
    
    if (error) throw error;
    res.json(horario);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE - Desactivar horario
router.delete('/:id', async (req, res) => {
  try {
    const userId = req.user?.id;
    const { error } = await supabase
      .from('horarios_tutores')
      .update({
        estado: false,
        updated_by: userId,
        updated_at: new Date().toISOString()
      })
      .eq('id', req.params.id);
    
    if (error) throw error;
    res.json({ message: 'Horario desactivado correctamente' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST - Crear clase (programar una tutoría)
router.post('/clases/crear', async (req, res) => {
  try {
    const { matricula_id, fecha, hora_inicio, hora_fin, notas } = req.body;
    const userId = req.user?.id;
    
    if (!matricula_id || !fecha || !hora_inicio || !hora_fin) {
      return res.status(400).json({ error: 'Campos requeridos: matricula_id, fecha, hora_inicio, hora_fin' });
    }

    const { data: clase, error } = await supabase
      .from('clases')
      .insert({
        matricula_id,
        fecha,
        hora_inicio,
        hora_fin,
        notas,
        created_by: userId,
        estado: 'programada'
      })
      .select()
      .single();
    
    if (error) throw error;
    res.status(201).json(clase);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET - Obtener todas las clases
router.get('/clases/todas', async (req, res) => {
  try {
    const { data: clases, error } = await supabase
      .from('clases')
      .select(`
        *,
        matriculas!inner (
          estudiante_id,
          tutor_id,
          estudiantes (nombre),
          tutores (nombre)
        )
      `);
    
    if (error) throw error;
    
    const formatted = clases.map(c => ({
      ...c,
      estudiante_id: c.matriculas?.estudiante_id,
      tutor_id: c.matriculas?.tutor_id,
      estudiante_nombre: c.matriculas?.estudiantes?.nombre,
      tutor_nombre: c.matriculas?.tutores?.nombre
    }));
    
    res.json(formatted);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;

