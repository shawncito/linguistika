import express from 'express';
import { supabase } from '../supabase.js';
import { requireAuth } from '../middleware/auth.js';
import { schemaErrorPayload } from '../utils/schemaErrors.js';

const router = express.Router();

function sendSchemaError(res, error) {
  const payload = schemaErrorPayload(error);
  if (payload) return res.status(400).json(payload);
  return res.status(500).json({ error: error.message });
}

function normalizeName(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function escapeLike(value) {
  return String(value ?? '').replace(/[%_]/g, '\\$&');
}

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
    return sendSchemaError(res, error);
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
    return sendSchemaError(res, error);
  }
});

// POST - Crear nuevo tutor
router.post('/', async (req, res) => {
  try {
    const { 
      nombre, email, telefono, especialidad,
      color = null,
      dias_turno = null,
      dias_horarios = null,
      es_especializado = false,
      niveles_apto = []
    } = req.body;
    const userId = req.user?.id;

    const nombreTrimmed = String(nombre ?? '').trim();
    if (!nombreTrimmed || !especialidad) {
      return res.status(400).json({ error: 'Campos requeridos: nombre, especialidad' });
    }

    const nombreKey = normalizeName(nombreTrimmed);
    const likeValue = escapeLike(nombreKey);
    const dupTutor = await supabase
      .from('tutores')
      .select('id')
      .ilike('nombre', likeValue)
      .limit(1);
    if (dupTutor.error) throw dupTutor.error;
    if ((dupTutor.data ?? []).length > 0) {
      return res.status(409).json({ error: 'Ya existe un tutor con ese nombre' });
    }

    // Validar formato de teléfono si se proporciona
    const phoneRegex = /^(\+506\s?)?\d{4}-\d{4}$/;
    if (telefono && !phoneRegex.test(telefono.trim())) {
      return res.status(400).json({ error: 'Formato de teléfono inválido. Usa: +506 8888-8888' });
    }

    // Validar color HEX si se proporciona
    const colorTrimmed = typeof color === 'string' ? color.trim() : '';
    const colorRegex = /^#[0-9a-fA-F]{6}$/;
    if (colorTrimmed && !colorRegex.test(colorTrimmed)) {
      return res.status(400).json({ error: 'Formato de color inválido. Usa: #RRGGBB' });
    }

    const { data: tutor, error } = await supabase
      .from('tutores')
      .insert({
        nombre: nombreTrimmed,
        email: email || null,
        telefono: telefono || null,
        especialidad,
        color: colorTrimmed || null,
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
      // Compatibilidad: si la instalación aún no tiene columna `color`, reintentar sin ella.
      const msg = String(error?.message || '');
      const code = String(error?.code || '');
      const isMissingColorColumn = code === '42703' || /column\s+"color"\s+does\s+not\s+exist/i.test(msg);
      if (!isMissingColorColumn) {
        console.error('Error en Supabase:', error);
        throw error;
      }

      console.warn('Columna `tutores.color` no existe; guardando tutor sin color. Aplica la migración 023_add_color_to_tutores.sql.');
      const { data: tutor2, error: error2 } = await supabase
        .from('tutores')
        .insert({
          nombre,
          email: email || null,
          telefono: telefono || null,
          especialidad,
          tarifa_por_hora: 0,
          dias_turno: dias_turno || null,
          dias_horarios: dias_horarios || null,
          es_especializado: !!es_especializado,
          niveles_apto: Array.isArray(niveles_apto) ? niveles_apto : [],
          created_by: userId,
          estado: true
        })
        .select()
        .single();

      if (error2) {
        console.error('Error en Supabase (retry sin color):', error2);
        throw error2;
      }

      return res.status(201).json(tutor2);
    }

    res.status(201).json(tutor);
  } catch (error) {
    console.error('Error al crear tutor:', error);
    return sendSchemaError(res, error);
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
    if (req.body.color !== undefined) {
      const colorTrimmed = typeof req.body.color === 'string' ? req.body.color.trim() : '';
      const colorRegex = /^#[0-9a-fA-F]{6}$/;
      if (colorTrimmed && !colorRegex.test(colorTrimmed)) {
        return res.status(400).json({ error: 'Formato de color inválido. Usa: #RRGGBB' });
      }
      updateData.color = colorTrimmed || null;
    }
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

    if (error) {
      // Compatibilidad: si la instalación aún no tiene columna `color`, reintentar sin ella.
      const msg = String(error?.message || '');
      const code = String(error?.code || '');
      const isMissingColorColumn = code === '42703' || /column\s+"color"\s+does\s+not\s+exist/i.test(msg);
      if (!isMissingColorColumn || !('color' in updateData)) throw error;

      console.warn('Columna `tutores.color` no existe; actualizando tutor sin color. Aplica la migración 023_add_color_to_tutores.sql.');
      const { color: _ignored, ...updateDataNoColor } = updateData;
      const { data: tutor2, error: error2 } = await supabase
        .from('tutores')
        .update(updateDataNoColor)
        .eq('id', req.params.id)
        .select()
        .single();
      if (error2) throw error2;

      const tutorResponse2 = {
        ...tutor2,
        estado: tutor2.estado ? 1 : 0
      };

      return res.json(tutorResponse2);
    }

    // Convertir estado a número en la respuesta
    const tutorResponse = {
      ...tutor,
      estado: tutor.estado ? 1 : 0
    };

    res.json(tutorResponse);
  } catch (error) {
    return sendSchemaError(res, error);
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
    return sendSchemaError(res, error);
  }
});

export default router;

