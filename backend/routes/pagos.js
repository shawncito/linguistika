import express from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { supabase } from '../supabase.js';
import { requireRoles } from '../middleware/roles.js';

const router = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const UPLOAD_ROOT = path.join(__dirname, '..', 'uploads', 'comprobantes');

const ensureUploadDir = () => {
  try {
    fs.mkdirSync(UPLOAD_ROOT, { recursive: true });
  } catch {
    // ignore
  }
};

const sanitizeFilename = (name) => String(name || 'archivo').replace(/[^a-zA-Z0-9._-]+/g, '_');

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      ensureUploadDir();
      cb(null, UPLOAD_ROOT);
    },
    filename: (req, file, cb) => {
      const movementId = String(req.params?.id || 'mov');
      const stamp = new Date().toISOString().replace(/[:.]/g, '-');
      cb(null, `${movementId}-${stamp}-${sanitizeFilename(file.originalname)}`);
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (_req, file, cb) => {
    const mime = String(file.mimetype || '').toLowerCase();
    const ok = mime.startsWith('image/') || mime === 'application/pdf';
    cb(ok ? null : new Error('Tipo de archivo no permitido (solo imagen o PDF)'), ok);
  },
});

const isMissingColumnError = (error, columnName) => {
  const msg = (error?.message || '').toLowerCase();
  const details = (error?.details || '').toLowerCase();
  const hint = (error?.hint || '').toLowerCase();
  const needle = (columnName || '').toLowerCase();

  return (
    msg.includes('column') &&
    msg.includes(needle) &&
    (msg.includes('does not exist') || msg.includes('not exist') || details.includes('does not exist') || hint.includes('does not exist'))
  );
};

const isValidISODate = (value) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);

const toIntOrNull = (value) => {
  if (value === undefined || value === null || value === '') return null;
  const n = Number.parseInt(String(value), 10);
  return Number.isFinite(n) ? n : null;
};

const parseNotesForComprobanteUrl = (notas) => {
  const raw = String(notas || '');
  const match = raw.match(/COMPROBANTE_URL:([^\s]+)/);
  return match ? match[1] : null;
};

const appendComprobanteUrlToNotes = (notas, url) => {
  const base = String(notas || '').trim();
  const clean = base.replace(/COMPROBANTE_URL:[^\s]+/g, '').trim();
  const line = `COMPROBANTE_URL:${String(url || '').trim()}`;
  return clean ? `${clean}\n${line}` : line;
};

const clampInt = (value, min, max) => {
  const n = Number.parseInt(String(value), 10);
  if (!Number.isFinite(n)) return null;
  return Math.max(min, Math.min(max, n));
};

const getMonthRange = (year, month1to12) => {
  const y = Number.parseInt(String(year), 10);
  const m = Number.parseInt(String(month1to12), 10);
  if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) return null;
  const start = new Date(Date.UTC(y, m - 1, 1));
  const end = new Date(Date.UTC(y, m, 0));
  const toISO = (d) => d.toISOString().slice(0, 10);
  return { periodo_inicio: toISO(start), periodo_fin: toISO(end), tag: `${y}-${String(m).padStart(2, '0')}` };
};

async function getConfigValue(key, defaultValue) {
  const { data, error } = await supabase
    .from('configuracion')
    .select('value')
    .eq('key', key)
    .maybeSingle();

  if (error) {
    // si la tabla no existe / no hay permisos, degradar a default
    return defaultValue;
  }
  return data?.value ?? defaultValue;
}

async function setConfigValue(key, value) {
  const { error } = await supabase
    .from('configuracion')
    .upsert({ key, value: String(value), updated_at: new Date().toISOString() }, { onConflict: 'key' });
  return error;
}

// Solo admin/contador pueden entrar a pagos
router.use(requireRoles(['admin', 'contador']));

// GET - Listar todos los pagos
router.get('/', async (req, res) => {
  try {
    const { data: pagos, error } = await supabase
      .from('pagos')
      .select(`
        *,
        tutores:tutor_id (nombre, email)
      `)
      .order('fecha_pago', { ascending: false });
    
    if (error) throw error;
    
    const formatted = pagos.map(p => ({
      ...p,
      tutor_nombre: p.tutores?.nombre,
      tutor_email: p.tutores?.email
    }));
    
    res.json(formatted);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET - Pagos de un tutor
router.get('/tutor/:tutor_id', async (req, res) => {
  try {
    const { data: pagos, error } = await supabase
      .from('pagos')
      .select('*')
      .eq('tutor_id', req.params.tutor_id)
      .order('fecha_pago', { ascending: false });
    
    if (error) throw error;
    res.json(pagos);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET - Configuración de pagos
router.get('/config', async (_req, res) => {
  try {
    const diaStr = await getConfigValue('cierre_mensual_dia', '1');
    const cierre_mensual_dia = clampInt(diaStr, 1, 28) ?? 1;
    res.json({ cierre_mensual_dia });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT - Configuración de pagos
router.put('/config', async (req, res) => {
  try {
    const cierre_mensual_dia = clampInt(req.body?.cierre_mensual_dia, 1, 28);
    if (!cierre_mensual_dia) {
      return res.status(400).json({ error: 'cierre_mensual_dia debe ser un entero entre 1 y 28' });
    }

    const err = await setConfigValue('cierre_mensual_dia', String(cierre_mensual_dia));
    if (err) throw err;
    res.json({ cierre_mensual_dia });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST - Generar cierre mensual (movimientos) para cursos mensuales
// Body: { anio, mes } o { periodo_inicio, periodo_fin }, force?: boolean
router.post('/cierre-mensual', async (req, res) => {
  try {
    const { anio, mes, periodo_inicio, periodo_fin, force } = req.body || {};

    const monthRange = (anio && mes) ? getMonthRange(anio, mes) : null;
    const start = monthRange?.periodo_inicio ?? (isValidISODate(periodo_inicio) ? String(periodo_inicio) : null);
    const end = monthRange?.periodo_fin ?? (isValidISODate(periodo_fin) ? String(periodo_fin) : null);
    const tag = monthRange?.tag ?? (start && end ? `${start}_a_${end}` : null);

    if (!start || !end || !tag) {
      return res.status(400).json({ error: 'Debe enviar {anio, mes} o {periodo_inicio, periodo_fin} (YYYY-MM-DD)' });
    }

    const diaStr = await getConfigValue('cierre_mensual_dia', '1');
    const cierreDia = clampInt(diaStr, 1, 28) ?? 1;
    const hoyDia = new Date().getDate();

    if (!force && hoyDia !== cierreDia) {
      return res.status(409).json({
        error: `El cierre mensual está configurado para el día ${cierreDia}. Hoy es ${hoyDia}.`,
        cierre_mensual_dia: cierreDia,
        hoy_dia: hoyDia
      });
    }

    // 1) Traer sesiones dadas en el periodo con info de matrícula y curso
    const selectWith = `
      id,
      fecha,
      estado,
      curso_id,
      tutor_id,
      matricula_id,
      matricula:matricula_id (id, estudiante_id, tutor_id, curso_id),
      curso:curso_id (id, nombre, tipo_pago, costo_curso, pago_tutor)
    `;

    let sesiones;
    {
      const { data, error } = await supabase
        .from('sesiones_clases')
        .select(selectWith)
        .eq('estado', 'dada')
        .gte('fecha', start)
        .lte('fecha', end);
      if (error) {
        if (isMissingColumnError(error, 'matricula_id')) {
          return res.status(409).json({
            error: 'Falta la columna sesiones_clases.matricula_id. Ejecute la migración 005_add_matricula_id_to_sesiones_clases.sql'
          });
        }
        throw error;
      }
      sesiones = data || [];
    }

    // 2) Filtrar solo cursos mensuales con matrícula válida
    const sesionesMensuales = (sesiones || []).filter(s => {
      const tipo = s?.curso?.tipo_pago;
      return tipo === 'mensual' && s?.matricula_id;
    });

    if (sesionesMensuales.length === 0) {
      return res.json({
        periodo_inicio: start,
        periodo_fin: end,
        tag,
        sesiones_mensuales: 0,
        ingresos_creados: 0,
        pagos_creados: 0,
        skipped_existentes: 0
      });
    }

    // 3) Determinar qué ingresos/pagos se deben generar (1 por matrícula/curso y 1 por tutor/curso)
    const ingresosByMatriculaCurso = new Map();
    const pagosByTutorCurso = new Map();

    for (const s of sesionesMensuales) {
      const curso = s.curso;
      const matricula = s.matricula;
      if (!curso || !matricula) continue;

      const keyIngreso = `${matricula.id}:${curso.id}`;
      if (!ingresosByMatriculaCurso.has(keyIngreso)) {
        ingresosByMatriculaCurso.set(keyIngreso, {
          curso_id: curso.id,
          matricula_id: matricula.id,
          tutor_id: matricula.tutor_id ?? s.tutor_id ?? null,
          sesion_id: null,
          tipo: 'ingreso_estudiante',
          monto: Number(curso.costo_curso) || 0,
          factura_numero: null,
          fecha_pago: end,
          fecha_comprobante: null,
          estado: 'pendiente',
          origen: 'cierre_mensual',
          periodo_inicio: start,
          periodo_fin: end,
          notas: `CIERRE_MENSUAL:${tag} - Ingreso mensual (${curso.nombre || 'curso'})`
        });
      }

      const keyPago = `${s.tutor_id}:${curso.id}`;
      if (!pagosByTutorCurso.has(keyPago)) {
        pagosByTutorCurso.set(keyPago, {
          curso_id: curso.id,
          matricula_id: null,
          tutor_id: s.tutor_id,
          sesion_id: null,
          tipo: 'pago_tutor_pendiente',
          monto: Number(curso.pago_tutor) || 0,
          factura_numero: null,
          fecha_pago: end,
          fecha_comprobante: null,
          estado: 'pendiente',
          origen: 'cierre_mensual',
          periodo_inicio: start,
          periodo_fin: end,
          notas: `CIERRE_MENSUAL:${tag} - Pago mensual tutor`
        });
      }
    }

    const ingresos = Array.from(ingresosByMatriculaCurso.values());
    const pagos = Array.from(pagosByTutorCurso.values());

    // 4) Evitar duplicados (si existen columnas origen/periodo_*). Si no existen, se genera pero puede duplicar.
    let supportsOrigenPeriodo = true;
    let existentes = [];
    {
      const { data, error } = await supabase
        .from('movimientos_dinero')
        .select('id, tipo, curso_id, matricula_id, tutor_id, origen, periodo_inicio, periodo_fin')
        .eq('origen', 'cierre_mensual')
        .eq('periodo_inicio', start)
        .eq('periodo_fin', end);

      if (error && (isMissingColumnError(error, 'origen') || isMissingColumnError(error, 'periodo_inicio') || isMissingColumnError(error, 'periodo_fin'))) {
        supportsOrigenPeriodo = false;
        existentes = [];
      } else {
        if (error) throw error;
        existentes = data || [];
      }
    }

    const existsKey = new Set();
    if (supportsOrigenPeriodo) {
      for (const e of existentes) {
        const k = `${e.tipo}:${e.curso_id}:${e.matricula_id ?? 'null'}:${e.tutor_id ?? 'null'}`;
        existsKey.add(k);
      }
    }

    const toInsert = [];
    let skipped = 0;
    for (const mov of [...ingresos, ...pagos]) {
      if (!supportsOrigenPeriodo) {
        toInsert.push(mov);
        continue;
      }
      const k = `${mov.tipo}:${mov.curso_id}:${mov.matricula_id ?? 'null'}:${mov.tutor_id ?? 'null'}`;
      if (existsKey.has(k)) {
        skipped++;
        continue;
      }
      toInsert.push(mov);
    }

    if (toInsert.length > 0) {
      const { error } = await supabase
        .from('movimientos_dinero')
        .insert(toInsert);
      if (error) throw error;
    }

    res.json({
      periodo_inicio: start,
      periodo_fin: end,
      tag,
      cierre_mensual_dia: cierreDia,
      hoy_dia: hoyDia,
      supports_origen_periodo: supportsOrigenPeriodo,
      sesiones_mensuales: sesionesMensuales.length,
      ingresos_planeados: ingresos.length,
      pagos_planeados: pagos.length,
      insertados: toInsert.length,
      skipped_existentes: skipped
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST - Registrar pago
router.post('/', async (req, res) => {
  try {
    const { tutor_id, clase_id, cantidad_clases, monto, descripcion, estado, periodo_inicio, periodo_fin } = req.body;
    const userId = req.user?.id;
    
    if (!tutor_id || !monto) {
      return res.status(400).json({ error: 'Campos requeridos: tutor_id, monto' });
    }

    const baseInsert = {
      tutor_id,
      clase_id,
      cantidad_clases,
      monto,
      descripcion,
      created_by: userId,
      estado: estado || 'pendiente'
    };

    const withPeriodoInsert = {
      ...baseInsert,
      ...(isValidISODate(periodo_inicio) ? { periodo_inicio } : {}),
      ...(isValidISODate(periodo_fin) ? { periodo_fin } : {})
    };

    let pago;
    {
      const { data, error } = await supabase
        .from('pagos')
        .insert(withPeriodoInsert)
        .select(`
          *,
          tutores:tutor_id (nombre)
        `)
        .single();

      if (error && (isMissingColumnError(error, 'periodo_inicio') || isMissingColumnError(error, 'periodo_fin'))) {
        const retry = await supabase
          .from('pagos')
          .insert(baseInsert)
          .select(`
            *,
            tutores:tutor_id (nombre)
          `)
          .single();
        if (retry.error) throw retry.error;
        pago = retry.data;
      } else {
        if (error) throw error;
        pago = data;
      }
    }
    const formatted = {
      ...pago,
      tutor_nombre: pago.tutores?.nombre
    };
    
    res.status(201).json(formatted);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET - Resumen de pendientes de pago (desde movimientos_dinero)
// Query params: tutor_id (requerido), fecha_inicio, fecha_fin
router.get('/pendientes/resumen', async (req, res) => {
  try {
    const { tutor_id, fecha_inicio, fecha_fin } = req.query;

    if (!tutor_id) {
      return res.status(400).json({ error: 'Query param requerido: tutor_id' });
    }
    if (fecha_inicio && !isValidISODate(String(fecha_inicio))) {
      return res.status(400).json({ error: 'fecha_inicio debe ser YYYY-MM-DD' });
    }
    if (fecha_fin && !isValidISODate(String(fecha_fin))) {
      return res.status(400).json({ error: 'fecha_fin debe ser YYYY-MM-DD' });
    }

    const baseSelect = 'id,tutor_id,curso_id,matricula_id,fecha_pago,monto,estado,tipo';
    let supportsPagoId = true;

    let query = supabase
      .from('movimientos_dinero')
      .select(`${baseSelect},pago_id`)
      .eq('tutor_id', String(tutor_id))
      .eq('tipo', 'pago_tutor_pendiente')
      .eq('estado', 'pendiente');

    if (fecha_inicio) query = query.gte('fecha_pago', String(fecha_inicio));
    if (fecha_fin) query = query.lte('fecha_pago', String(fecha_fin));
    query = query.is('pago_id', null);

    let { data: movimientos, error } = await query;

    if (error && isMissingColumnError(error, 'pago_id')) {
      supportsPagoId = false;
      let retry = supabase
        .from('movimientos_dinero')
        .select(baseSelect)
        .eq('tutor_id', String(tutor_id))
        .eq('tipo', 'pago_tutor_pendiente')
        .eq('estado', 'pendiente');

      if (fecha_inicio) retry = retry.gte('fecha_pago', String(fecha_inicio));
      if (fecha_fin) retry = retry.lte('fecha_pago', String(fecha_fin));

      const res2 = await retry;
      movimientos = res2.data;
      error = res2.error;
    }

    if (error) throw error;

    const total_monto = (movimientos || []).reduce((acc, m) => acc + (Number(m.monto) || 0), 0);

    res.json({
      tutor_id: String(tutor_id),
      fecha_inicio: fecha_inicio ? String(fecha_inicio) : null,
      fecha_fin: fecha_fin ? String(fecha_fin) : null,
      supports_pago_id: supportsPagoId,
      cantidad_movimientos: (movimientos || []).length,
      total_monto,
      movimientos: movimientos || []
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET - Resumen agregado de pendientes por tutor (lista completa)
router.get('/pendientes/resumen-tutores', async (_req, res) => {
  try {
    const { data: tutores, error: tutoresError } = await supabase
      .from('tutores')
      .select('id, nombre')
      .order('nombre', { ascending: true });

    if (tutoresError) throw tutoresError;

    const { data: movs, error: movsError } = await supabase
      .from('movimientos_dinero')
      .select('tutor_id, monto')
      .eq('tipo', 'pago_tutor_pendiente')
      .eq('estado', 'pendiente');

    if (movsError) throw movsError;

    const totalsByTutor = new Map();
    for (const m of movs || []) {
      if (!m?.tutor_id) continue;
      const prev = totalsByTutor.get(m.tutor_id) || 0;
      totalsByTutor.set(m.tutor_id, prev + (Number(m.monto) || 0));
    }

    const rows = (tutores || []).map(t => ({
      tutor_id: t.id,
      tutor_nombre: t.nombre,
      total_pendiente: totalsByTutor.get(t.id) || 0
    }));

    res.json({ tutores: rows });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET - Detalle de pendientes por tutor (para desglose UI)
// Query params: tutor_id (requerido), fecha_inicio, fecha_fin
router.get('/pendientes/detalle-tutor', async (req, res) => {
  try {
    const { tutor_id, fecha_inicio, fecha_fin } = req.query;

    if (!tutor_id) {
      return res.status(400).json({ error: 'Query param requerido: tutor_id' });
    }
    if (fecha_inicio && !isValidISODate(String(fecha_inicio))) {
      return res.status(400).json({ error: 'fecha_inicio debe ser YYYY-MM-DD' });
    }
    if (fecha_fin && !isValidISODate(String(fecha_fin))) {
      return res.status(400).json({ error: 'fecha_fin debe ser YYYY-MM-DD' });
    }

    // Intentar traer detalles con joins (si las relaciones existen en Supabase)
    let supportsDetalles = true;
    let query = supabase
      .from('movimientos_dinero')
      .select(
        `id, tutor_id, curso_id, matricula_id, sesion_id, fecha_pago, monto, estado, tipo, origen, periodo_inicio, periodo_fin,
         curso:curso_id (nombre),
         matricula:matricula_id (estudiante_id, estudiante:estudiante_id (nombre))`
      )
      .eq('tutor_id', String(tutor_id))
      .eq('tipo', 'pago_tutor_pendiente')
      .eq('estado', 'pendiente');

    if (fecha_inicio) query = query.gte('fecha_pago', String(fecha_inicio));
    if (fecha_fin) query = query.lte('fecha_pago', String(fecha_fin));

    let { data, error } = await query;
    if (error) {
      supportsDetalles = false;
      // Fallback sin joins/columnas extra
      let q2 = supabase
        .from('movimientos_dinero')
        .select('id,tutor_id,curso_id,matricula_id,sesion_id,fecha_pago,monto,estado,tipo')
        .eq('tutor_id', String(tutor_id))
        .eq('tipo', 'pago_tutor_pendiente')
        .eq('estado', 'pendiente');
      if (fecha_inicio) q2 = q2.gte('fecha_pago', String(fecha_inicio));
      if (fecha_fin) q2 = q2.lte('fecha_pago', String(fecha_fin));
      const res2 = await q2;
      data = res2.data;
      error = res2.error;
    }
    if (error) throw error;

    const movimientos = data || [];
    const total_monto = movimientos.reduce((acc, m) => acc + (Number(m.monto) || 0), 0);

    res.json({
      tutor_id: String(tutor_id),
      fecha_inicio: fecha_inicio ? String(fecha_inicio) : null,
      fecha_fin: fecha_fin ? String(fecha_fin) : null,
      supports_detalles: supportsDetalles,
      cantidad_movimientos: movimientos.length,
      total_monto,
      movimientos
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET - Libro diario (control diario) desde movimientos_dinero
// Query: fecha (YYYY-MM-DD) o fecha_inicio/fecha_fin
router.get('/libro-diario', async (req, res) => {
  try {
    const { fecha, fecha_inicio, fecha_fin, only_totals, tutor_id } = req.query;

    const onlyTotals = ['1', 'true', 'yes'].includes(String(only_totals || '').trim().toLowerCase());

    const single = fecha ? String(fecha) : null;
    const start = fecha_inicio ? String(fecha_inicio) : (single ? single : null);
    const end = fecha_fin ? String(fecha_fin) : (single ? single : null);

    if (!start || !end) {
      return res.status(400).json({ error: 'Debe enviar fecha o (fecha_inicio y fecha_fin) en formato YYYY-MM-DD' });
    }
    if (!isValidISODate(start) || !isValidISODate(end)) {
      return res.status(400).json({ error: 'fecha/fecha_inicio/fecha_fin debe ser YYYY-MM-DD' });
    }

    const tutorId = tutor_id ? toIntOrNull(tutor_id) : null;
    if (tutor_id && (tutorId === null || tutorId <= 0)) {
      return res.status(400).json({ error: 'tutor_id debe ser un entero válido' });
    }

    if (onlyTotals) {
      let q = supabase
        .from('movimientos_dinero')
        .select('tipo, monto')
        .gte('fecha_pago', start)
        .lte('fecha_pago', end);

      if (tutorId) q = q.eq('tutor_id', tutorId);

      const { data, error } = await q;
      if (error) throw error;

      const rows = data ?? [];
      let totalDebe = 0;
      let totalHaber = 0;

      for (const r of rows) {
        const tipo = String(r?.tipo || '');
        const monto = Number(r?.monto) || 0;
        const isIngreso = tipo === 'ingreso_estudiante' || tipo.startsWith('ingreso_');
        const isEgreso = tipo === 'pago_tutor_pendiente' || tipo === 'pago_tutor' || tipo.startsWith('pago_') || tipo.startsWith('egreso_');
        if (isIngreso) totalDebe += monto;
        if (isEgreso) totalHaber += monto;
      }

      return res.json({
        fecha_inicio: start,
        fecha_fin: end,
        cantidad_movimientos: rows.length,
        total_debe: totalDebe,
        total_haber: totalHaber,
        neto: totalDebe - totalHaber,
      });
    }

    let q = supabase
      .from('movimientos_dinero')
      .select(
        `id, tipo, monto, estado, fecha_pago, fecha_comprobante, factura_numero, notas, origen, periodo_inicio, periodo_fin,
         tutor_id, curso_id, matricula_id, sesion_id, created_at,
         tutor:tutor_id (nombre),
         curso:curso_id (nombre),
         matricula:matricula_id (id, estudiante:estudiante_id (nombre))`
      )
      .gte('fecha_pago', start)
      .lte('fecha_pago', end)
      .order('fecha_pago', { ascending: true })
      .order('id', { ascending: true });

    if (tutorId) q = q.eq('tutor_id', tutorId);

    const { data, error } = await q;

    if (error) throw error;

    const movimientos = (data ?? []).map((m) => {
      const tipo = String(m?.tipo || '');
      const monto = Number(m?.monto) || 0;

      const isIngreso = tipo === 'ingreso_estudiante' || tipo.startsWith('ingreso_');
      const isEgreso = tipo === 'pago_tutor_pendiente' || tipo === 'pago_tutor' || tipo.startsWith('pago_') || tipo.startsWith('egreso_');

      const comprobante_url = parseNotesForComprobanteUrl(m?.notas);

      return {
        ...m,
        debe: isIngreso ? monto : 0,
        haber: isEgreso ? monto : 0,
        comprobante_url,
      };
    });

    const totalDebe = movimientos.reduce((acc, m) => acc + (Number(m.debe) || 0), 0);
    const totalHaber = movimientos.reduce((acc, m) => acc + (Number(m.haber) || 0), 0);

    res.json({
      fecha_inicio: start,
      fecha_fin: end,
      total_debe: totalDebe,
      total_haber: totalHaber,
      neto: totalDebe - totalHaber,
      movimientos,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST - Crear comprobante de ingreso y vincularlo a movimiento_dinero
router.post('/comprobantes-ingreso', async (req, res) => {
  try {
    const userId = req.user?.id;
    const {
      numero_comprobante,
      monto,
      fecha_comprobante,
      pagador_nombre,
      pagador_contacto,
      detalle,
      movimiento_dinero_id,
      foto_url,
    } = req.body;

    if (!numero_comprobante || !monto || !fecha_comprobante || !pagador_nombre) {
      return res.status(400).json({
        error: 'Campos requeridos: numero_comprobante, monto, fecha_comprobante, pagador_nombre',
      });
    }

    if (!isValidISODate(fecha_comprobante)) {
      return res.status(400).json({ error: 'fecha_comprobante debe ser YYYY-MM-DD' });
    }

    const montoNum = Number(monto);
    if (!Number.isFinite(montoNum) || montoNum <= 0) {
      return res.status(400).json({ error: 'monto debe ser número > 0' });
    }

    const movDineroId = movimiento_dinero_id ? toIntOrNull(movimiento_dinero_id) : null;

    // Intentar crear el espejo en movimientos_financieros (si existe y es permitido)
    // para que el comprobante quede vinculado “como en el diseño original”.
    let movimientoFinancieroId = null;
    let inferredCursoId = null;
    if (movDineroId) {
      try {
        const { data: movDinero } = await supabase
          .from('movimientos_dinero')
          .select('id, curso_id')
          .eq('id', movDineroId)
          .maybeSingle();

        inferredCursoId = movDinero?.curso_id ? toIntOrNull(movDinero.curso_id) : null;

        const conceptoParts = [
          `Ingreso (comprobante ${String(numero_comprobante).trim()})`,
          String(pagador_nombre || '').trim() || null,
        ].filter(Boolean);

        // Usamos una hora “segura” para no caer en el día anterior por TZ.
        const fechaMiddayIso = new Date(`${fecha_comprobante}T12:00:00.000Z`).toISOString();

        const { data: mf, error: mfErr } = await supabase
          .from('movimientos_financieros')
          .insert({
            tipo: 'debe',
            referencia_tabla: 'movimientos_dinero',
            referencia_id: movDineroId,
            monto: montoNum,
            concepto: conceptoParts.join(' - '),
            curso_id: inferredCursoId,
            estado: 'pagado',
            fecha_movimiento: fechaMiddayIso,
            fecha_pago: fechaMiddayIso,
            created_by: userId,
          })
          .select('id')
          .single();

        if (!mfErr && mf?.id) movimientoFinancieroId = mf.id;
      } catch {
        // Si no existe la tabla o RLS no lo permite, seguimos igual con comprobantes_ingresos.
      }
    }

    const { data: comprobante, error } = await supabase
      .from('comprobantes_ingresos')
      .insert({
        numero_comprobante: String(numero_comprobante).trim(),
        monto: montoNum,
        fecha_comprobante,
        pagador_nombre: String(pagador_nombre).trim(),
        pagador_contacto: pagador_contacto ? String(pagador_contacto).trim() : null,
        detalle: detalle ? String(detalle).trim() : null,
        movimiento_dinero_id: movDineroId,
        movimiento_financiero_id: movimientoFinancieroId,
        foto_url: foto_url ? String(foto_url).trim() : null,
        created_by: userId,
      })
      .select()
      .single();

    if (error) throw error;

    // Si hay vínculo, actualizar las notas del movimiento con la URL del comprobante
    if (movDineroId && foto_url) {
      const { data: mov } = await supabase
        .from('movimientos_dinero')
        .select('notas')
        .eq('id', movDineroId)
        .maybeSingle();

      if (mov) {
        const updatedNotas = appendComprobanteUrlToNotes(mov.notas, foto_url);
        await supabase
          .from('movimientos_dinero')
          .update({ notas: updatedNotas })
          .eq('id', movDineroId);
      }
    }

    res.status(201).json(comprobante);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST - Registrar movimiento manual (entrada/salida) con vínculo opcional (tutor/estudiante)
// Body: { direccion:'entrada'|'salida', monto:number, fecha:'YYYY-MM-DD', metodo?, referencia?, detalle?, categoria?, tutor_id?, estudiante_id?, curso_id? }
router.post('/movimientos/manual', async (req, res) => {
  try {
    const body = req.body || {};

    const direccion = String(body.direccion || '').trim().toLowerCase();
    if (!['entrada', 'salida'].includes(direccion)) {
      return res.status(400).json({ error: "direccion debe ser 'entrada' o 'salida'" });
    }

    const monto = Number(body.monto);
    if (!Number.isFinite(monto) || monto <= 0) {
      return res.status(400).json({ error: 'monto debe ser un número > 0' });
    }

    const fecha = String(body.fecha || '').trim();
    if (!isValidISODate(fecha)) {
      return res.status(400).json({ error: 'fecha debe ser YYYY-MM-DD' });
    }

    let tutor_id = toIntOrNull(body.tutor_id);
    const estudiante_id = toIntOrNull(body.estudiante_id);
    let curso_id = toIntOrNull(body.curso_id);

    let matricula_id = null;
    if (estudiante_id) {
      const { data: mats, error: mErr } = await supabase
        .from('matriculas')
        .select('id, curso_id, tutor_id')
        .eq('estudiante_id', String(estudiante_id))
        .order('id', { ascending: false })
        .limit(1);
      if (mErr) throw mErr;
      const m0 = mats?.[0] ?? null;
      matricula_id = m0?.id ?? null;
      if (!curso_id && m0?.curso_id) curso_id = toIntOrNull(m0.curso_id);
      if (!tutor_id && m0?.tutor_id) tutor_id = toIntOrNull(m0.tutor_id);
    }

    // Inferir curso_id desde tutor si no viene y no hay matrícula
    if (!curso_id && tutor_id) {
      const { data: cursos, error: cErr } = await supabase
        .from('cursos')
        .select('id')
        .eq('tutor_id', String(tutor_id))
        .order('id', { ascending: false })
        .limit(1);
      if (cErr) throw cErr;
      curso_id = toIntOrNull(cursos?.[0]?.id ?? null);
    }

    // Fallback: si aún no hay curso_id, usar el curso más reciente (transparente en notas)
    let autoCurso = false;
    if (!curso_id) {
      const { data: cursos, error: cErr } = await supabase
        .from('cursos')
        .select('id')
        .order('id', { ascending: false })
        .limit(1);
      if (cErr) throw cErr;
      const fallbackId = toIntOrNull(cursos?.[0]?.id ?? null);
      if (fallbackId) {
        curso_id = fallbackId;
        autoCurso = true;
      }
    }

    const metodo = body.metodo ? String(body.metodo).trim().toLowerCase() : null;
    const referencia = body.referencia ? String(body.referencia).trim() : null;
    const detalle = body.detalle ? String(body.detalle).trim() : null;
    const categoria = body.categoria ? String(body.categoria).trim() : null;
    const a_nombre_de = body.a_nombre_de ? String(body.a_nombre_de).trim() : null;

    const tipo = direccion === 'entrada' ? 'ingreso_manual' : 'egreso_manual';

    const notasParts = [
      'MANUAL',
      autoCurso ? 'AUTO_CURSO:1' : null,
      a_nombre_de ? `A_NOMBRE_DE:${a_nombre_de}` : null,
      categoria ? `CATEGORIA:${categoria}` : null,
      metodo ? `METODO:${metodo}` : null,
      detalle ? `DETALLE:${detalle}` : null,
      estudiante_id ? `ESTUDIANTE_ID:${estudiante_id}` : null,
      tutor_id ? `TUTOR_ID:${tutor_id}` : null,
    ].filter(Boolean);

    const insert = {
      tipo,
      monto,
      estado: 'completado',
      fecha_pago: fecha,
      fecha_comprobante: fecha,
      factura_numero: referencia,
      notas: notasParts.join(' | '),
      origen: 'manual',
      periodo_inicio: null,
      periodo_fin: null,
      tutor_id: tutor_id ? String(tutor_id) : null,
      curso_id: curso_id ? String(curso_id) : null,
      matricula_id: matricula_id ? String(matricula_id) : null,
      sesion_id: null,
    };

    const { data, error } = await supabase
      .from('movimientos_dinero')
      .insert(insert)
      .select(
        `id, tipo, monto, estado, fecha_pago, fecha_comprobante, factura_numero, notas, origen, periodo_inicio, periodo_fin,
         tutor_id, curso_id, matricula_id, sesion_id, created_at,
         tutor:tutor_id (nombre),
         curso:curso_id (nombre),
         matricula:matricula_id (id, estudiante:estudiante_id (nombre))`
      )
      .single();
    if (error) throw error;

    const comprobante_url = parseNotesForComprobanteUrl(data?.notas);
    const tipoNorm = String(data?.tipo || '');
    const montoNorm = Number(data?.monto) || 0;
    const isIngreso = tipoNorm === 'ingreso_estudiante' || tipoNorm.startsWith('ingreso_');
    const isEgreso = tipoNorm === 'pago_tutor_pendiente' || tipoNorm === 'pago_tutor' || tipoNorm.startsWith('pago_') || tipoNorm.startsWith('egreso_');

    res.status(201).json({
      ...data,
      debe: isIngreso ? montoNorm : 0,
      haber: isEgreso ? montoNorm : 0,
      comprobante_url,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST - Subir comprobante (imagen/PDF) para un movimiento
// multipart/form-data: file
router.post('/movimientos/:id/comprobante', (req, res) => {
  upload.single('file')(req, res, async (err) => {
    if (err) {
      return res.status(400).json({ error: err.message || 'Archivo inválido' });
    }

    try {
      const id = String(req.params.id || '').trim();
      if (!id) return res.status(400).json({ error: 'id requerido' });
      if (!req.file) return res.status(400).json({ error: 'Debe adjuntar un archivo (file)' });

      const host = req.get('host');
      const proto = req.headers['x-forwarded-proto'] ? String(req.headers['x-forwarded-proto']).split(',')[0] : req.protocol;
      const publicUrl = `${proto}://${host}/uploads/comprobantes/${encodeURIComponent(req.file.filename)}`;

      // Traer notas actuales
      const { data: cur, error: curErr } = await supabase
        .from('movimientos_dinero')
        .select('id, notas')
        .eq('id', id)
        .maybeSingle();
      if (curErr) throw curErr;
      if (!cur) return res.status(404).json({ error: 'Movimiento no encontrado' });

      const patchedNotes = appendComprobanteUrlToNotes(cur.notas, publicUrl);

      const upd = await supabase
        .from('movimientos_dinero')
        .update({ notas: patchedNotes, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (upd.error) throw upd.error;

      res.status(201).json({ id, comprobante_url: publicUrl });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
});

// POST - Aplicar una URL de comprobante a múltiples movimientos (sin subir múltiples veces)
// Body JSON: { ids: number[], comprobante_url: string }
router.post('/movimientos/comprobante/bulk', async (req, res) => {
  try {
    const body = req.body || {};
    const idsRaw = Array.isArray(body.ids) ? body.ids : [];
    const comprobanteUrl = String(body.comprobante_url || '').trim();

    if (!comprobanteUrl) {
      return res.status(400).json({ error: 'comprobante_url requerido' });
    }
    if (idsRaw.length === 0) {
      return res.status(400).json({ error: 'ids requerido (array)'});
    }

    const ids = idsRaw
      .map((v) => toIntOrNull(v))
      .filter((n) => Number.isFinite(n) && n > 0);

    const uniqIds = Array.from(new Set(ids));
    if (uniqIds.length === 0) {
      return res.status(400).json({ error: 'ids debe contener enteros válidos' });
    }
    if (uniqIds.length > 200) {
      return res.status(400).json({ error: 'ids demasiado grande (máximo 200)' });
    }

    const { data: rows, error: selErr } = await supabase
      .from('movimientos_dinero')
      .select('id, notas')
      .in('id', uniqIds);
    if (selErr) throw selErr;

    const byId = new Map((rows || []).map((r) => [Number(r.id), r]));
    const missing = uniqIds.filter((id) => !byId.has(id));
    if (missing.length > 0) {
      return res.status(404).json({ error: 'Algunos movimientos no existen', missing_ids: missing });
    }

    let updated = 0;
    for (const id of uniqIds) {
      const cur = byId.get(id);
      const patchedNotes = appendComprobanteUrlToNotes(cur?.notas, comprobanteUrl);
      const { error: updErr } = await supabase
        .from('movimientos_dinero')
        .update({ notas: patchedNotes, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (updErr) throw updErr;
      updated += 1;
    }

    res.json({ updated, comprobante_url: comprobanteUrl, ids: uniqIds });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET - Resumen agregado de deudas de estudiantes (ingreso_estudiante pendiente)
router.get('/pendientes/resumen-estudiantes', async (_req, res) => {
  try {
    const { data: estudiantes, error: estError } = await supabase
      .from('estudiantes')
      .select('id, nombre')
      .order('nombre', { ascending: true });
    if (estError) throw estError;

    // Traer movimientos pendientes y mapear a estudiante via matrícula
    const { data: movs, error: movsError } = await supabase
      .from('movimientos_dinero')
      .select('monto, matricula:matricula_id (estudiante_id)')
      .eq('tipo', 'ingreso_estudiante')
      .eq('estado', 'pendiente');
    if (movsError) throw movsError;

    const totalsByEst = new Map();
    for (const m of movs || []) {
      const estId = m?.matricula?.estudiante_id;
      if (!estId) continue;
      const prev = totalsByEst.get(estId) || 0;
      totalsByEst.set(estId, prev + (Number(m.monto) || 0));
    }

    const rows = (estudiantes || []).map(e => ({
      estudiante_id: e.id,
      estudiante_nombre: e.nombre,
      total_pendiente: totalsByEst.get(e.id) || 0
    }));

    res.json({ estudiantes: rows });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET - Detalle de pendientes por estudiante
// Query params: estudiante_id (requerido), fecha_inicio, fecha_fin
router.get('/pendientes/detalle-estudiante', async (req, res) => {
  try {
    const { estudiante_id, fecha_inicio, fecha_fin } = req.query;
    if (!estudiante_id) {
      return res.status(400).json({ error: 'Query param requerido: estudiante_id' });
    }
    if (fecha_inicio && !isValidISODate(String(fecha_inicio))) {
      return res.status(400).json({ error: 'fecha_inicio debe ser YYYY-MM-DD' });
    }
    if (fecha_fin && !isValidISODate(String(fecha_fin))) {
      return res.status(400).json({ error: 'fecha_fin debe ser YYYY-MM-DD' });
    }

    const { data: matriculas, error: matError } = await supabase
      .from('matriculas')
      .select('id')
      .eq('estudiante_id', String(estudiante_id));
    if (matError) throw matError;

    const matriculaIds = (matriculas || []).map(m => m.id).filter(Boolean);
    if (matriculaIds.length === 0) {
      return res.json({
        estudiante_id: String(estudiante_id),
        fecha_inicio: fecha_inicio ? String(fecha_inicio) : null,
        fecha_fin: fecha_fin ? String(fecha_fin) : null,
        cantidad_movimientos: 0,
        total_monto: 0,
        movimientos: []
      });
    }

    let q = supabase
      .from('movimientos_dinero')
      .select('id,curso_id,matricula_id,fecha_pago,monto,estado,tipo,origen,periodo_inicio,periodo_fin,curso:curso_id (nombre)')
      .eq('tipo', 'ingreso_estudiante')
      .eq('estado', 'pendiente')
      .in('matricula_id', matriculaIds);
    if (fecha_inicio) q = q.gte('fecha_pago', String(fecha_inicio));
    if (fecha_fin) q = q.lte('fecha_pago', String(fecha_fin));

    const { data: movimientos, error: movErr } = await q;
    if (movErr) throw movErr;

    const total_monto = (movimientos || []).reduce((acc, m) => acc + (Number(m.monto) || 0), 0);
    res.json({
      estudiante_id: String(estudiante_id),
      fecha_inicio: fecha_inicio ? String(fecha_inicio) : null,
      fecha_fin: fecha_fin ? String(fecha_fin) : null,
      cantidad_movimientos: (movimientos || []).length,
      total_monto,
      movimientos: movimientos || []
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST - Registrar pago de estudiante (marca ingresos pendientes como completados)
// Body: estudiante_id (requerido), fecha_inicio, fecha_fin, metodo ('sinpe'|'transferencia'|'efectivo'), referencia, fecha_comprobante
router.post('/ingresos/liquidar-estudiante', async (req, res) => {
  try {
    const { estudiante_id, fecha_inicio, fecha_fin, metodo, referencia, fecha_comprobante } = req.body || {};

    if (!estudiante_id) {
      return res.status(400).json({ error: 'Campo requerido: estudiante_id' });
    }
    if (fecha_inicio && !isValidISODate(String(fecha_inicio))) {
      return res.status(400).json({ error: 'fecha_inicio debe ser YYYY-MM-DD' });
    }
    if (fecha_fin && !isValidISODate(String(fecha_fin))) {
      return res.status(400).json({ error: 'fecha_fin debe ser YYYY-MM-DD' });
    }
    if (fecha_comprobante && !isValidISODate(String(fecha_comprobante))) {
      return res.status(400).json({ error: 'fecha_comprobante debe ser YYYY-MM-DD' });
    }

    const metodoNorm = String(metodo || '').trim().toLowerCase();
    const metodoOk = ['sinpe', 'transferencia', 'efectivo'].includes(metodoNorm);
    if (!metodoOk) {
      return res.status(400).json({ error: "metodo debe ser 'sinpe', 'transferencia' o 'efectivo'" });
    }

    const { data: matriculas, error: matError } = await supabase
      .from('matriculas')
      .select('id')
      .eq('estudiante_id', String(estudiante_id));
    if (matError) throw matError;
    const matriculaIds = (matriculas || []).map(m => m.id).filter(Boolean);
    if (matriculaIds.length === 0) {
      return res.status(409).json({ error: 'El estudiante no tiene matrículas asociadas' });
    }

    let q = supabase
      .from('movimientos_dinero')
      .select('id,monto')
      .eq('tipo', 'ingreso_estudiante')
      .eq('estado', 'pendiente')
      .in('matricula_id', matriculaIds);
    if (fecha_inicio) q = q.gte('fecha_pago', String(fecha_inicio));
    if (fecha_fin) q = q.lte('fecha_pago', String(fecha_fin));

    const { data: movimientos, error: movErr } = await q;
    if (movErr) throw movErr;
    if (!movimientos || movimientos.length === 0) {
      return res.status(409).json({ error: 'No hay ingresos pendientes para marcar como pagados con esos filtros' });
    }

    const ids = movimientos.map(m => m.id);
    const patch = {
      estado: 'completado',
      updated_at: new Date().toISOString(),
      ...(fecha_comprobante ? { fecha_comprobante: String(fecha_comprobante) } : {}),
      ...(referencia ? { factura_numero: String(referencia) } : {}),
      notas: `PAGO_ESTUDIANTE:${metodoNorm}${referencia ? `:${String(referencia)}` : ''}`
    };

    const upd = await supabase
      .from('movimientos_dinero')
      .update(patch)
      .in('id', ids);
    if (upd.error) throw upd.error;

    const total_monto = movimientos.reduce((acc, m) => acc + (Number(m.monto) || 0), 0);
    res.status(201).json({
      estudiante_id: String(estudiante_id),
      movimiento_ids: ids,
      movimientos_actualizados: ids.length,
      total_monto,
      metodo: metodoNorm,
      referencia: referencia ? String(referencia) : null,
      fecha_comprobante: fecha_comprobante ? String(fecha_comprobante) : null
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST - Liquidar pendientes y crear un pago
// Body: tutor_id (requerido), fecha_inicio, fecha_fin, descripcion, estado
router.post('/liquidar', async (req, res) => {
  try {
    const { tutor_id, fecha_inicio, fecha_fin, descripcion, estado } = req.body;
    const userId = req.user?.id;

    if (!tutor_id) {
      return res.status(400).json({ error: 'Campo requerido: tutor_id' });
    }
    if (fecha_inicio && !isValidISODate(String(fecha_inicio))) {
      return res.status(400).json({ error: 'fecha_inicio debe ser YYYY-MM-DD' });
    }
    if (fecha_fin && !isValidISODate(String(fecha_fin))) {
      return res.status(400).json({ error: 'fecha_fin debe ser YYYY-MM-DD' });
    }

    const baseSelect = 'id,tutor_id,curso_id,matricula_id,fecha_pago,monto,estado,tipo';
    let supportsPagoId = true;

    let q = supabase
      .from('movimientos_dinero')
      .select(`${baseSelect},pago_id`)
      .eq('tutor_id', String(tutor_id))
      .eq('tipo', 'pago_tutor_pendiente')
      .eq('estado', 'pendiente');

    if (fecha_inicio) q = q.gte('fecha_pago', String(fecha_inicio));
    if (fecha_fin) q = q.lte('fecha_pago', String(fecha_fin));
    q = q.is('pago_id', null);

    let { data: movimientos, error } = await q;
    if (error && isMissingColumnError(error, 'pago_id')) {
      supportsPagoId = false;
      let retry = supabase
        .from('movimientos_dinero')
        .select(baseSelect)
        .eq('tutor_id', String(tutor_id))
        .eq('tipo', 'pago_tutor_pendiente')
        .eq('estado', 'pendiente');

      if (fecha_inicio) retry = retry.gte('fecha_pago', String(fecha_inicio));
      if (fecha_fin) retry = retry.lte('fecha_pago', String(fecha_fin));

      const res2 = await retry;
      movimientos = res2.data;
      error = res2.error;
    }

    if (error) throw error;

    if (!movimientos || movimientos.length === 0) {
      return res.status(409).json({ error: 'No hay movimientos pendientes para liquidar con esos filtros' });
    }

    const monto_total = movimientos.reduce((acc, m) => acc + (Number(m.monto) || 0), 0);
    const cantidad_clases = movimientos.length;

    const baseInsert = {
      tutor_id: String(tutor_id),
      cantidad_clases,
      monto: monto_total,
      descripcion: descripcion || 'Liquidacion de pendientes',
      created_by: userId,
      estado: estado || 'pendiente'
    };

    let pago;
    {
      const withPeriodo = {
        ...baseInsert,
        ...(fecha_inicio ? { periodo_inicio: String(fecha_inicio) } : {}),
        ...(fecha_fin ? { periodo_fin: String(fecha_fin) } : {})
      };

      const attempt = await supabase
        .from('pagos')
        .insert(withPeriodo)
        .select(`*, tutores:tutor_id (nombre)`)
        .single();

      if (attempt.error && (isMissingColumnError(attempt.error, 'periodo_inicio') || isMissingColumnError(attempt.error, 'periodo_fin'))) {
        const retry = await supabase
          .from('pagos')
          .insert(baseInsert)
          .select(`*, tutores:tutor_id (nombre)`)
          .single();
        if (retry.error) throw retry.error;
        pago = retry.data;
      } else {
        if (attempt.error) throw attempt.error;
        pago = attempt.data;
      }
    }

    const ids = movimientos.map(m => m.id);
    const updatePatch = {
      estado: 'completado',
      updated_at: new Date().toISOString()
    };
    if (supportsPagoId) {
      updatePatch.pago_id = pago.id;
    }

    const upd = await supabase
      .from('movimientos_dinero')
      .update(updatePatch)
      .in('id', ids);
    if (upd.error) throw upd.error;

    res.status(201).json({
      pago: {
        ...pago,
        tutor_nombre: pago.tutores?.nombre
      },
      movimientos_actualizados: ids.length,
      supports_pago_id: supportsPagoId
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST - Calcular pago automático por clases dadas
router.post('/calcular', async (req, res) => {
  try {
    const { tutor_id, fecha_inicio, fecha_fin } = req.body;
    
    if (!tutor_id) {
      return res.status(400).json({ error: 'Campo requerido: tutor_id' });
    }

    // Construir query con filtros opcionales
    let query = supabase
      .from('clases')
      .select(`
        id,
        fecha,
        hora_inicio,
        hora_fin,
        matriculas!inner (
          tutor_id,
          tutores (tarifa_por_hora, nombre)
        )
      `)
      .eq('matriculas.tutor_id', tutor_id)
      .eq('estado', 'programada');
    
    if (fecha_inicio) {
      query = query.gte('fecha', fecha_inicio);
    }
    
    if (fecha_fin) {
      query = query.lte('fecha', fecha_fin);
    }

    const { data: clases, error } = await query;
    
    if (error) throw error;

    // Calcular monto total
    let monto_total = 0;
    const clases_procesadas = clases.map(clase => {
      const [hi, mi] = clase.hora_inicio.split(':').map(Number);
      const [hf, mf] = clase.hora_fin.split(':').map(Number);
      const duracion = ((hf - hi) + (mf - mi) / 60);
      const tarifa = clase.matriculas?.tutores?.tarifa_por_hora || 0;
      monto_total += duracion * tarifa;
      
      return {
        ...clase,
        tarifa_por_hora: tarifa,
        tutor_nombre: clase.matriculas?.tutores?.nombre
      };
    });

    res.json({
      tutor_id,
      cantidad_clases: clases.length,
      monto_total,
      clases_detalles: clases_procesadas
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT - Actualizar estado de pago
router.put('/:id', async (req, res) => {
  try {
    const { estado } = req.body;
    const userId = req.user?.id;
    
    const { data: pago, error } = await supabase
      .from('pagos')
      .update({
        estado,
        updated_by: userId,
        updated_at: new Date().toISOString()
      })
      .eq('id', req.params.id)
      .select(`
        *,
        tutores:tutor_id (nombre)
      `)
      .single();
    
    if (error) throw error;
    
    const formatted = {
      ...pago,
      tutor_nombre: pago.tutores?.nombre
    };
    
    res.json(formatted);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;

