import express from 'express';
import { randomUUID } from 'crypto';
import { supabase } from '../supabase.js';
import { validateTutorCourseSchedule } from '../utils/scheduleValidator.js';

const router = express.Router();

// GET - Listar todas las matrículas
router.get('/', async (req, res) => {
  try {
    const { data: matriculas, error } = await supabase
      .from('matriculas')
      .select(`
        *,
        estudiantes:estudiante_id (nombre),
        cursos:curso_id (nombre, dias_turno, dias_schedule, tipo_clase, max_estudiantes, grado_activo, grado_nombre, grado_color, costo_curso, pago_tutor),
        tutores:tutor_id (nombre, tarifa_por_hora)
      `)
      .eq('estado', true)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    
    // Reformatear respuesta para compatibilidad
    const formatted = matriculas.map(m => ({
      ...m,
      estudiante_nombre: m.estudiantes?.nombre,
      curso_nombre: m.cursos?.nombre,
      tutor_nombre: m.tutores?.nombre,
      tarifa_por_hora: m.tutores?.tarifa_por_hora,
      es_grupo: m.es_grupo,
      grupo_id: m.grupo_id,
      grupo_nombre: m.grupo_nombre,
      curso_dias_turno: m.cursos?.dias_turno || null,
      curso_dias_schedule: m.cursos?.dias_schedule || null,
      curso_tipo_clase: m.cursos?.tipo_clase || null,
      curso_max_estudiantes: m.cursos?.max_estudiantes || null,
      curso_grado_activo: m.cursos?.grado_activo || null,
      curso_grado_nombre: m.cursos?.grado_nombre || null,
      curso_grado_color: m.cursos?.grado_color || null,
      curso_costo_curso: m.cursos?.costo_curso || null,
      curso_pago_tutor: m.cursos?.pago_tutor || null
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
        cursos:curso_id (nombre, dias_turno, dias_schedule, tipo_clase, max_estudiantes, grado_activo, grado_nombre, grado_color, costo_curso, pago_tutor),
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
      tarifa_por_hora: matricula.tutores?.tarifa_por_hora,
      es_grupo: matricula.es_grupo,
      grupo_id: matricula.grupo_id,
      grupo_nombre: matricula.grupo_nombre,
      curso_dias_turno: matricula.cursos?.dias_turno || null,
      curso_dias_schedule: matricula.cursos?.dias_schedule || null,
      curso_tipo_clase: matricula.cursos?.tipo_clase || null,
      curso_max_estudiantes: matricula.cursos?.max_estudiantes || null,
      curso_grado_activo: matricula.cursos?.grado_activo || null,
      curso_grado_nombre: matricula.cursos?.grado_nombre || null,
      curso_grado_color: matricula.cursos?.grado_color || null,
      curso_costo_curso: matricula.cursos?.costo_curso || null,
      curso_pago_tutor: matricula.cursos?.pago_tutor || null
    };
    
    res.json(formatted);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST - Crear nueva matrícula
router.post('/', async (req, res) => {
  try {
    const { estudiante_id, estudiante_ids, curso_id, tutor_id, es_grupo = false, grupo_id = null, grupo_nombre = null } = req.body;
    const userId = req.user?.id;
    
    if ((!estudiante_id && !Array.isArray(estudiante_ids)) || !curso_id || !tutor_id) {
      return res.status(400).json({ error: 'Campos requeridos: estudiante_id o estudiante_ids, curso_id, tutor_id' });
    }

    // Verificar que estudiante, curso y tutor existan
    const [cursoCheck, tutorCheck] = await Promise.all([
      supabase.from('cursos').select('*').eq('id', curso_id).single(),
      supabase.from('tutores').select('*').eq('id', tutor_id).single()
    ]);
    if (cursoCheck.error || tutorCheck.error) {
      return res.status(400).json({ error: 'Curso o tutor no existen' });
    }

    // Validar compatibilidad de horarios del tutor con el curso
    const tutorObj = {
      ...tutorCheck.data,
      dias_horarios: tutorCheck.data.dias_horarios ? JSON.parse(tutorCheck.data.dias_horarios) : null
    };
    const cursoObj = {
      dias_schedule: cursoCheck.data.dias_schedule ? JSON.parse(cursoCheck.data.dias_schedule) : null,
      dias_turno: cursoCheck.data.dias_turno ? JSON.parse(cursoCheck.data.dias_turno) : null
    };

    const validation = validateTutorCourseSchedule(tutorObj, cursoObj);
    if (!validation.compatible) {
      return res.status(409).json({
        error: 'Horarios incompatibles entre tutor y curso',
        details: validation.issues
      });
    }

    // Normalizar lista de estudiantes
    let listaEstudiantes = [];
    if (Array.isArray(estudiante_ids) && estudiante_ids.length > 0) {
      listaEstudiantes = estudiante_ids.map((x) => parseInt(x)).filter((x) => !!x);
    } else if (estudiante_id) {
      listaEstudiantes = [parseInt(estudiante_id)];
    }
    if (!listaEstudiantes.length) {
      return res.status(400).json({ error: 'No se recibieron estudiantes' });
    }

    // Validar existencia de los estudiantes
    const { data: estRows, error: estErr } = await supabase
      .from('estudiantes')
      .select('id')
      .in('id', listaEstudiantes);
    if (estErr) throw estErr;
    const existentes = new Set((estRows || []).map((r) => r.id));
    const faltantes = listaEstudiantes.filter((id) => !existentes.has(id));
    if (faltantes.length > 0) {
      return res.status(400).json({ error: `Estudiantes no encontrados: ${faltantes.join(', ')}` });
    }

    const nuevoGrupoId = grupo_id || randomUUID();

    // Insertar 1..N matrículas (grupal cuando hay múltiples)
    const registros = listaEstudiantes.map((eid) => ({
      estudiante_id: eid,
      curso_id,
      tutor_id,
      es_grupo: !!es_grupo || listaEstudiantes.length > 1,
      grupo_id: nuevoGrupoId,
      grupo_nombre: grupo_nombre || null,
      created_by: userId,
      estado: true
    }));

    const { data: nuevas, error } = await supabase
      .from('matriculas')
      .insert(registros)
      .select(`
        *,
        estudiantes:estudiante_id (nombre),
        cursos:curso_id (nombre),
        tutores:tutor_id (nombre)
      `);
    if (error) throw error;

    const formatted = (nuevas || []).map((m) => ({
      ...m,
      estudiante_nombre: m.estudiantes?.nombre,
      curso_nombre: m.cursos?.nombre,
      tutor_nombre: m.tutores?.nombre,
      es_grupo: m.es_grupo,
      grupo_id: m.grupo_id,
      grupo_nombre: m.grupo_nombre
    }));

    res.status(201).json(formatted.length === 1 ? formatted[0] : formatted);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT - Actualizar matrícula
router.put('/:id', async (req, res) => {
  try {
    const { estudiante_id, curso_id, tutor_id, estado, es_grupo = false, grupo_id = null, grupo_nombre = null } = req.body;
    const userId = req.user?.id;
    
    const { data: matricula, error } = await supabase
      .from('matriculas')
      .update({
        estudiante_id,
        curso_id,
        tutor_id,
        estado,
        es_grupo: !!es_grupo,
        grupo_id: grupo_id || randomUUID(),
        grupo_nombre: grupo_nombre || null,
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
      tutor_nombre: matricula.tutores?.nombre,
      es_grupo: matricula.es_grupo,
      grupo_id: matricula.grupo_id,
      grupo_nombre: matricula.grupo_nombre
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

// GET - Validar compatibilidad de horarios entre tutor y curso
router.get('/validate/tutor-course/:tutor_id/:curso_id', async (req, res) => {
  try {
    const { tutor_id, curso_id } = req.params;

    const [{ data: tutor, error: tutorError }, { data: curso, error: cursoError }] = await Promise.all([
      supabase.from('tutores').select('*').eq('id', tutor_id).single(),
      supabase.from('cursos').select('*').eq('id', curso_id).single()
    ]);

    if (tutorError || !tutor || cursoError || !curso) {
      return res.status(404).json({ error: 'Tutor o curso no encontrado' });
    }

    const tutorObj = {
      ...tutor,
      dias_horarios: tutor.dias_horarios ? JSON.parse(tutor.dias_horarios) : null
    };
    const cursoObj = {
      dias_schedule: curso.dias_schedule ? JSON.parse(curso.dias_schedule) : null,
      dias_turno: curso.dias_turno ? JSON.parse(curso.dias_turno) : null
    };

    const validation = validateTutorCourseSchedule(tutorObj, cursoObj);
    res.json(validation);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;

