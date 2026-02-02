import express from 'express';
import { supabase } from '../supabase.js';

const router = express.Router();

// GET - Listar todos los estudiantes
router.get('/', async (req, res) => {
  try {
    const { data: estudiantes, error } = await supabase
      .from('estudiantes')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) throw error;

    // Parse JSON fields y convertir estado booleano a número
    const estudiantesResponse = estudiantes.map(e => ({
      ...e,
      dias: e.dias ? JSON.parse(e.dias) : null,
      dias_turno: e.dias_turno ? JSON.parse(e.dias_turno) : null,
      estado: e.estado ? 1 : 0,
      // Compat: si la columna no existe todavía, queda null
      matricula_grupo_id: e.matricula_grupo_id ?? null,
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
      .maybeSingle();

    if (error) throw error;
    if (!estudiante) return res.status(404).json({ error: 'Estudiante no encontrado' });

    // Parse JSON fields
    const estudianteResponse = {
      ...estudiante,
      dias: estudiante.dias ? JSON.parse(estudiante.dias) : null,
      dias_turno: estudiante.dias_turno ? JSON.parse(estudiante.dias_turno) : null,
      estado: estudiante.estado ? 1 : 0,
      matricula_grupo_id: estudiante.matricula_grupo_id ?? null,
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
    const userId = req.user?.id;
    
    // Validar formato de teléfono si se proporciona
    const phoneRegex = /^(\+506\s?)?\d{4}-\d{4}$/;
    if (req.body.telefono_encargado && !phoneRegex.test(req.body.telefono_encargado.trim())) {
      return res.status(400).json({ error: 'Formato de teléfono inválido. Usa: +506 8888-8888' });
    }

    // Construir objeto de actualización solo con campos presentes
    const updateData = {
      updated_by: userId,
      updated_at: new Date().toISOString()
    };

    if (req.body.nombre !== undefined) updateData.nombre = req.body.nombre;
    if (req.body.email !== undefined) updateData.email = req.body.email || null;
    if (req.body.email_encargado !== undefined) updateData.email_encargado = req.body.email_encargado || null;
    if (req.body.telefono !== undefined) updateData.telefono = req.body.telefono || null;
    if (req.body.telefono_encargado !== undefined) updateData.telefono_encargado = req.body.telefono_encargado || null;
    if (req.body.grado !== undefined) updateData.grado = req.body.grado;
    if (req.body.dias !== undefined) updateData.dias = req.body.dias ? JSON.stringify(req.body.dias) : null;
    if (req.body.turno !== undefined) updateData.turno = req.body.turno;
    if (req.body.dias_turno !== undefined) updateData.dias_turno = req.body.dias_turno ? JSON.stringify(req.body.dias_turno) : null;
    if (req.body.estado !== undefined) updateData.estado = req.body.estado === 1 || req.body.estado === true;

    const { data: estudiante, error } = await supabase
      .from('estudiantes')
      .update(updateData)
      .eq('id', req.params.id)
      .select()
      .single();
    
    if (error) throw error;

    // Parse JSON fields for response y convertir estado a número
    const estudianteResponse = {
      ...estudiante,
      dias: estudiante.dias ? JSON.parse(estudiante.dias) : null,
      dias_turno: estudiante.dias_turno ? JSON.parse(estudiante.dias_turno) : null,
      estado: estudiante.estado ? 1 : 0
    };

    res.json(estudianteResponse);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE - Eliminar estudiante permanentemente
router.delete('/:id', async (req, res) => {
  try {
    const { error } = await supabase
      .from('estudiantes')
      .delete()
      .eq('id', req.params.id);
    
    if (error) throw error;
    res.json({ message: 'Estudiante eliminado correctamente' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;

