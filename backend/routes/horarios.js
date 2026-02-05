import express from 'express';
import { supabase } from '../supabase.js';

const router = express.Router();

function timeToMinutesSafe(time) {
  if (!time) return null;
  const [h, m] = String(time).split(':').map((n) => Number(n));
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return h * 60 + m;
}

function normalizeDia(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function getDiaFromISODate(fechaISO) {
  // Usar mediodía local para evitar problemas de zona horaria
  const d = new Date(`${fechaISO}T12:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  // JS: 0=domingo..6=sábado
  const map = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
  return map[d.getDay()] || null;
}

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

    // Validación de horarios del tutor (uso real): impedir programar fuera del rango permitido
    const { data: mat, error: matErr } = await supabase
      .from('matriculas')
      .select('id,tutor_id')
      .eq('id', matricula_id)
      .maybeSingle();
    if (matErr) throw matErr;
    if (!mat?.tutor_id) {
      return res.status(400).json({ error: 'No se pudo determinar el tutor de la matrícula' });
    }

    const dia = getDiaFromISODate(String(fecha));
    if (!dia) {
      return res.status(400).json({ error: 'fecha inválida (esperado YYYY-MM-DD)' });
    }

    const hi = timeToMinutesSafe(hora_inicio);
    const hf = timeToMinutesSafe(hora_fin);
    if (hi == null || hf == null || hf <= hi) {
      return res.status(400).json({ error: 'hora_inicio/hora_fin inválidas (HH:mm) o rango incorrecto' });
    }

    const { data: horarios, error: hErr } = await supabase
      .from('horarios_tutores')
      .select('id,dia_semana,hora_inicio,hora_fin,estado')
      .eq('tutor_id', mat.tutor_id)
      .eq('estado', true);
    if (hErr) throw hErr;

    const horariosDia = (horarios ?? []).filter((h) => {
      const v = normalizeDia(h.dia_semana);
      // soportar valores: 'lunes'/'Lunes'/'Miércoles' o números 0..6/1..7
      if (!v) return false;
      if (v === dia) return true;
      const num = Number(v);
      if (Number.isFinite(num)) {
        const mapNum0 = { domingo: 0, lunes: 1, martes: 2, miercoles: 3, jueves: 4, viernes: 5, sabado: 6 };
        const want0 = mapNum0[dia];
        if (want0 == null) return false;
        if (num === want0) return true;
        // 1..7 con domingo=7
        if (num === 7 && want0 === 0) return true;
        if (num === want0 + 1) return true;
      }
      return false;
    });

    const allowedRanges = horariosDia
      .map((h) => ({ hora_inicio: h.hora_inicio, hora_fin: h.hora_fin }))
      .filter((r) => r.hora_inicio && r.hora_fin);

    const isInsideAny = allowedRanges.some((r) => {
      const a = timeToMinutesSafe(r.hora_inicio);
      const b = timeToMinutesSafe(r.hora_fin);
      if (a == null || b == null) return false;
      return hi >= a && hf <= b;
    });

    if (allowedRanges.length > 0 && !isInsideAny) {
      return res.status(409).json({
        error: `Horario fuera del rango permitido para el tutor (${dia}).`,
        dia_semana: dia,
        hora_inicio,
        hora_fin,
        allowed_ranges: allowedRanges,
      });
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

