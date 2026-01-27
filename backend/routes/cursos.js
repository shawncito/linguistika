import express from 'express';
import { supabase } from '../supabase.js';
import { validateTutorCourseSchedule } from '../utils/scheduleValidator.js';

const router = express.Router();

// GET - Listar todos los cursos
router.get('/', async (req, res) => {
  try {
    const { data: cursos, error } = await supabase
      .from('cursos')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) throw error;

    // Parse JSON fields y convertir estado a número
    const cursosResponse = cursos.map(c => ({
      ...c,
      dias: c.dias ? JSON.parse(c.dias) : null,
      dias_turno: c.dias_turno ? JSON.parse(c.dias_turno) : null,
      dias_schedule: c.dias_schedule ? JSON.parse(c.dias_schedule) : null,
      grado_activo: c.grado_activo,
      grado_nombre: c.grado_nombre,
      grado_color: c.grado_color,
      tutor_id: c.tutor_id,
      estado: c.estado ? 1 : 0
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
      dias: curso.dias ? JSON.parse(curso.dias) : null,
      dias_turno: curso.dias_turno ? JSON.parse(curso.dias_turno) : null,
      dias_schedule: curso.dias_schedule ? JSON.parse(curso.dias_schedule) : null,
      grado_activo: curso.grado_activo,
      grado_nombre: curso.grado_nombre,
      grado_color: curso.grado_color,
      tutor_id: curso.tutor_id
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
      tipo_clase = 'grupal', dias = null, dias_turno = null, dias_schedule = null,
      costo_curso = 0, pago_tutor = 0,
      grado_activo = false, grado_nombre = null, grado_color = null,
      tutor_id = null
    } = req.body;
    const userId = req.user?.id;
    
    if (!nombre) {
      return res.status(400).json({ error: 'Campo requerido: nombre' });
    }

    // Si se proporciona tutor_id, validar compatibilidad
    if (tutor_id && (dias_schedule || dias_turno)) {
      const { data: tutor, error: tutorError } = await supabase
        .from('tutores')
        .select('*')
        .eq('id', tutor_id)
        .single();
      
      if (tutorError || !tutor) {
        return res.status(404).json({ error: 'Tutor no encontrado' });
      }

      // Validar compatibilidad de horarios
      const tutorObj = {
        ...tutor,
        dias_horarios: tutor.dias_horarios // Ya viene como objeto desde Supabase JSONB
      };
      const cursoObj = {
        dias_schedule: dias_schedule,
        dias_turno: dias_turno
      };

      const validation = validateTutorCourseSchedule(tutorObj, cursoObj);
      if (!validation.compatible) {
        return res.status(409).json({
          error: 'Horarios incompatibles',
          details: validation.issues
        });
      }
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
        dias: dias ? JSON.stringify(dias) : null,
        dias_schedule: dias_schedule ? JSON.stringify(dias_schedule) : null,
        costo_curso: parseFloat(costo_curso) || 0,
        pago_tutor: parseFloat(pago_tutor) || 0,
        grado_activo: !!grado_activo,
        grado_nombre: grado_nombre || null,
        grado_color: grado_color || null,
        tutor_id: tutor_id || null,
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
      dias: curso.dias ? JSON.parse(curso.dias) : null,
      dias_turno: curso.dias_turno ? JSON.parse(curso.dias_turno) : null,
      dias_schedule: curso.dias_schedule ? JSON.parse(curso.dias_schedule) : null,
      grado_activo: curso.grado_activo,
      grado_nombre: curso.grado_nombre,
      grado_color: curso.grado_color,
      tutor_id: curso.tutor_id
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
    const userId = req.user?.id;
    
    // Construir objeto de actualización solo con campos presentes
    const updateData = {
      updated_by: userId,
      updated_at: new Date().toISOString()
    };

    if (req.body.nombre !== undefined) updateData.nombre = req.body.nombre;
    if (req.body.descripcion !== undefined) updateData.descripcion = req.body.descripcion;
    if (req.body.nivel !== undefined) updateData.nivel = req.body.nivel;
    if (req.body.tipo_clase !== undefined) updateData.tipo_clase = req.body.tipo_clase;
    
    // Si es tutoría, max_estudiantes debe ser null
    if (req.body.max_estudiantes !== undefined) {
      updateData.max_estudiantes = req.body.tipo_clase === 'tutoria' ? null : req.body.max_estudiantes;
    }
    
    if (req.body.dias !== undefined) updateData.dias = req.body.dias ? JSON.stringify(req.body.dias) : null;
    if (req.body.dias_schedule !== undefined) updateData.dias_schedule = req.body.dias_schedule ? JSON.stringify(req.body.dias_schedule) : null;
    if (req.body.costo_curso !== undefined) updateData.costo_curso = parseFloat(req.body.costo_curso) || 0;
    if (req.body.pago_tutor !== undefined) updateData.pago_tutor = parseFloat(req.body.pago_tutor) || 0;
    if (req.body.grado_activo !== undefined) updateData.grado_activo = !!req.body.grado_activo;
    if (req.body.grado_nombre !== undefined) updateData.grado_nombre = req.body.grado_nombre || null;
    if (req.body.grado_color !== undefined) updateData.grado_color = req.body.grado_color || null;
    if (req.body.tutor_id !== undefined) updateData.tutor_id = req.body.tutor_id || null;
    if (req.body.estado !== undefined) updateData.estado = req.body.estado === 1 || req.body.estado === true;

    const { data: curso, error } = await supabase
      .from('cursos')
      .update(updateData)
      .eq('id', req.params.id)
      .select()
      .single();
    
    if (error) throw error;

    // Parse JSON fields for response y convertir estado a número
    const cursoResponse = {
      ...curso,
      dias: curso.dias ? JSON.parse(curso.dias) : null,
      dias_turno: curso.dias_turno ? JSON.parse(curso.dias_turno) : null,
      dias_schedule: curso.dias_schedule ? JSON.parse(curso.dias_schedule) : null,
      grado_activo: curso.grado_activo,
      grado_nombre: curso.grado_nombre,
      grado_color: curso.grado_color,
      tutor_id: curso.tutor_id,
      estado: curso.estado ? 1 : 0
    };

    res.json(cursoResponse);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE - Eliminar curso permanentemente
router.delete('/:id', async (req, res) => {
  try {
    const { error } = await supabase
      .from('cursos')
      .delete()
      .eq('id', req.params.id);
    
    if (error) throw error;
    res.json({ message: 'Curso eliminado correctamente' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;

