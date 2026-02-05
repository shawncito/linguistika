import express from 'express';
import { supabase } from '../supabase.js';
import { requireRoles } from '../middleware/roles.js';

const router = express.Router();

const isValidYYYYMM = (value) => typeof value === 'string' && /^\d{4}-\d{2}$/.test(value);

const monthRange = (ym) => {
  const [yStr, mStr] = String(ym).split('-');
  const y = Number(yStr);
  const m = Number(mStr);
  if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) return null;
  const start = `${yStr}-${mStr}-01`;
  const lastDay = new Date(y, m, 0).getDate();
  const end = `${yStr}-${mStr}-${String(lastDay).padStart(2, '0')}`;
  return { start, end };
};

const addMonths = (ym, delta) => {
  const [yStr, mStr] = String(ym).split('-');
  const y = Number(yStr);
  const m = Number(mStr);
  if (!Number.isFinite(y) || !Number.isFinite(m)) return null;
  const d = new Date(Date.UTC(y, m - 1, 1));
  d.setUTCMonth(d.getUTCMonth() + delta);
  const yy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${yy}-${mm}`;
};

const movementFlags = (tipoRaw) => {
  const tipo = String(tipoRaw || '');
  const isIngreso = tipo === 'ingreso_estudiante' || tipo.startsWith('ingreso_');
  const isEgreso = tipo === 'pago_tutor_pendiente' || tipo === 'pago_tutor' || tipo.startsWith('pago_') || tipo.startsWith('egreso_');
  return { isIngreso, isEgreso };
};

// GET - Dashboard: Obtener tutorías del día (ruta con acento)
router.get('/tutorías/:fecha', async (req, res) => {
  try {
    const { fecha } = req.params;

    // Excluir sesiones que ya fueron marcadas como dadas/canceladas en sesiones_clases
    const { data: sesionesBloqueadas, error: sbErr } = await supabase
      .from('sesiones_clases')
      .select('matricula_id, estado')
      .eq('fecha', fecha)
      .in('estado', ['dada', 'cancelada']);
    if (sbErr) throw sbErr;
    const bloqueadasSet = new Set((sesionesBloqueadas || []).map((r) => r.matricula_id));
    
    const { data: tutorías, error } = await supabase
      .from('clases')
      .select(`
        id,
        fecha,
        hora_inicio,
        hora_fin,
        estado,
        matriculas!inner (
          id,
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
    
    const formatted = tutorías
      .map(t => ({
      id: t.id,
      fecha: t.fecha,
      hora_inicio: t.hora_inicio,
      hora_fin: t.hora_fin,
      estado: t.estado,
      matricula_id: t.matriculas?.id,
      estudiante_id: t.matriculas?.estudiante_id,
      estudiante_nombre: t.matriculas?.estudiantes?.nombre,
      tutor_id: t.matriculas?.tutor_id,
      tutor_nombre: t.matriculas?.tutores?.nombre,
      curso_nombre: t.matriculas?.cursos?.nombre,
      tarifa_por_hora: t.matriculas?.tutores?.tarifa_por_hora
    }))
      .filter((t) => {
        return !t?.matricula_id || !bloqueadasSet.has(t.matricula_id);
      });
    
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

    // Excluir sesiones que ya fueron marcadas como dadas/canceladas en sesiones_clases
    const { data: sesionesBloqueadas, error: sbErr } = await supabase
      .from('sesiones_clases')
      .select('matricula_id, estado')
      .eq('fecha', fecha)
      .in('estado', ['dada', 'cancelada']);
    if (sbErr) throw sbErr;
    const bloqueadasSet = new Set((sesionesBloqueadas || []).map((r) => r.matricula_id));

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
    })).filter((t) => !t?.matricula_id || !bloqueadasSet.has(t.matricula_id));

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
        if (bloqueadasSet.has(m.id)) continue;
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

// GET - Resumen por tutor: conteo de estudiantes activos
router.get('/resumen-tutores-estudiantes', async (_req, res) => {
  try {
    const { data: matriculas, error } = await supabase
      .from('matriculas')
      .select('tutor_id, estudiante_id')
      .eq('estado', true);
    if (error) throw error;

    const { data: tutores, error: tErr } = await supabase
      .from('tutores')
      .select('id, nombre')
      .eq('estado', true);
    if (tErr) throw tErr;

    const mapa = new Map();
    for (const m of matriculas || []) {
      const key = m.tutor_id;
      if (!mapa.has(key)) mapa.set(key, new Set());
      mapa.get(key).add(m.estudiante_id);
    }

    const resultado = (tutores || []).map(t => ({
      tutor_id: t.id,
      tutor_nombre: t.nombre,
      total_estudiantes: mapa.get(t.id)?.size || 0
    })).sort((a, b) => b.total_estudiantes - a.total_estudiantes);

    res.json(resultado);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET - Resumen por curso: conteo de estudiantes y grupos
router.get('/resumen-cursos-grupos', async (_req, res) => {
  try {
    const { data: matriculas, error } = await supabase
      .from('matriculas')
      .select('curso_id, estudiante_id, grupo_id, es_grupo, grupo_nombre')
      .eq('estado', true);
    if (error) throw error;

    const { data: cursos, error: cErr } = await supabase
      .from('cursos')
      .select('id, nombre, grado_activo, grado_nombre, grado_color, tipo_clase, max_estudiantes')
      .eq('estado', true);
    if (cErr) throw cErr;

    const resultado = (cursos || []).map(curso => {
      const mats = (matriculas || []).filter(m => m.curso_id === curso.id);
      const estudiantesSet = new Set(mats.map(m => m.estudiante_id));
      const gruposSet = new Set(mats.filter(m => m.es_grupo).map(m => m.grupo_id));
      return {
        curso_id: curso.id,
        curso_nombre: curso.nombre,
        grado_activo: curso.grado_activo,
        grado_nombre: curso.grado_nombre,
        grado_color: curso.grado_color,
        tipo_clase: curso.tipo_clase,
        max_estudiantes: curso.max_estudiantes,
        total_estudiantes: estudiantesSet.size,
        total_grupos: gruposSet.size,
      };
    }).sort((a, b) => b.total_estudiantes - a.total_estudiantes);

    res.json(resultado);
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

// GET - Métricas financieras (admin/contador)
// Query: mes=YYYY-MM&tutor_id?
router.get('/metricas', requireRoles(['admin', 'contador']), async (req, res) => {
  try {
    const mes = isValidYYYYMM(req.query.mes)
      ? String(req.query.mes)
      : new Date().toLocaleDateString('en-CA', { timeZone: 'America/Costa_Rica' }).slice(0, 7);

    const tutorIdRaw = req.query.tutor_id;
    const tutorId = tutorIdRaw ? Number.parseInt(String(tutorIdRaw), 10) : null;
    const tutorIdValid = Number.isFinite(tutorId) && tutorId > 0 ? tutorId : null;

    const range = monthRange(mes);
    if (!range) return res.status(400).json({ error: 'mes inválido. Usa YYYY-MM' });

    const start6Mes = addMonths(mes, -5);
    const range6 = start6Mes ? monthRange(start6Mes) : null;
    const start6 = range6?.start ?? range.start;
    const end = range.end;

    let q = supabase
      .from('movimientos_dinero')
      .select('id, tipo, monto, fecha_pago, tutor_id, tutor:tutor_id (nombre)')
      .gte('fecha_pago', start6)
      .lte('fecha_pago', end)
      .order('fecha_pago', { ascending: true })
      .order('id', { ascending: true });

    if (tutorIdValid) q = q.eq('tutor_id', tutorIdValid);

    const { data, error } = await q;
    if (error) throw error;

    const seriesMap = new Map();
    const topTutorMap = new Map();

    let ingresosMes = 0;
    let egresosMes = 0;
    let movimientosMes = 0;

    for (const row of (data || [])) {
      const fechaPago = String(row?.fecha_pago || '');
      const ym = fechaPago ? fechaPago.slice(0, 7) : null;
      const monto = Number(row?.monto) || 0;
      const { isIngreso, isEgreso } = movementFlags(row?.tipo);

      if (ym) {
        const entry = seriesMap.get(ym) || { mes: ym, ingresos: 0, egresos: 0, neto: 0 };
        if (isIngreso) entry.ingresos += monto;
        if (isEgreso) entry.egresos += monto;
        entry.neto = entry.ingresos - entry.egresos;
        seriesMap.set(ym, entry);
      }

      if (ym === mes) {
        movimientosMes += 1;
        if (isIngreso) ingresosMes += monto;
        if (isEgreso) {
          egresosMes += monto;
          const tid = row?.tutor_id ? Number(row.tutor_id) : null;
          if (tid) {
            const prev = topTutorMap.get(tid) || { tutor_id: tid, tutor_nombre: row?.tutor?.nombre || '', total: 0 };
            prev.total += monto;
            if (!prev.tutor_nombre && row?.tutor?.nombre) prev.tutor_nombre = row.tutor.nombre;
            topTutorMap.set(tid, prev);
          }
        }
      }
    }

    // Asegurar que la serie incluya exactamente los últimos 6 meses (incluye meses sin movimientos)
    const months = [];
    for (let i = -5; i <= 0; i += 1) {
      const key = addMonths(mes, i);
      if (!key) continue;
      months.push(key);
      if (!seriesMap.has(key)) seriesMap.set(key, { mes: key, ingresos: 0, egresos: 0, neto: 0 });
    }

    const series = months.map((m) => seriesMap.get(m));
    const top_tutores = Array.from(topTutorMap.values())
      .sort((a, b) => (Number(b.total) || 0) - (Number(a.total) || 0))
      .slice(0, 5);

    return res.json({
      mes,
      fecha_inicio: range.start,
      fecha_fin: range.end,
      ingresos: ingresosMes,
      pagos_tutores: egresosMes,
      neto: ingresosMes - egresosMes,
      movimientos: movimientosMes,
      tutor_id: tutorIdValid,
      series,
      top_tutores,
      fuente: 'movimientos_dinero',
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
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
        cursos:curso_id (nombre, tipo_pago, costo_curso, pago_tutor, dias_schedule),
        estudiantes:estudiante_id (nombre),
        tutores:tutor_id (nombre)
      `)
      .eq('id', matriculaId)
      .single();
    if (mErr || !m) return res.status(404).json({ error: 'Matrícula no encontrada' });

    // Idempotencia: si ya existe una sesión dada/cancelada para esta matrícula y fecha, no duplicar
    const { data: existingRows, error: exErr } = await supabase
      .from('sesiones_clases')
      .select('id, estado')
      .eq('matricula_id', m.id)
      .eq('fecha', fecha)
      .in('estado', ['dada', 'cancelada'])
      .order('id', { ascending: false })
      .limit(1);
    if (exErr) throw exErr;

    const existing = (existingRows && existingRows.length > 0) ? existingRows[0] : null;
    if (existing) {
      if (existing.estado === 'cancelada') {
        return res.status(409).json({ error: 'Esta sesión ya fue cancelada para el día. No se puede marcar como dada.', sesion_id: existing.id });
      }

      // Si es mensual, nunca generamos movimientos aquí
      const tipoPago = String(m.cursos?.tipo_pago || 'sesion');
      if (tipoPago === 'mensual') {
        return res.json({ message: 'Sesión ya estaba marcada como dada (curso mensual).', sesion_id: existing.id, already_completed: true });
      }

      // Verificar/crear movimientos faltantes para esta sesión (por si hubo retry tras error)
      const tipos = ['ingreso_estudiante', 'pago_tutor_pendiente'];
      const { data: movs, error: movSelErr } = await supabase
        .from('movimientos_dinero')
        .select('id, tipo')
        .eq('sesion_id', existing.id)
        .in('tipo', tipos);
      if (movSelErr) throw movSelErr;

      const existentes = new Set((movs || []).map((x) => x.tipo));
      const inserts = [];
      if (!existentes.has('ingreso_estudiante')) {
        inserts.push({
          curso_id: m.curso_id,
          matricula_id: m.id,
          tutor_id: m.tutor_id,
          sesion_id: existing.id,
          tipo: 'ingreso_estudiante',
          monto: parseFloat(m.cursos?.costo_curso || 0),
          factura_numero: null,
          fecha_pago: fecha,
          fecha_comprobante: null,
          estado: 'pendiente',
          notas: `Ingreso por sesión completada (${m.cursos?.nombre})`
        });
      }
      if (!existentes.has('pago_tutor_pendiente')) {
        inserts.push({
          curso_id: m.curso_id,
          matricula_id: m.id,
          tutor_id: m.tutor_id,
          sesion_id: existing.id,
          tipo: 'pago_tutor_pendiente',
          monto: parseFloat(m.cursos?.pago_tutor || 0),
          factura_numero: null,
          fecha_pago: fecha,
          fecha_comprobante: null,
          estado: 'pendiente',
          notas: `Pago a tutor pendiente por sesión (${m.tutores?.nombre})`
        });
      }
      if (inserts.length > 0) {
        const { error: movInsErr } = await supabase.from('movimientos_dinero').insert(inserts);
        if (movInsErr) throw movInsErr;
      }

      return res.json({ message: 'Sesión ya estaba marcada como dada. No se duplicaron cobros.', sesion_id: existing.id, already_completed: true });
    }

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
        matricula_id: m.id,
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

    // Generar movimientos SOLO si el curso es por sesion.
    // Si el curso es mensual, el cobro/pago se genera en el cierre mensual.
    const tipoPago = String(m.cursos?.tipo_pago || 'sesion');
    if (tipoPago === 'mensual') {
      return res.json({ message: 'Sesión marcada como dada (curso mensual). Movimientos se generan en cierre mensual.', sesion_id: sesion.id });
    }

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

    const { error: movErr } = await supabase.from('movimientos_dinero').insert([ingreso, pagoPendiente]);
    if (movErr) throw movErr;

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
        matricula_id: m.id,
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

// PATCH - Actualizar estado de sesión (avisado, confirmado, motivo)
router.patch('/sesion/:matriculaId/:fecha/estado', async (req, res) => {
  try {
    const { matriculaId, fecha } = req.params;
    const { avisado, confirmado, motivo_cancelacion } = req.body;

    const updateData = { updated_at: new Date().toISOString() };
    if (avisado !== undefined) updateData.avisado = avisado;
    if (confirmado !== undefined) updateData.confirmado = confirmado;
    if (motivo_cancelacion !== undefined) updateData.motivo_cancelacion = motivo_cancelacion;

    // Buscar la clase asociada a la matrícula en esa fecha
    const { data: clases, error: selectError } = await supabase
      .from('clases')
      .select('id')
      .eq('matricula_id', matriculaId)
      .eq('fecha', fecha)
      .limit(1);

    if (selectError) throw selectError;

    let claseId = clases && clases.length > 0 ? clases[0].id : null;

    // Si no existe, crear la clase usando el horario del curso para ese día
    if (!claseId) {
      const { data: m, error: mErr } = await supabase
        .from('matriculas')
        .select(`
          id, curso_id, estudiante_id, tutor_id,
          cursos:curso_id (dias_schedule)
        `)
        .eq('id', matriculaId)
        .single();

      if (mErr || !m) return res.status(404).json({ error: 'Matrícula no encontrada' });

      const dias = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
      const diaSemana = dias[new Date(fecha + 'T00:00:00').getDay()];

      let schedule = null;
      try { schedule = m.cursos?.dias_schedule ? JSON.parse(m.cursos.dias_schedule)[diaSemana] : null; } catch { schedule = null; }

      if (!schedule || !schedule.hora_inicio || !schedule.hora_fin) {
        return res.status(400).json({ error: 'No se puede crear la sesión: el curso no tiene horario definido para ese día' });
      }

      const hora_inicio = String(schedule.hora_inicio).length === 5 ? `${schedule.hora_inicio}:00` : schedule.hora_inicio;
      const hora_fin = String(schedule.hora_fin).length === 5 ? `${schedule.hora_fin}:00` : schedule.hora_fin;
      const duracion_horas = (() => {
        try {
          const [hi, mi] = String(hora_inicio).split(':').map(Number);
          const [hf, mf] = String(hora_fin).split(':').map(Number);
          const min = (hf * 60 + mf) - (hi * 60 + mi);
          return Math.max(0, parseFloat((min / 60).toFixed(2)));
        } catch { return 0; }
      })();

      const { data: nuevaClase, error: insertError } = await supabase
        .from('clases')
        .insert({
          matricula_id: m.id,
          fecha,
          hora_inicio,
          hora_fin,
          duracion_horas,
          estado: 'programada',
          created_by: req.user?.id || null,
          avisado: avisado ?? null,
          confirmado: confirmado ?? null,
          motivo_cancelacion: motivo_cancelacion ?? null
        })
        .select('id')
        .single();

      if (insertError) throw insertError;
      claseId = nuevaClase.id;
    }

    const { error: updateError } = await supabase
      .from('clases')
      .update(updateData)
      .eq('id', claseId);

    if (updateError) throw updateError;
    res.json({ message: 'Estado actualizado', sesion_id: claseId });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET estados de clases para una fecha
router.get('/estados-clases/:fecha', async (req, res) => {
  try {
    const { fecha } = req.params;
    
    const { data: clases, error } = await supabase
      .from('clases')
      .select('id, matricula_id, fecha, avisado, confirmado, motivo_cancelacion')
      .eq('fecha', fecha);
    
    if (error) throw error;
    
    res.json(clases || []);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;


