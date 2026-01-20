import express from 'express';
import { supabase } from '../supabase.js';

const router = express.Router();

// GET - Dashboard: Obtener tutorías del día (ruta con acento)
router.get('/tutorías/:fecha', async (req, res) => {
  try {
    const { fecha } = req.params;
    
    const { data: tutorías, error } = await supabase
      .from('clases')
      .select(`
        id,
        fecha,
        hora_inicio,
        hora_fin,
        estado,
        matriculas!inner (
          estudiante_id,
          tutor_id,
          curso_id,
          estudiantes (id, nombre),
          tutores (id, nombre, tarifa_por_hora),
          cursos (nombre)
        )
      `)
      .eq('fecha', fecha)
      .in('estado', ['programada', 'completada'])
      .order('hora_inicio', { ascending: true });
    
    if (error) throw error;
    
    const formatted = tutorías.map(t => ({
      id: t.id,
      fecha: t.fecha,
      hora_inicio: t.hora_inicio,
      hora_fin: t.hora_fin,
      estado: t.estado,
      estudiante_id: t.matriculas?.estudiante_id,
      estudiante_nombre: t.matriculas?.estudiantes?.nombre,
      tutor_id: t.matriculas?.tutor_id,
      tutor_nombre: t.matriculas?.tutores?.nombre,
      curso_nombre: t.matriculas?.cursos?.nombre,
      tarifa_por_hora: t.matriculas?.tutores?.tarifa_por_hora
    }));
    
    res.json(formatted);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET - Dashboard: Obtener tutorias del día (alias ASCII sin acento)
router.get('/tutorias/:fecha', async (req, res) => {
  try {
    const { fecha } = req.params;

    const { data: tutorias, error } = await supabase
      .from('clases')
      .select(`
        id,
        fecha,
        hora_inicio,
        hora_fin,
        estado,
        matriculas!inner (
          estudiante_id,
          tutor_id,
          curso_id,
          estudiantes (id, nombre),
          tutores (id, nombre, tarifa_por_hora),
          cursos (nombre)
        )
      `)
      .eq('fecha', fecha)
      .in('estado', ['programada', 'completada'])
      .order('hora_inicio', { ascending: true });

    if (error) throw error;

    const formatted = tutorias.map(t => ({
      id: t.id,
      fecha: t.fecha,
      hora_inicio: t.hora_inicio,
      hora_fin: t.hora_fin,
      estado: t.estado,
      estudiante_id: t.matriculas?.estudiante_id,
      estudiante_nombre: t.matriculas?.estudiantes?.nombre,
      tutor_id: t.matriculas?.tutor_id,
      tutor_nombre: t.matriculas?.tutores?.nombre,
      curso_nombre: t.matriculas?.cursos?.nombre,
      tarifa_por_hora: t.matriculas?.tutores?.tarifa_por_hora
    }));

    res.json(formatted);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET - Dashboard: Resumen de tutorías por tutor
router.get('/resumen-tutores/:fecha', async (req, res) => {
  try {
    const { fecha } = req.params;
    
    // Obtener todos los tutores activos
    const { data: tutores, error: tutoresError } = await supabase
      .from('tutores')
      .select('id, nombre')
      .eq('estado', true);
    
    if (tutoresError) throw tutoresError;
    
    // Para cada tutor, contar sus clases del día
    const resumen = await Promise.all(tutores.map(async (tutor) => {
      const { data: clases, error: clasesError } = await supabase
        .from('clases')
        .select(`
          id,
          matriculas!inner (
            tutor_id,
            cursos (nombre),
            estudiantes (nombre)
          )
        `)
        .eq('matriculas.tutor_id', tutor.id)
        .eq('fecha', fecha);
      
      if (clasesError) throw clasesError;
      
      const cursosUnicos = [...new Set(clases.map(c => c.matriculas?.cursos?.nombre).filter(Boolean))];
      const estudiantesUnicos = [...new Set(clases.map(c => c.matriculas?.estudiantes?.nombre).filter(Boolean))];
      
      return {
        id: tutor.id,
        nombre: tutor.nombre,
        total_clases: clases.length,
        cursos: cursosUnicos.join(', '),
        estudiantes: estudiantesUnicos.join(', ')
      };
    }));
    
    res.json(resumen.sort((a, b) => b.total_clases - a.total_clases));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET - Estadísticas generales
router.get('/estadisticas/general', async (req, res) => {
  try {
    const [tutoresRes, estudiantesRes, cursosRes, matriculasRes, clasesRes, pagosRes] = await Promise.all([
      supabase.from('tutores').select('id', { count: 'exact', head: true }).eq('estado', true),
      supabase.from('estudiantes').select('id', { count: 'exact', head: true }).eq('estado', true),
      supabase.from('cursos').select('id', { count: 'exact', head: true }).eq('estado', true),
      supabase.from('matriculas').select('id', { count: 'exact', head: true }).eq('estado', true),
      supabase.from('clases').select('id', { count: 'exact', head: true }),
      supabase.from('pagos').select('monto').eq('estado', 'pendiente')
    ]);

    const ingresos_pendientes = pagosRes.data?.reduce((sum, p) => sum + (p.monto || 0), 0) || 0;

    res.json({
      tutores: tutoresRes.count || 0,
      estudiantes: estudiantesRes.count || 0,
      cursos: cursosRes.count || 0,
      matriculas: matriculasRes.count || 0,
      clases_totales: clasesRes.count || 0,
      ingresos_pendientes
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;

