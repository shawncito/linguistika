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
// IMPORTANTE: Las sesiones SOLO salen de matrículas activas
router.get('/tutorias/:fecha', async (req, res) => {
  try {
    const { fecha } = req.params;

    // 1) Intentar obtener sesiones desde la tabla 'clases' (solo si ya fueron persistidas)
    const { data: tutorias, error } = await supabase
      .from('clases')
      .select(`
        id,
        fecha,
        hora_inicio,
        hora_fin,
        estado,
        matricula_id,
        matriculas!inner (
          id,
          estudiante_id,
          tutor_id,
          curso_id,
          estado,
          estudiantes (id, nombre),
          tutores (id, nombre),
          cursos (nombre)
        )
      `)
      .eq('fecha', fecha)
      .eq('matriculas.estado', true)
      .in('estado', ['programada', 'completada'])
      .order('hora_inicio', { ascending: true });

    if (error) throw error;

    let formatted = (tutorias || []).map(t => ({
      id: t.id,
      fecha: t.fecha,
      hora_inicio: t.hora_inicio,
      hora_fin: t.hora_fin,
      estado: t.estado,
      matricula_id: t.matricula_id || t.matriculas?.id,
      estudiante_id: t.matriculas?.estudiante_id,
      estudiante_nombre: t.matriculas?.estudiantes?.nombre,
      tutor_id: t.matriculas?.tutor_id,
      tutor_nombre: t.matriculas?.tutores?.nombre,
      curso_nombre: t.matriculas?.cursos?.nombre,
      turno: null,
      duracion_horas: null
    }));

    // 2) Fallback: si no hay registros en 'clases', calcular sesiones desde MATRÍCULAS ACTIVAS + horarios del curso
    // Solo aparecen sesiones si existe una matrícula activa (estado=true)
    if (!formatted || formatted.length === 0) {
      // Obtener día de la semana en español para 'fecha'
      const dias = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
      const date = new Date(fecha + 'T00:00:00');
      const diaSemana = dias[date.getDay()];

      // Obtener SOLO matrículas activas (estado = true)
      const { data: matriculasActivas, error: mErr } = await supabase
        .from('matriculas')
        .select(`
          id,
          estudiante_id,
          tutor_id,
          curso_id,
          estudiantes:estudiante_id (nombre),
          tutores:tutor_id (nombre),
          cursos:curso_id (nombre, dias_turno, dias_schedule)
        `)
        .eq('estado', true);

      if (mErr) throw mErr;

      const sesiones = [];
      // Para cada matrícula activa, verificar si el curso tiene clase en el día solicitado
      for (const m of (matriculasActivas || [])) {
        const curso = m.cursos;
        let diasScheduleObj = null;
        let diasTurnoObj = null;
        try { diasScheduleObj = curso?.dias_schedule ? JSON.parse(curso.dias_schedule) : null; } catch { diasScheduleObj = null; }
        try { diasTurnoObj = curso?.dias_turno ? JSON.parse(curso.dias_turno) : null; } catch { diasTurnoObj = null; }

        // Verificar si el curso tiene horario definido para este día de la semana
        if (diasScheduleObj && diasScheduleObj[diaSemana]) {
          const sch = diasScheduleObj[diaSemana];
          const dur = (() => {
            try {
              const [hi, mi] = String(sch.hora_inicio).split(':').map(Number);
              const [hf, mf] = String(sch.hora_fin).split(':').map(Number);
              const min = (hf * 60 + mf) - (hi * 60 + mi);
              return parseFloat((min / 60).toFixed(2));
            } catch { return null; }
          })();

          sesiones.push({
            id: null,
            fecha,
            hora_inicio: sch.hora_inicio || '—',
            hora_fin: sch.hora_fin || '—',
            estado: 'programada',
            matricula_id: m.id,
            estudiante_id: m.estudiante_id,
            estudiante_nombre: m.estudiantes?.nombre,
            tutor_id: m.tutor_id,
            tutor_nombre: m.tutores?.nombre,
            curso_nombre: curso?.nombre,
            turno: sch.turno || null,
            duracion_horas: dur
          });
        } else if (diasTurnoObj && diasTurnoObj[diaSemana]) {
          // Fallback solo con turno
          const turno = diasTurnoObj[diaSemana];
          sesiones.push({
            id: null,
            fecha,
            hora_inicio: '—',
            hora_fin: '—',
            estado: 'programada',
            matricula_id: m.id,
            estudiante_id: m.estudiante_id,
            estudiante_nombre: m.estudiantes?.nombre,
            tutor_id: m.tutor_id,
            tutor_nombre: m.tutores?.nombre,
            curso_nombre: curso?.nombre,
            turno,
            duracion_horas: null
          });
        }
      }

      // Ordenar por hora de inicio cuando esté disponible
      sesiones.sort((a, b) => String(a.hora_inicio).localeCompare(String(b.hora_inicio)));
      formatted = sesiones;
    }

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

// DEBUG (SIN AUTENTICACIÓN): Ver qué cursos tienen las matrículas activas
router.get('/debug/matriculas-cursos', async (req, res) => {
  try {
    const { data: matriculas, error: mErr } = await supabase
      .from('matriculas')
      .select(`
        id,
        estudiante_id,
        curso_id,
        estado,
        estudiantes:estudiante_id (nombre),
        cursos:curso_id (id, nombre, estado, dias_schedule)
      `)
      .eq('estado', true);

    if (mErr) throw mErr;

    const debug = matriculas.map(m => ({
      matricula_id: m.id,
      estudiante: m.estudiantes?.nombre,
      curso_id: m.curso_id,
      curso_nombre: m.cursos?.nombre,
      curso_estado: m.cursos?.estado ? 'ACTIVO' : 'INACTIVO',
      tiene_dias_schedule: !!m.cursos?.dias_schedule
    }));

    res.json(debug);
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

// POST - Marcar sesión como dada (completar) y generar movimientos
router.post('/sesion/:matriculaId/:fecha/completar', async (req, res) => {
  try {
    const { matriculaId, fecha } = req.params;
    // Obtener matrícula y curso con costos y horarios
    const { data: m, error: mErr } = await supabase
      .from('matriculas')
      .select(`
        id, estudiante_id, tutor_id, curso_id,
        cursos:curso_id (nombre, costo_curso, pago_tutor, dias_schedule),
        estudiantes:estudiante_id (nombre),
        tutores:tutor_id (nombre)
      `)
      .eq('id', matriculaId)
      .single();
    if (mErr || !m) return res.status(404).json({ error: 'Matrícula no encontrada' });

    // Día de la semana
    const dias = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    const date = new Date(fecha + 'T00:00:00');
    const dia_semana = dias[date.getDay()];

    // Horario del curso para ese día
    let schedule = null;
    try { schedule = m.cursos?.dias_schedule ? JSON.parse(m.cursos.dias_schedule)[dia_semana] : null; } catch { schedule = null; }
    if (!schedule || !schedule.hora_inicio || !schedule.hora_fin) {
      return res.status(400).json({ error: 'El curso no tiene horas definidas para este día' });
    }
    const duracion_horas = (() => {
      try {
        const [hi, mi] = String(schedule.hora_inicio).split(':').map(Number);
        const [hf, mf] = String(schedule.hora_fin).split(':').map(Number);
        const min = (hf * 60 + mf) - (hi * 60 + mi);
        return parseFloat((min / 60).toFixed(2));
      } catch { return 0; }
    })();

    // Insertar sesión como "dada"
    const { data: sesion, error: sErr } = await supabase
      .from('sesiones_clases')
      .insert({
        curso_id: m.curso_id,
        tutor_id: m.tutor_id,
        fecha,
        dia_semana,
        hora_inicio: String(schedule.hora_inicio).length === 5 ? `${schedule.hora_inicio}:00` : schedule.hora_inicio,
        hora_fin: String(schedule.hora_fin).length === 5 ? `${schedule.hora_fin}:00` : schedule.hora_fin,
        duracion_horas,
        estado: 'dada',
        notas: null
      })
      .select()
      .single();
    if (sErr) throw sErr;

    // Generar movimientos: ingreso del estudiante y pago al tutor (pendiente)
    const ingreso = {
      curso_id: m.curso_id,
      matricula_id: m.id,
      tutor_id: m.tutor_id,
      sesion_id: sesion.id,
      tipo: 'ingreso_estudiante',
      monto: parseFloat(m.cursos?.costo_curso || 0),
      factura_numero: null,
      fecha_pago: fecha,
      fecha_comprobante: null,
      estado: 'pendiente',
      notas: `Ingreso por sesión completada (${m.cursos?.nombre})`
    };
    const pagoPendiente = {
      curso_id: m.curso_id,
      matricula_id: m.id,
      tutor_id: m.tutor_id,
      sesion_id: sesion.id,
      tipo: 'pago_tutor_pendiente',
      monto: parseFloat(m.cursos?.pago_tutor || 0),
      factura_numero: null,
      fecha_pago: fecha,
      fecha_comprobante: null,
      estado: 'pendiente',
      notas: `Pago a tutor pendiente por sesión (${m.tutores?.nombre})`
    };

    const { error: movErr1 } = await supabase.from('movimientos_dinero').insert(ingreso);
    if (movErr1) throw movErr1;
    const { error: movErr2 } = await supabase.from('movimientos_dinero').insert(pagoPendiente);
    if (movErr2) throw movErr2;

    res.json({ message: 'Sesión marcada como dada y movimientos generados', sesion_id: sesion.id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST - Cancelar sesión solo para el día
router.post('/sesion/:matriculaId/:fecha/cancelar-dia', async (req, res) => {
  try {
    const { matriculaId, fecha } = req.params;
    const { data: m, error: mErr } = await supabase
      .from('matriculas')
      .select(`
        id, tutor_id, curso_id,
        cursos:curso_id (nombre, dias_schedule)
      `)
      .eq('id', matriculaId)
      .single();
    if (mErr || !m) return res.status(404).json({ error: 'Matrícula no encontrada' });

    const dias = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    const date = new Date(fecha + 'T00:00:00');
    const dia_semana = dias[date.getDay()];

    let schedule = null;
    try { schedule = m.cursos?.dias_schedule ? JSON.parse(m.cursos.dias_schedule)[dia_semana] : null; } catch { schedule = null; }

    const hora_inicio_base = schedule?.hora_inicio || '00:00:00';
    const hora_fin_base = schedule?.hora_fin || '00:00:00';
    const hora_inicio = String(hora_inicio_base).length === 5 ? `${hora_inicio_base}:00` : hora_inicio_base;
    const hora_fin = String(hora_fin_base).length === 5 ? `${hora_fin_base}:00` : hora_fin_base;
    const duracion_horas = (() => {
      try {
        const [hi, mi] = String(hora_inicio).split(':').map(Number);
        const [hf, mf] = String(hora_fin).split(':').map(Number);
        const min = (hf * 60 + mf) - (hi * 60 + mi);
        return Math.max(0, parseFloat((min / 60).toFixed(2)));
      } catch { return 0; }
    })();

    const { error: sErr } = await supabase
      .from('sesiones_clases')
      .insert({
        curso_id: m.curso_id,
        tutor_id: m.tutor_id,
        fecha,
        dia_semana,
        hora_inicio,
        hora_fin,
        duracion_horas,
        estado: 'cancelada',
        notas: 'Cancelada por el usuario'
      });
    if (sErr) throw sErr;

    res.json({ message: 'Sesión cancelada para el día' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST - Cancelar sesiones de una matrícula de forma permanente
router.post('/sesion/:matriculaId/cancelar-permanente', async (req, res) => {
  try {
    const { matriculaId } = req.params;
    const { error } = await supabase
      .from('matriculas')
      .update({ estado: false, updated_at: new Date().toISOString() })
      .eq('id', matriculaId);
    if (error) throw error;
    res.json({ message: 'Matrícula cancelada permanentemente' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;


