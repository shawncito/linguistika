import express from 'express';
import { supabase, supabaseAdmin, supabaseForToken } from '../supabase.js';
import { requireRoles } from '../middleware/roles.js';
import { getOrCreateEncargadoId } from '../utils/encargados.js';
import { schemaErrorPayload } from '../utils/schemaErrors.js';

const router = express.Router();

function sendSchemaError(res, error) {
  const payload = schemaErrorPayload(error);
  if (payload) return res.status(400).json(payload);
  return res.status(500).json({ error: error.message });
}

const isValidYYYYMM = (value) => typeof value === 'string' && /^\d{4}-\d{2}$/.test(value);

const normalizeTimeToHHMMSS = (value) => {
  if (value === null || value === undefined) return null;
  const str = String(value).trim();
  const match = str.match(/^(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?$/);
  if (!match) return null;

  const h = Number(match[1]);
  const m = Number(match[2]);
  const s = match[3] !== undefined ? Number(match[3]) : 0;
  if (![h, m, s].every(Number.isFinite)) return null;
  if (h < 0 || h > 23) return null;
  if (m < 0 || m > 59) return null;
  if (s < 0 || s > 59) return null;

  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

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

const isRealIngresoTipo = (tipoRaw) => {
  // "Real" debe provenir de registros manuales/tesorería, no de marcar sesiones como dadas.
  // Por eso excluimos ingreso_estudiante incluso si está completado.
  const tipo = String(tipoRaw || '');
  return tipo.startsWith('ingreso_') && tipo !== 'ingreso_estudiante';
};

const isEsperadoTipo = (tipoRaw) => {
  // "Esperado" = lo generado por sesiones dadas que aún no se ha conciliado.
  const tipo = String(tipoRaw || '');
  return tipo === 'ingreso_estudiante' || tipo === 'pago_tutor_pendiente';
};

const normalizeEstado = (estadoRaw) => {
  // Historicamente algunos movimientos pueden venir con estado null.
  // Para no romper reportes, tratamos null/undefined como completado.
  const s = String(estadoRaw ?? 'completado').trim().toLowerCase();
  return s || 'completado';
};

const isRealEstado = (estadoRaw) => {
  const s = normalizeEstado(estadoRaw);
  return s === 'completado' || s === 'verificado';
};

const diasSemanaES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

const safeJsonParse = (value) => {
  try {
    if (value === null || value === undefined) return null;
    if (typeof value === 'object') return value;
    const str = String(value);
    if (!str.trim()) return null;
    return JSON.parse(str);
  } catch {
    return null;
  }
};

const calcDuracionHoras = (horaInicio, horaFin) => {
  try {
    const [hi, mi] = String(horaInicio).split(':').map(Number);
    const [hf, mf] = String(horaFin).split(':').map(Number);
    if (![hi, mi, hf, mf].every(Number.isFinite)) return null;
    const min = (hf * 60 + mf) - (hi * 60 + mi);
    if (!Number.isFinite(min) || min <= 0) return null;
    return parseFloat((min / 60).toFixed(2));
  } catch {
    return null;
  }
};

async function buildTutoriasMerged({ fecha, bloqueadasSet }) {
  const date = new Date(fecha + 'T00:00:00');
  const diaSemana = diasSemanaES[date.getDay()];

  // 1) Sesiones persistidas en 'clases' (si existen)
  const { data: clasesRaw, error: clasesErr } = await supabase
    .from('clases')
    .select(`
      id,
      fecha,
      hora_inicio,
      hora_fin,
      estado,
      avisado,
      confirmado,
      motivo_cancelacion,
      matricula_id,
      matriculas!inner (
        id,
        estudiante_id,
        tutor_id,
        curso_id,
        estado,
        estudiantes (id, nombre),
        tutores (id, nombre),
        cursos (nombre, tipo_pago, dias_turno, dias_schedule)
      )
    `)
    .eq('fecha', fecha)
    .eq('matriculas.estado', true)
    .in('estado', ['programada', 'completada'])
    .order('hora_inicio', { ascending: true });

  if (clasesErr) throw clasesErr;

  const clases = (clasesRaw || [])
    .map((t) => ({
      id: t.id,
      fecha: t.fecha,
      hora_inicio: t.hora_inicio,
      hora_fin: t.hora_fin,
      estado: t.estado,
      avisado: Boolean(t.avisado),
      confirmado: Boolean(t.confirmado),
      motivo_cancelacion: t.motivo_cancelacion ?? null,
      matricula_id: t.matricula_id || t.matriculas?.id,
      estudiante_id: t.matriculas?.estudiante_id,
      estudiante_nombre: t.matriculas?.estudiantes?.nombre,
      tutor_id: t.matriculas?.tutor_id,
      tutor_nombre: t.matriculas?.tutores?.nombre,
      curso_nombre: t.matriculas?.cursos?.nombre,
      curso_tipo_pago: t.matriculas?.cursos?.tipo_pago ?? null,
      turno: null,
      duracion_horas: null,
      _source: 'clases',
      _curso: t.matriculas?.cursos ?? null,
    }))
    .filter((t) => !t?.matricula_id || !bloqueadasSet.has(t.matricula_id));

  const clasesByMatricula = new Map();
  for (const c of clases) {
    if (!c.matricula_id) continue;
    // Asumimos 1 clase por matrícula por día; si hay varias, se queda la primera por orden
    if (!clasesByMatricula.has(c.matricula_id)) clasesByMatricula.set(c.matricula_id, c);
  }

  // 2) Sesiones calculadas desde matrículas activas + dias_schedule (SIEMPRE)
  const { data: matriculasActivas, error: mErr } = await supabase
    .from('matriculas')
    .select(`
      id,
      estudiante_id,
      tutor_id,
      curso_id,
      estudiantes:estudiante_id (nombre),
      tutores:tutor_id (nombre),
      cursos:curso_id (nombre, tipo_pago, dias_turno, dias_schedule)
    `)
    .eq('estado', true);
  if (mErr) throw mErr;

  const computed = [];
  for (const m of matriculasActivas || []) {
    if (bloqueadasSet.has(m.id)) continue;
    const curso = m.cursos;
    const diasScheduleObj = safeJsonParse(curso?.dias_schedule);
    const diasTurnoObj = safeJsonParse(curso?.dias_turno);

    if (diasScheduleObj && diasScheduleObj[diaSemana]) {
      const sch = diasScheduleObj[diaSemana];
      computed.push({
        id: null,
        fecha,
        hora_inicio: sch.hora_inicio || '—',
        hora_fin: sch.hora_fin || '—',
        estado: 'programada',
        avisado: false,
        confirmado: false,
        motivo_cancelacion: null,
        matricula_id: m.id,
        estudiante_id: m.estudiante_id,
        estudiante_nombre: m.estudiantes?.nombre,
        tutor_id: m.tutor_id,
        tutor_nombre: m.tutores?.nombre,
        curso_nombre: curso?.nombre,
        curso_tipo_pago: curso?.tipo_pago ?? null,
        turno: sch.turno || null,
        duracion_horas: calcDuracionHoras(sch.hora_inicio, sch.hora_fin),
        _source: 'computed',
      });
    } else if (diasTurnoObj && diasTurnoObj[diaSemana]) {
      computed.push({
        id: null,
        fecha,
        hora_inicio: '—',
        hora_fin: '—',
        estado: 'programada',
        avisado: false,
        confirmado: false,
        motivo_cancelacion: null,
        matricula_id: m.id,
        estudiante_id: m.estudiante_id,
        estudiante_nombre: m.estudiantes?.nombre,
        tutor_id: m.tutor_id,
        tutor_nombre: m.tutores?.nombre,
        curso_nombre: curso?.nombre,
        curso_tipo_pago: curso?.tipo_pago ?? null,
        turno: diasTurnoObj[diaSemana] || null,
        duracion_horas: null,
        _source: 'computed',
      });
    }
  }

  // 3) Merge: si existe en 'clases', la preferimos; si no, usamos computed.
  const seenMatriculas = new Set();
  const merged = [];

  for (const s of computed) {
    const mid = s.matricula_id;
    if (!mid) continue;
    const persisted = clasesByMatricula.get(mid);
    merged.push(persisted ? { ...s, ...persisted, _source: 'merged' } : s);
    seenMatriculas.add(mid);
  }

  // 4) Añadir clases persistidas que no estaban en computed (sesiones manuales/ad-hoc)
  for (const c of clases) {
    const mid = c.matricula_id;
    if (mid && seenMatriculas.has(mid)) continue;
    merged.push(c);
  }

  // Orden: por hora_inicio cuando exista
  const keyHora = (h) => {
    const s = String(h || '').trim();
    if (!s || s === '—') return '99:99:99';
    return s.length === 5 ? `${s}:00` : s;
  };

  merged.sort((a, b) => keyHora(a.hora_inicio).localeCompare(keyHora(b.hora_inicio)));
  return merged;
}

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
    
    const merged = await buildTutoriasMerged({ fecha, bloqueadasSet });
    res.json(merged);
  } catch (error) {
    return sendSchemaError(res, error);
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

    const merged = await buildTutoriasMerged({ fecha, bloqueadasSet });
    res.json(merged);
  } catch (error) {
    return sendSchemaError(res, error);
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
    return sendSchemaError(res, error);
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
    return sendSchemaError(res, error);
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
    return sendSchemaError(res, error);
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
    return sendSchemaError(res, error);
  }
});

// GET - Estadísticas generales
router.get('/estadisticas/general', async (req, res) => {
  try {
    const [tutoresRes, estudiantesRes, cursosRes, matriculasRes, clasesRes] = await Promise.all([
      supabase.from('tutores').select('id', { count: 'exact', head: true }).eq('estado', true),
      supabase.from('estudiantes').select('id', { count: 'exact', head: true }).eq('estado', true),
      supabase.from('cursos').select('id', { count: 'exact', head: true }).eq('estado', true),
      supabase.from('matriculas').select('id', { count: 'exact', head: true }).eq('estado', true),
      supabase.from('clases').select('id', { count: 'exact', head: true }),
    ]);

    const safeMsg = (err) => String(err?.message || '').toLowerCase();
    const isMissingV2 = (err) => {
      const msg = safeMsg(err);
      return msg.includes('does not exist') && msg.includes('tesoreria_');
    };

    let dinero_ingresado_total = 0;

    // Fuente principal: Tesorería v2 (pagos reales)
    // Definición: total de entradas completadas/verificadas (no neto).
    try {
      const { data: pagos, error: pErr } = await supabase
        .from('tesoreria_pagos')
        .select('direccion, monto, estado')
        .eq('direccion', 'entrada');
      if (pErr) throw pErr;

      dinero_ingresado_total = (pagos || []).reduce((sum, r) => {
        if (!isRealEstado(r?.estado)) return sum;
        return sum + (Number(r?.monto) || 0);
      }, 0);
    } catch (err) {
      // Fallback: esquema legacy (movimientos_dinero)
      if (!isMissingV2(err)) {
        throw err;
      }

      const { data: ingresos, error: iErr } = await supabase
        .from('movimientos_dinero')
        .select('tipo, monto, estado')
        .like('tipo', 'ingreso_%');
      if (iErr) throw iErr;

      dinero_ingresado_total = (ingresos || []).reduce((sum, r) => {
        if (!isRealEstado(r?.estado)) return sum;
        if (!isRealIngresoTipo(r?.tipo)) return sum;
        return sum + (Number(r?.monto) || 0);
      }, 0);
    }

    res.json({
      tutores: tutoresRes.count || 0,
      estudiantes: estudiantesRes.count || 0,
      cursos: cursosRes.count || 0,
      matriculas: matriculasRes.count || 0,
      clases_totales: clasesRes.count || 0,
      ingresos_pendientes: dinero_ingresado_total,
      dinero_ingresado_total
    });
  } catch (error) {
    return sendSchemaError(res, error);
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

    const safeMsg = (err) => String(err?.message || '').toLowerCase();
    const isMissingV2 = (err) => {
      const msg = safeMsg(err);
      return msg.includes('does not exist') && msg.includes('tesoreria_');
    };

    const computeV2 = async () => {
      // 1) Esperado: obligaciones pendientes por sesión
      let qo = supabase
        .from('tesoreria_obligaciones')
        .select('id, tipo, monto, fecha_devengo, estado, tutor_id')
        .gte('fecha_devengo', start6)
        .lte('fecha_devengo', end)
        .in('tipo', ['cobro_sesion', 'pago_tutor_sesion'])
        .order('fecha_devengo', { ascending: true })
        .order('id', { ascending: true });

      if (tutorIdValid) qo = qo.eq('tutor_id', tutorIdValid);

      const { data: obligs, error: oErr } = await qo;
      if (oErr) throw oErr;

      // 2) Real: pagos completados/verificados
      // - Global (sin tutor_id): sumamos directamente entradas/salidas desde tesoreria_pagos.
      // - Con tutor_id: 
      //   - ingresos reales se atribuyen por aplicaciones FIFO hacia obligaciones cobro_sesion con ese tutor.
      //   - egresos reales son pagos al tutor (salidas en la cuenta del tutor).
      let pagos = [];
      let pagosTutor = [];

      if (!tutorIdValid) {
        const { data: pRows, error: pErr } = await supabase
          .from('tesoreria_pagos')
          .select('id, cuenta_id, direccion, monto, fecha_pago, estado')
          .gte('fecha_pago', start6)
          .lte('fecha_pago', end)
          .order('fecha_pago', { ascending: true })
          .order('id', { ascending: true });
        if (pErr) throw pErr;
        pagos = pRows || [];
      } else {
        const { data: ccTutor, error: ccErr } = await supabase
          .from('tesoreria_cuentas_corrientes')
          .select('id')
          .eq('tipo', 'tutor')
          .eq('tutor_id', tutorIdValid)
          .maybeSingle();
        if (ccErr) throw ccErr;

        if (ccTutor?.id) {
          const { data: pRows, error: pErr } = await supabase
            .from('tesoreria_pagos')
            .select('id, cuenta_id, direccion, monto, fecha_pago, estado')
            .gte('fecha_pago', start6)
            .lte('fecha_pago', end)
            .eq('cuenta_id', ccTutor.id)
            .order('fecha_pago', { ascending: true })
            .order('id', { ascending: true });
          if (pErr) throw pErr;
          pagosTutor = pRows || [];
        }
      }

      // 3) Series (últimos 6 meses)
      const seriesEsperadoMap = new Map();
      const seriesRealMap = new Map();
      const topTutorRealMap = new Map();

      let esperadoIngresosMes = 0;
      let esperadoEgresosMes = 0;
      let esperadoMovimientosMes = 0;

      let realIngresosMes = 0;
      let realEgresosMes = 0;
      let realMovimientosMes = 0;

      for (const row of (obligs || [])) {
        const fecha = String(row?.fecha_devengo || '');
        const ym = fecha ? fecha.slice(0, 7) : null;
        const monto = Number(row?.monto) || 0;
        const isPendiente = String(row?.estado || '') === 'pendiente';
        const isIngreso = String(row?.tipo || '') === 'cobro_sesion';
        const isEgreso = String(row?.tipo || '') === 'pago_tutor_sesion';

        if (ym) {
          const eEntry = seriesEsperadoMap.get(ym) || { mes: ym, ingresos: 0, egresos: 0, neto: 0 };
          if (isPendiente && isIngreso) eEntry.ingresos += monto;
          if (isPendiente && isEgreso) eEntry.egresos += monto;
          eEntry.neto = eEntry.ingresos - eEntry.egresos;
          seriesEsperadoMap.set(ym, eEntry);
        }

        if (ym === mes) {
          if (isPendiente && (isIngreso || isEgreso)) esperadoMovimientosMes += 1;
          if (isPendiente && isIngreso) esperadoIngresosMes += monto;
          if (isPendiente && isEgreso) esperadoEgresosMes += monto;
        }
      }

      // Real sin filtro: sumar directo pagos (entradas/salidas)
      if (!tutorIdValid) {
        const cuentaIdsSalidasMes = new Set();
        for (const row of (pagos || [])) {
          const fecha = String(row?.fecha_pago || '');
          const ym = fecha ? fecha.slice(0, 7) : null;
          const monto = Number(row?.monto) || 0;
          const estado = normalizeEstado(row?.estado);
          const real = estado === 'completado' || estado === 'verificado';
          if (!real) continue;

          const dir = String(row?.direccion || '');
          const isIngreso = dir === 'entrada';
          const isEgreso = dir === 'salida';

          if (ym) {
            const rEntry = seriesRealMap.get(ym) || { mes: ym, ingresos: 0, egresos: 0, neto: 0 };
            if (isIngreso) rEntry.ingresos += monto;
            if (isEgreso) rEntry.egresos += monto;
            rEntry.neto = rEntry.ingresos - rEntry.egresos;
            seriesRealMap.set(ym, rEntry);
          }

          if (ym === mes) {
            realMovimientosMes += 1;
            if (isIngreso) realIngresosMes += monto;
            if (isEgreso) {
              realEgresosMes += monto;
              if (row?.cuenta_id) cuentaIdsSalidasMes.add(Number(row.cuenta_id));
            }
          }
        }

        if (cuentaIdsSalidasMes.size > 0) {
          const ids = Array.from(cuentaIdsSalidasMes.values()).filter((x) => Number.isFinite(x) && x > 0);
          const { data: cuentas, error: cErr } = await supabase
            .from('tesoreria_cuentas_corrientes')
            .select('id, tipo, tutor_id, tutores:tutor_id (nombre)')
            .in('id', ids);
          if (cErr) throw cErr;

          const cuentaToTutor = new Map();
          for (const c of (cuentas || [])) {
            if (String(c?.tipo) !== 'tutor') continue;
            if (!c?.tutor_id) continue;
            cuentaToTutor.set(Number(c.id), {
              tutor_id: Number(c.tutor_id),
              tutor_nombre: c?.tutores?.nombre || '',
            });
          }

          for (const row of (pagos || [])) {
            const fecha = String(row?.fecha_pago || '');
            const ym = fecha ? fecha.slice(0, 7) : null;
            if (ym !== mes) continue;

            const estado = normalizeEstado(row?.estado);
            const real = estado === 'completado' || estado === 'verificado';
            if (!real) continue;
            if (String(row?.direccion || '') !== 'salida') continue;

            const info = cuentaToTutor.get(Number(row?.cuenta_id));
            if (!info) continue;

            const prev = topTutorRealMap.get(info.tutor_id) || { tutor_id: info.tutor_id, tutor_nombre: info.tutor_nombre, total: 0 };
            prev.total += Number(row?.monto) || 0;
            if (!prev.tutor_nombre && info.tutor_nombre) prev.tutor_nombre = info.tutor_nombre;
            topTutorRealMap.set(info.tutor_id, prev);
          }
        }
      } else {
        // Real con filtro tutor: 
        // - Ingresos reales = suma de aplicaciones (pagos reales) a obligaciones cobro_sesion de ese tutor.
        // - Egresos reales = pagos (salidas) al tutor.
        const realIngresoPagoIds = new Set();
        try {
          const { data: apps, error: aErr } = await supabase
            .from('tesoreria_aplicaciones')
            .select('id, monto, pago:pago_id (id, fecha_pago, estado, direccion), obligacion:obligacion_id (id, tipo, tutor_id)')
            .order('id', { ascending: true });
          if (aErr) throw aErr;

          for (const a of (apps || [])) {
            const pago = a?.pago;
            const ob = a?.obligacion;
            if (!pago || !ob) continue;
            if (String(ob?.tipo || '') !== 'cobro_sesion') continue;
            if (Number(ob?.tutor_id) !== tutorIdValid) continue;
            if (String(pago?.direccion || '') !== 'entrada') continue;

            const fecha = String(pago?.fecha_pago || '');
            if (!fecha || fecha < start6 || fecha > end) continue;

            const estado = normalizeEstado(pago?.estado);
            const real = estado === 'completado' || estado === 'verificado';
            if (!real) continue;

            const ym = fecha.slice(0, 7);
            const monto = Number(a?.monto) || 0;

            const rEntry = seriesRealMap.get(ym) || { mes: ym, ingresos: 0, egresos: 0, neto: 0 };
            rEntry.ingresos += monto;
            rEntry.neto = rEntry.ingresos - rEntry.egresos;
            seriesRealMap.set(ym, rEntry);

            if (ym === mes) {
              realIngresosMes += monto;
              realIngresoPagoIds.add(Number(pago?.id));
            }
          }
        } catch {
          // Si falla el join por permisos/relaciones, simplemente no atribuimos ingresos por tutor.
        }

        const ccTutorPagoIds = new Set();
        for (const row of (pagosTutor || [])) {
          const fecha = String(row?.fecha_pago || '');
          const ym = fecha ? fecha.slice(0, 7) : null;
          const monto = Number(row?.monto) || 0;
          const estado = normalizeEstado(row?.estado);
          const real = estado === 'completado' || estado === 'verificado';
          if (!real) continue;
          if (String(row?.direccion || '') !== 'salida') continue;

          if (ym) {
            const rEntry = seriesRealMap.get(ym) || { mes: ym, ingresos: 0, egresos: 0, neto: 0 };
            rEntry.egresos += monto;
            rEntry.neto = rEntry.ingresos - rEntry.egresos;
            seriesRealMap.set(ym, rEntry);
          }

          if (ym === mes) {
            realEgresosMes += monto;
            ccTutorPagoIds.add(Number(row?.id));
          }
        }

        // Movimientos del mes = pagos de ingreso atribuibles + pagos de salida al tutor.
        const union = new Set([...Array.from(realIngresoPagoIds.values()), ...Array.from(ccTutorPagoIds.values())]);
        realMovimientosMes = union.size;

        // Top tutores (real) con filtro: solo él mismo
        const { data: tutorRow, error: tErr } = await supabase
          .from('tutores')
          .select('id, nombre')
          .eq('id', tutorIdValid)
          .maybeSingle();
        if (tErr) throw tErr;
        if (tutorRow) {
          topTutorRealMap.set(tutorIdValid, {
            tutor_id: tutorIdValid,
            tutor_nombre: tutorRow?.nombre || '',
            total: realEgresosMes,
          });
        }
      }

      // Asegurar meses en serie (incluye meses vacíos)
      const months = [];
      for (let i = -5; i <= 0; i += 1) {
        const key = addMonths(mes, i);
        if (!key) continue;
        months.push(key);
        if (!seriesEsperadoMap.has(key)) seriesEsperadoMap.set(key, { mes: key, ingresos: 0, egresos: 0, neto: 0 });
        if (!seriesRealMap.has(key)) seriesRealMap.set(key, { mes: key, ingresos: 0, egresos: 0, neto: 0 });
      }

      const series_esperado = months.map((m) => seriesEsperadoMap.get(m));
      const series_real = months.map((m) => seriesRealMap.get(m));

      const top_tutores_real = Array.from(topTutorRealMap.values())
        .sort((a, b) => (Number(b.total) || 0) - (Number(a.total) || 0))
        .slice(0, 5);

      const esperado = {
        ingresos: esperadoIngresosMes,
        pagos_tutores: esperadoEgresosMes,
        neto: esperadoIngresosMes - esperadoEgresosMes,
        movimientos: esperadoMovimientosMes,
      };

      const real = {
        ingresos: realIngresosMes,
        pagos_tutores: realEgresosMes,
        neto: realIngresosMes - realEgresosMes,
        movimientos: realMovimientosMes,
      };

      return {
        mes,
        fecha_inicio: range.start,
        fecha_fin: range.end,
        // Backward compatible: ahora representa "esperado".
        ingresos: esperado.ingresos,
        pagos_tutores: esperado.pagos_tutores,
        neto: esperado.neto,
        movimientos: esperado.movimientos,
        tutor_id: tutorIdValid,
        esperado,
        real,
        diferencial: {
          ingresos: esperado.ingresos - real.ingresos,
          pagos_tutores: esperado.pagos_tutores - real.pagos_tutores,
          neto: esperado.neto - real.neto,
        },
        series: series_esperado,
        series_esperado,
        series_real,
        top_tutores: top_tutores_real,
        top_tutores_real,
        fuente: tutorIdValid
          ? 'tesoreria_v2 (esperado=obligaciones; real=pagos; ingresos por tutor via aplicaciones FIFO)'
          : 'tesoreria_v2 (esperado=obligaciones; real=pagos)',
      };
    };

    try {
      const out = await computeV2();
      return res.json(out);
    } catch (err) {
      if (!isMissingV2(err)) {
        throw err;
      }
      // Si el esquema v2 aún no está aplicado, seguir usando el cálculo legacy.
    }

    let q = supabase
      .from('movimientos_dinero')
      .select('id, tipo, monto, fecha_pago, estado, tutor_id, tutor:tutor_id (nombre)')
      .gte('fecha_pago', start6)
      .lte('fecha_pago', end)
      .order('fecha_pago', { ascending: true })
      .order('id', { ascending: true });

    if (tutorIdValid) q = q.eq('tutor_id', tutorIdValid);

    const { data, error } = await q;
    if (error) throw error;

    const seriesEsperadoMap = new Map();
    const seriesRealMap = new Map();
    const topTutorRealMap = new Map();

    let esperadoIngresosMes = 0;
    let esperadoEgresosMes = 0;
    let esperadoMovimientosMes = 0;

    let realIngresosMes = 0;
    let realEgresosMes = 0;
    let realMovimientosMes = 0;

    for (const row of (data || [])) {
      const fechaPago = String(row?.fecha_pago || '');
      const ym = fechaPago ? fechaPago.slice(0, 7) : null;
      const monto = Number(row?.monto) || 0;
      const { isIngreso, isEgreso } = movementFlags(row?.tipo);
      const estado = normalizeEstado(row?.estado);
      const real = estado === 'completado' || estado === 'verificado';

      // Definición contable:
      // - Esperado: ingresos de estudiante pendientes + pagos tutor pendientes.
      // - Real: movimientos completados/verificados (ingresos y egresos).
      const isEsperadoIngreso = estado === 'pendiente' && String(row?.tipo || '') === 'ingreso_estudiante';
      const isEsperadoEgreso = estado === 'pendiente' && String(row?.tipo || '') === 'pago_tutor_pendiente';
      const isRealIngreso = real && isIngreso && isRealIngresoTipo(row?.tipo);
      const isRealEgreso = real && isEgreso;

      if (ym) {
        const eEntry = seriesEsperadoMap.get(ym) || { mes: ym, ingresos: 0, egresos: 0, neto: 0 };
        if (isEsperadoIngreso) eEntry.ingresos += monto;
        if (isEsperadoEgreso) eEntry.egresos += monto;
        eEntry.neto = eEntry.ingresos - eEntry.egresos;
        seriesEsperadoMap.set(ym, eEntry);

        const rEntry = seriesRealMap.get(ym) || { mes: ym, ingresos: 0, egresos: 0, neto: 0 };
        if (isRealIngreso) rEntry.ingresos += monto;
        if (isRealEgreso) rEntry.egresos += monto;
        rEntry.neto = rEntry.ingresos - rEntry.egresos;
        seriesRealMap.set(ym, rEntry);
      }

      if (ym === mes) {
        if (isEsperadoIngreso || isEsperadoEgreso) esperadoMovimientosMes += 1;
        if (isEsperadoIngreso) esperadoIngresosMes += monto;
        if (isEsperadoEgreso) esperadoEgresosMes += monto;

        if (isRealIngreso || isRealEgreso) realMovimientosMes += 1;
        if (isRealIngreso) realIngresosMes += monto;
        if (isRealEgreso) {
          realEgresosMes += monto;
          const tid = row?.tutor_id ? Number(row.tutor_id) : null;
          if (tid) {
            const prev = topTutorRealMap.get(tid) || { tutor_id: tid, tutor_nombre: row?.tutor?.nombre || '', total: 0 };
            prev.total += monto;
            if (!prev.tutor_nombre && row?.tutor?.nombre) prev.tutor_nombre = row.tutor.nombre;
            topTutorRealMap.set(tid, prev);
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
      if (!seriesEsperadoMap.has(key)) seriesEsperadoMap.set(key, { mes: key, ingresos: 0, egresos: 0, neto: 0 });
      if (!seriesRealMap.has(key)) seriesRealMap.set(key, { mes: key, ingresos: 0, egresos: 0, neto: 0 });
    }

    const series_esperado = months.map((m) => seriesEsperadoMap.get(m));
    const series_real = months.map((m) => seriesRealMap.get(m));

    const top_tutores_real = Array.from(topTutorRealMap.values())
      .sort((a, b) => (Number(b.total) || 0) - (Number(a.total) || 0))
      .slice(0, 5);

    const esperado = {
      ingresos: esperadoIngresosMes,
      pagos_tutores: esperadoEgresosMes,
      neto: esperadoIngresosMes - esperadoEgresosMes,
      movimientos: esperadoMovimientosMes,
    };

    const real = {
      ingresos: realIngresosMes,
      pagos_tutores: realEgresosMes,
      neto: realIngresosMes - realEgresosMes,
      movimientos: realMovimientosMes,
    };

    return res.json({
      mes,
      fecha_inicio: range.start,
      fecha_fin: range.end,
      // Backward compatible: ahora representa "esperado".
      ingresos: esperado.ingresos,
      pagos_tutores: esperado.pagos_tutores,
      neto: esperado.neto,
      movimientos: esperado.movimientos,
      tutor_id: tutorIdValid,
      // Nuevos bloques
      esperado,
      real,
      diferencial: {
        ingresos: esperado.ingresos - real.ingresos,
        pagos_tutores: esperado.pagos_tutores - real.pagos_tutores,
        neto: esperado.neto - real.neto,
      },
      series: series_esperado,
      series_esperado,
      series_real,
      top_tutores: top_tutores_real,
      top_tutores_real,
      fuente: 'movimientos_dinero (esperado vs real)',
    });
  } catch (error) {
    return sendSchemaError(res, error);
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
        estudiantes:estudiante_id (nombre, encargado_id, nombre_encargado, email_encargado, telefono_encargado),
        tutores:tutor_id (nombre)
      `)
      .eq('id', matriculaId)
      .single();
    if (mErr || !m) return res.status(404).json({ error: 'Matrícula no encontrada' });

    const ensureEncargadoIdForMatricula = async () => {
      let encargadoId = m?.estudiantes?.encargado_id ?? null;
      if (encargadoId) return encargadoId;

      const emailEnc = m?.estudiantes?.email_encargado ? String(m.estudiantes.email_encargado).trim() : null;
      const telEnc = m?.estudiantes?.telefono_encargado ? String(m.estudiantes.telefono_encargado).trim() : null;
      const nomEnc = m?.estudiantes?.nombre_encargado ? String(m.estudiantes.nombre_encargado).trim() : null;

      if (!emailEnc && !telEnc && !nomEnc) return null;

      const newEncId = await getOrCreateEncargadoId({ nombre: nomEnc, email: emailEnc, telefono: telEnc });
      if (!newEncId) return null;

      const { error: uErr } = await supabase
        .from('estudiantes')
        .update({ encargado_id: newEncId })
        .eq('id', m.estudiante_id);
      if (uErr) throw uErr;

      // Mantener m en memoria consistente para este request
      if (m.estudiantes) m.estudiantes.encargado_id = newEncId;
      return newEncId;
    };

    const ensureTesoreriaObligacionesV2 = async (sesionId) => {
      // Tesorería v2 (opcional): generar obligaciones esperadas por sesión (cobro a encargado / pago a tutor)
      // No debe bloquear el flujo actual si el esquema v2 aún no fue aplicado.
      const safeMsg = (err) => String(err?.message || '').toLowerCase();
      const isMissingV2 = (err) => {
        const msg = safeMsg(err);
        return (
          msg.includes('does not exist') &&
          (msg.includes('tesoreria_obligaciones') || msg.includes('tesoreria_cuentas_corrientes') || msg.includes('tesoreria_get_or_create_cuenta'))
        );
      };

      try {
        const encargadoId = await ensureEncargadoIdForMatricula();
        const costoCurso = parseFloat(m.cursos?.costo_curso || 0);
        const pagoTutor = parseFloat(m.cursos?.pago_tutor || 0);
        const isUniqueViolation = (e) => String(e?.code || '') === '23505';

        if (encargadoId) {
          const { data: cuentaEncargado, error: ccErr } = await supabase.rpc('tesoreria_get_or_create_cuenta_encargado_v1', {
            p_encargado_id: encargadoId,
          });
          if (ccErr) throw ccErr;

          const { error: obErr } = await supabase
            .from('tesoreria_obligaciones')
            .insert({
              tipo: 'cobro_sesion',
              cuenta_id: cuentaEncargado,
              monto: costoCurso,
              fecha_devengo: fecha,
              estado: 'pendiente',
              estudiante_id: m.estudiante_id,
              tutor_id: m.tutor_id,
              curso_id: m.curso_id,
              matricula_id: m.id,
              sesion_id: sesionId,
              detalle: `Cobro esperado por sesión (${m.cursos?.nombre})`,
            });
          if (obErr && !isUniqueViolation(obErr)) throw obErr;
        }

        if (m.tutor_id) {
          const { data: cuentaTutor, error: ctErr } = await supabase.rpc('tesoreria_get_or_create_cuenta_tutor_v1', {
            p_tutor_id: m.tutor_id,
          });
          if (ctErr) throw ctErr;

          const { error: ob2Err } = await supabase
            .from('tesoreria_obligaciones')
            .insert({
              tipo: 'pago_tutor_sesion',
              cuenta_id: cuentaTutor,
              monto: pagoTutor,
              fecha_devengo: fecha,
              estado: 'pendiente',
              estudiante_id: m.estudiante_id,
              tutor_id: m.tutor_id,
              curso_id: m.curso_id,
              matricula_id: m.id,
              sesion_id: sesionId,
              detalle: `Pago tutor esperado por sesión (${m.tutores?.nombre})`,
            });
          if (ob2Err && !isUniqueViolation(ob2Err)) throw ob2Err;
        }
      } catch (err) {
        if (!isMissingV2(err)) {
          console.warn('⚠️ Tesorería v2: no se pudieron generar obligaciones:', err?.message || err);
        }
      }
    };

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

      // Si ya estaba dada, igual intentamos (re)generar obligaciones de tesorería v2 por si antes falló.
      if (tipoPago !== 'mensual') {
        await ensureTesoreriaObligacionesV2(existing.id);
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
    const tipoPago = String(m.cursos?.tipo_pago || 'sesion');
    if (tipoPago === 'mensual') {
      return res.json({ message: 'Sesión marcada como dada (curso mensual). Movimientos no se generan automáticamente.', sesion_id: sesion.id });
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

    // Tesorería v2 (opcional): generar obligaciones esperadas por sesión (cobro a encargado / pago a tutor)
    await ensureTesoreriaObligacionesV2(sesion.id);

    res.json({ message: 'Sesión marcada como dada y movimientos generados', sesion_id: sesion.id });
  } catch (error) {
    return sendSchemaError(res, error);
  }
});

// POST - Cancelar sesión solo para el día
router.post('/sesion/:matriculaId/:fecha/cancelar-dia', async (req, res) => {
  try {
    const { matriculaId, fecha } = req.params;
    const motivo = String(req.body?.motivo_cancelacion ?? '').trim();
    const { data: m, error: mErr } = await supabase
      .from('matriculas')
      .select(`
        id, tutor_id, curso_id,
        cursos:curso_id (nombre, dias_schedule)
      `)
      .eq('id', matriculaId)
      .single();
    if (mErr || !m) return res.status(404).json({ error: 'Matrícula no encontrada' });

    const { data: existingRows, error: exErr } = await supabase
      .from('sesiones_clases')
      .select('id, estado')
      .eq('matricula_id', m.id)
      .eq('fecha', fecha)
      .order('id', { ascending: false })
      .limit(1);
    if (exErr) throw exErr;

    const existing = (existingRows && existingRows.length > 0) ? existingRows[0] : null;
    if (existing) {
      if (existing.estado === 'dada') {
        return res.status(409).json({ error: 'Esta sesión ya fue marcada como dada. No se puede cancelar.' });
      }

      if (existing.estado === 'cancelada') {
        if (motivo) {
          const { error: uErr } = await supabase
            .from('sesiones_clases')
            .update({ notas: motivo })
            .eq('id', existing.id);
          if (uErr) throw uErr;
        }
        return res.json({ message: 'Sesión ya estaba cancelada para el día', sesion_id: existing.id, already_cancelled: true });
      }
    }

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
        notas: motivo || 'Cancelada por el usuario'
      });
    if (sErr) throw sErr;

    res.json({ message: 'Sesión cancelada para el día' });
  } catch (error) {
    return sendSchemaError(res, error);
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
    return sendSchemaError(res, error);
  }
});

// PATCH - Actualizar estado de sesión (avisado, confirmado, motivo)
router.patch('/sesion/:matriculaId/:fecha/estado', async (req, res) => {
  try {
    const { matriculaId, fecha } = req.params;
    const { avisado, confirmado, motivo_cancelacion } = req.body;

    const estadoLabel = confirmado ? 'confirmada' : avisado ? 'en_espera' : 'programada';
    req.activity = {
      action: 'update',
      entityType: 'sesion',
      entityId: `${matriculaId}:${fecha}`,
      summary: `Actualizó estado de sesión (${fecha}) → ${estadoLabel}`,
      meta: { estado: estadoLabel, matricula_id: matriculaId, fecha },
    };

    // Usar admin key si existe; si no, usar el JWT del usuario (RLS-safe)
    const db = supabaseAdmin ?? supabaseForToken(req.accessToken);

    const updateData = { updated_at: new Date().toISOString() };
    if (avisado !== undefined) updateData.avisado = avisado;
    if (confirmado !== undefined) updateData.confirmado = confirmado;
    if (motivo_cancelacion !== undefined) updateData.motivo_cancelacion = motivo_cancelacion;

    // Buscar la clase asociada a la matrícula en esa fecha
    const { data: clases, error: selectError } = await db
      .from('clases')
      .select('id')
      .eq('matricula_id', matriculaId)
      .eq('fecha', fecha)
      .limit(1);

    if (selectError) throw selectError;

    let claseId = clases && clases.length > 0 ? clases[0].id : null;

    // Si no existe, crear la clase usando el horario del curso para ese día
    if (!claseId) {
      const { data: m, error: mErr } = await db
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

      const hora_inicio = normalizeTimeToHHMMSS(schedule.hora_inicio);
      const hora_fin = normalizeTimeToHHMMSS(schedule.hora_fin);

      if (!hora_inicio || !hora_fin) {
        return res.status(400).json({
          error: 'No se puede crear la sesión: el horario del curso no tiene un formato de hora válido (se espera HH:MM o HH:MM:SS)'
        });
      }

      // Evitar violar el constraint hora_inicio < hora_fin
      if (hora_inicio >= hora_fin) {
        return res.status(400).json({
          error: 'No se puede crear la sesión: hora_inicio debe ser menor que hora_fin'
        });
      }
      const duracion_horas = (() => {
        try {
          const [hi, mi] = String(hora_inicio).split(':').map(Number);
          const [hf, mf] = String(hora_fin).split(':').map(Number);
          const min = (hf * 60 + mf) - (hi * 60 + mi);
          return Math.max(0, parseFloat((min / 60).toFixed(2)));
        } catch { return 0; }
      })();

      const insertBase = {
        matricula_id: m.id,
        fecha,
        hora_inicio,
        hora_fin,
        estado: 'programada',
        created_by: req.user?.id || null,
        avisado: avisado ?? null,
        confirmado: confirmado ?? null,
        motivo_cancelacion: motivo_cancelacion ?? null,
      };

      // Algunas bases antiguas no tienen 'duracion_horas' (ni otras columnas).
      // Intentamos con duracion_horas y si falla por schema cache, reintentamos sin ella.
      const tryInsert = async (payload) => {
        return await db.from('clases').insert(payload).select('id').single();
      };

      let insertResult = await tryInsert({ ...insertBase, duracion_horas });
      if (insertResult.error) {
        const msg = String(insertResult.error.message || '').toLowerCase();
        const missingDuration = msg.includes("could not find the 'duracion_horas' column") || msg.includes('duracion_horas');
        if (missingDuration) {
          insertResult = await tryInsert(insertBase);
        }
      }

      if (insertResult.error) throw insertResult.error;
      claseId = insertResult.data.id;
    }

    const { error: updateError } = await db
      .from('clases')
      .update(updateData)
      .eq('id', claseId);

    if (updateError) {
      const msg = String(updateError.message || '');
      if (
        msg.includes("Could not find the 'avisado' column") ||
        msg.includes("Could not find the 'confirmado' column") ||
        msg.includes("Could not find the 'motivo_cancelacion' column")
      ) {
        return res.status(400).json({
          error: `${msg}. Tu tabla public.clases está desactualizada. Agrega las columnas avisado/confirmado/motivo_cancelacion (y opcional duracion_horas) en Supabase.`,
          code: 'CLASES_SCHEMA_OUTDATED',
        });
      }
      throw updateError;
    }
    res.json({ message: 'Estado actualizado', sesion_id: claseId });
  } catch (error) {
    // Deja rastros útiles en consola para depurar 500
    console.error('❌ Error en PATCH /dashboard/sesion/:matriculaId/:fecha/estado:', {
      message: error?.message,
      code: error?.code,
      details: error?.details,
      hint: error?.hint,
      cause: error?.cause,
    });
    res.status(500).json({
      error: error?.message || 'Error interno',
      code: error?.code,
      details: error?.details,
      hint: error?.hint,
    });
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
    return sendSchemaError(res, error);
  }
});

export default router;


