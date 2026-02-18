import express from 'express';
import { supabase } from '../supabase.js';
import { getOrCreateEncargadoId } from '../utils/encargados.js';
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
    return sendSchemaError(res, error);
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
    return sendSchemaError(res, error);
  }
});

// POST - Crear nuevo estudiante
router.post('/', async (req, res) => {
  try {
    const { 
      nombre, email, email_encargado, telefono, telefono_encargado,
      nombre_encargado,
      grado = null,
      dias = null,
      turno = null,
      dias_turno = null
    } = req.body;
    const userId = req.user?.id;

    const nombreTrimmed = String(nombre ?? '').trim();
    if (!nombreTrimmed) {
      return res.status(400).json({ error: 'Campo requerido: nombre' });
    }

    const nombreKey = normalizeName(nombreTrimmed);
    const likeValue = escapeLike(nombreKey);
    const [dupNormal, dupBulk] = await Promise.all([
      supabase.from('estudiantes').select('id').ilike('nombre', likeValue).limit(1),
      supabase.from('estudiantes_bulk').select('id').ilike('nombre', likeValue).limit(1),
    ]);

    if (dupNormal.error) throw dupNormal.error;
    if (dupBulk.error) throw dupBulk.error;
    if ((dupNormal.data ?? []).length > 0 || (dupBulk.data ?? []).length > 0) {
      return res.status(409).json({ error: 'Ya existe un estudiante con ese nombre' });
    }

    // Validar formato de teléfono si se proporciona (acepta códigos internacionales)
    const phoneRegex = /^(\+\d{1,4}\s?)?[\d\s-]{7,15}$/;
    if (telefono_encargado && !phoneRegex.test(telefono_encargado.trim())) {
      return res.status(400).json({ error: 'Formato de teléfono inválido. Usa: +XXX XXXXXXXX' });
    }

    const encargado_id = await getOrCreateEncargadoId({
      nombre: nombre_encargado || null,
      email: email_encargado || null,
      telefono: telefono_encargado || null,
    });

    const { data: estudiante, error } = await supabase
      .from('estudiantes')
      .insert({
        nombre: nombreTrimmed,
        nombre_encargado: nombre_encargado || null,
        email: email || null,
        email_encargado: email_encargado || null,
        telefono: telefono || null,
        telefono_encargado: telefono_encargado || null,
        encargado_id: encargado_id || null,
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
    return sendSchemaError(res, error);
  }
});

// PUT - Actualizar estudiante
router.put('/:id', async (req, res) => {
  try {
    const userId = req.user?.id;
    
    // Validar formato de teléfono si se proporciona (acepta códigos internacionales)
    const phoneRegex = /^(\+\d{1,4}\s?)?[\d\s-]{7,15}$/;
    if (req.body.telefono_encargado && !phoneRegex.test(req.body.telefono_encargado.trim())) {
      return res.status(400).json({ error: 'Formato de teléfono inválido. Usa: +XXX XXXXXXXX' });
    }

    // Construir objeto de actualización solo con campos presentes
    const updateData = {
      updated_by: userId,
      updated_at: new Date().toISOString()
    };

    if (req.body.nombre !== undefined) updateData.nombre = req.body.nombre;
    if (req.body.nombre_encargado !== undefined) updateData.nombre_encargado = req.body.nombre_encargado || null;
    if (req.body.email !== undefined) updateData.email = req.body.email || null;
    if (req.body.email_encargado !== undefined) updateData.email_encargado = req.body.email_encargado || null;
    if (req.body.telefono !== undefined) updateData.telefono = req.body.telefono || null;
    if (req.body.telefono_encargado !== undefined) updateData.telefono_encargado = req.body.telefono_encargado || null;
    if (req.body.grado !== undefined) updateData.grado = req.body.grado;
    if (req.body.dias !== undefined) updateData.dias = req.body.dias ? JSON.stringify(req.body.dias) : null;
    if (req.body.turno !== undefined) updateData.turno = req.body.turno;
    if (req.body.dias_turno !== undefined) updateData.dias_turno = req.body.dias_turno ? JSON.stringify(req.body.dias_turno) : null;
    if (req.body.estado !== undefined) updateData.estado = req.body.estado === 1 || req.body.estado === true;

    // Si se actualiza la info del encargado, mantener encargado_id consistente.
    const touchedEnc =
      req.body.nombre_encargado !== undefined ||
      req.body.email_encargado !== undefined ||
      req.body.telefono_encargado !== undefined;

    if (touchedEnc) {
      const emailEnc = req.body.email_encargado !== undefined ? req.body.email_encargado : null;
      const telEnc = req.body.telefono_encargado !== undefined ? req.body.telefono_encargado : null;
      const nomEnc = req.body.nombre_encargado !== undefined ? req.body.nombre_encargado : null;

      if (!emailEnc && !telEnc) {
        updateData.encargado_id = null;
      } else {
        const encargado_id = await getOrCreateEncargadoId({
          nombre: nomEnc,
          email: emailEnc,
          telefono: telEnc,
        });
        if (encargado_id) updateData.encargado_id = encargado_id;
      }
    }

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
    return sendSchemaError(res, error);
  }
});

// DELETE - Eliminar estudiante permanentemente
router.delete('/:id', async (req, res) => {
  try {
    const estudianteId = Number(req.params.id);
    
    // Obtener encargado_id del estudiante antes de eliminarlo
    const { data: estudiante, error: estErr } = await supabase
      .from('estudiantes')
      .select('encargado_id')
      .eq('id', estudianteId)
      .single();
    
    if (estErr && estErr.code !== 'PGRST116') throw estErr;
    const encargadoId = estudiante?.encargado_id;
    
    // Eliminar estudiante
    const { error } = await supabase
      .from('estudiantes')
      .delete()
      .eq('id', estudianteId);
    
    if (error) throw error;
    
    // Si tenía encargado, verificar si quedan otros estudiantes con el mismo encargado
    if (encargadoId) {
      const { data: otrosEstudiantes, error: otrosErr } = await supabase
        .from('estudiantes')
        .select('id')
        .eq('encargado_id', encargadoId)
        .limit(1);
      
      if (otrosErr) throw otrosErr;
      
      // Si no quedan estudiantes, eliminar cuenta de tesorería del encargado
      if (!otrosEstudiantes || otrosEstudiantes.length === 0) {
        const { error: cuentaErr } = await supabase
          .from('tesoreria_cuentas_corrientes')
          .delete()
          .eq('tipo', 'encargado')
          .eq('encargado_id', encargadoId);
        
        // No lanzar error si la cuenta no existe o falla (puede no tener cuenta creada)
        if (cuentaErr) {
          console.warn(`No se pudo eliminar cuenta de encargado ${encargadoId}:`, cuentaErr.message);
        }
      }
    }
    
    res.json({ message: 'Estudiante eliminado correctamente' });
  } catch (error) {
    return sendSchemaError(res, error);
  }
});

export default router;

