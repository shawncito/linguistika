import express from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { supabase } from '../supabase.js';
import { requireRoles } from '../middleware/roles.js';
import { schemaErrorPayload } from '../utils/schemaErrors.js';

const router = express.Router();

function sendSchemaError(res, error) {
  const payload = schemaErrorPayload(error);
  if (payload) return res.status(400).json(payload);
  return res.status(500).json({ error: error.message });
}

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
    return sendSchemaError(res, error);
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
    return sendSchemaError(res, error);
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
    return sendSchemaError(res, error);
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
    return sendSchemaError(res, error);
  }
});

// GET - Libro diario (control diario) desde movimientos_dinero
// Query: fecha (YYYY-MM-DD) o fecha_inicio/fecha_fin
router.get('/libro-diario', async (req, res) => {
  try {
    const { fecha, fecha_inicio, fecha_fin, only_totals, tutor_id, incluir_pendientes } = req.query;

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

    const incluirPendientes = ['1', 'true', 'yes'].includes(String(incluir_pendientes || '').trim().toLowerCase());

    if (onlyTotals) {
      let q = supabase
        .from('movimientos_dinero')
        .select('tipo, monto, estado')
        .gte('fecha_pago', start)
        .lte('fecha_pago', end);

      if (tutorId) q = q.eq('tutor_id', tutorId);

      // Por defecto, el libro diario representa movimientos REALES (completados/verificados).
      if (!incluirPendientes) {
        // Incluir también estado null por compatibilidad histórica.
        q = q.or('estado.is.null,estado.in.(completado,verificado)');
      }

      const { data, error } = await q;
      if (error) throw error;

      const rows = data ?? [];
      let totalDebe = 0;
      let totalHaber = 0;

      for (const r of rows) {
        const tipo = String(r?.tipo || '');
        const monto = Number(r?.monto) || 0;
        const isIngreso = incluirPendientes ? (tipo === 'ingreso_estudiante' || tipo.startsWith('ingreso_')) : isRealIngresoTipo(tipo);
        const isEgreso = tipo === 'pago_tutor_pendiente' || tipo === 'pago_tutor' || tipo.startsWith('pago_') || tipo.startsWith('egreso_');

        if (!incluirPendientes && !isRealEstado(r?.estado)) continue;
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

    if (!incluirPendientes) {
      q = q.or('estado.is.null,estado.in.(completado,verificado)');
    }

    const { data, error } = await q;

    if (error) throw error;

    const movimientos = (data ?? []).map((m) => {
      const tipo = String(m?.tipo || '');
      const monto = Number(m?.monto) || 0;

      const isIngreso = incluirPendientes ? (tipo === 'ingreso_estudiante' || tipo.startsWith('ingreso_')) : isRealIngresoTipo(tipo);
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
      incluir_pendientes: incluirPendientes,
      movimientos,
    });
  } catch (error) {
    return sendSchemaError(res, error);
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
    return sendSchemaError(res, error);
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
    const sesion_id = toIntOrNull(body.sesion_id);

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
      sesion_id ? `SESION_ID:${sesion_id}` : null,
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
      sesion_id: sesion_id ? String(sesion_id) : null,
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
    return sendSchemaError(res, error);
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
      return sendSchemaError(res, error);
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
    return sendSchemaError(res, error);
  }
});

// GET - Resumen agregado de deudas de estudiantes (ingreso_estudiante pendiente)
router.get('/pendientes/resumen-estudiantes', async (_req, res) => {
  try {
    const { data: estudiantes, error: estError } = await supabase
      .from('estudiantes')
      .select('id, nombre, matricula_grupo_id, encargado_id')
      .order('nombre', { ascending: true });
    if (estError) throw estError;

    const { data: estudiantesBulk, error: bulkErr } = await supabase
      .from('estudiantes_bulk')
      .select('id, nombre')
      .order('nombre', { ascending: true });
    if (bulkErr) throw bulkErr;

    const { data: bulkLinks, error: bulkLinksErr } = await supabase
      .from('estudiantes_en_grupo')
      .select('estudiante_bulk_id, matricula_grupo_id');
    if (bulkLinksErr) throw bulkLinksErr;

    const bulkToGrupo = new Map((bulkLinks || []).map((l) => [Number(l.estudiante_bulk_id), l.matricula_grupo_id ?? null]));

    const groupMembers = new Map();
    const studentToGrupo = new Map();
    for (const e of estudiantes || []) {
      const gid = e.matricula_grupo_id ?? null;
      studentToGrupo.set(Number(e.id), gid ?? null);
      if (!gid) continue;
      if (!groupMembers.has(gid)) groupMembers.set(gid, { normales: new Set(), bulk: new Set() });
      groupMembers.get(gid).normales.add(Number(e.id));
    }
    for (const [bulkId, gid] of bulkToGrupo.entries()) {
      if (!gid) continue;
      if (!groupMembers.has(gid)) groupMembers.set(gid, { normales: new Set(), bulk: new Set() });
      groupMembers.get(gid).bulk.add(Number(bulkId));
    }

    const encargadoIds = Array.from(new Set((estudiantes || [])
      .map((e) => Number(e?.encargado_id))
      .filter((id) => Number.isFinite(id) && id > 0)));

    let saldoMap = new Map();
    if (encargadoIds.length) {
      const { data: saldos, error: sErr } = await supabase
        .from('tesoreria_saldos_encargados_v1')
        .select('encargado_id, saldo_a_favor')
        .in('encargado_id', encargadoIds);
      if (!sErr) {
        saldoMap = new Map((saldos || []).map((s) => [Number(s.encargado_id), Number(s.saldo_a_favor) || 0]));
      }
    }

    let encargadoMap = new Map();
    if (encargadoIds.length) {
      const { data: encargadosRows, error: eErr } = await supabase
        .from('encargados')
        .select('id, nombre')
        .in('id', encargadoIds);
      if (!eErr) {
        encargadoMap = new Map((encargadosRows || []).map((r) => [Number(r.id), r?.nombre || null]));
      }
    }

    // Traer movimientos pendientes y mapear a estudiante via matrícula
    const { data: movs, error: movsError } = await supabase
      .from('movimientos_dinero')
      .select('monto, origen, curso:curso_id (tipo_pago), matricula:matricula_id (estudiante_id, estudiante_ids, grupo_id)')
      .eq('tipo', 'ingreso_estudiante')
      .eq('estado', 'pendiente');
    if (movsError) throw movsError;

    const totalsByEst = new Map();
    const totalsByBulk = new Map();
    const normalIds = new Set((estudiantes || []).map((e) => Number(e.id)));
    const bulkIds = new Set((estudiantesBulk || []).map((e) => Number(e.id)));
    for (const m of movs || []) {
      const directId = m?.matricula?.estudiante_id;
      const groupIds = Array.isArray(m?.matricula?.estudiante_ids) ? m.matricula.estudiante_ids : [];
      const ids = (directId ? [directId] : groupIds).filter((id) => Number.isFinite(Number(id)) && Number(id) > 0);
      const grupoId = m?.matricula?.grupo_id ?? null;

      if (grupoId) {
        const group = groupMembers.get(grupoId);
        if (group) {
          for (const id of group.normales) {
            const prev = totalsByEst.get(id) || 0;
            totalsByEst.set(id, prev + (Number(m.monto) || 0));
          }
          for (const id of group.bulk) {
            const prev = totalsByBulk.get(id) || 0;
            totalsByBulk.set(id, prev + (Number(m.monto) || 0));
          }
          continue;
        }
      }

      if (!directId && groupIds.length > 0) {
        const groupIdsFromStudents = Array.from(new Set(
          groupIds
            .map((id) => studentToGrupo.get(Number(id)))
            .filter((gid) => Number.isFinite(Number(gid)) && Number(gid) > 0)
        ));
        if (groupIdsFromStudents.length === 1) {
          const inferredGroupId = groupIdsFromStudents[0];
          const group = groupMembers.get(inferredGroupId);
          if (group) {
            for (const id of group.normales) {
              const prev = totalsByEst.get(id) || 0;
              totalsByEst.set(id, prev + (Number(m.monto) || 0));
            }
            for (const id of group.bulk) {
              const prev = totalsByBulk.get(id) || 0;
              totalsByBulk.set(id, prev + (Number(m.monto) || 0));
            }
            continue;
          }
        }
      }

      if (ids.length > 0) {
        for (const id of ids) {
          const estId = Number(id);
          if (normalIds.has(estId)) {
            const prev = totalsByEst.get(estId) || 0;
            totalsByEst.set(estId, prev + (Number(m.monto) || 0));
            continue;
          }
          if (bulkIds.has(estId)) {
            const prev = totalsByBulk.get(estId) || 0;
            totalsByBulk.set(estId, prev + (Number(m.monto) || 0));
          }
        }
        continue;
      }
    }

    const rows = [
      ...(estudiantes || []).map(e => ({
        estudiante_id: e.id,
        estudiante_bulk_id: null,
        estudiante_nombre: e.nombre,
        matricula_grupo_id: e.matricula_grupo_id ?? null,
        encargado_id: e.encargado_id ?? null,
        encargado_nombre: e.encargado_id ? (encargadoMap.get(Number(e.encargado_id)) || null) : null,
        saldo_a_favor: e.encargado_id ? (saldoMap.get(Number(e.encargado_id)) || 0) : 0,
        total_pendiente: totalsByEst.get(e.id) || 0,
      })),
      ...(estudiantesBulk || []).map(e => ({
        estudiante_id: null,
        estudiante_bulk_id: e.id,
        estudiante_nombre: e.nombre,
        matricula_grupo_id: bulkToGrupo.get(Number(e.id)) ?? null,
        encargado_id: null,
        encargado_nombre: null,
        saldo_a_favor: 0,
        total_pendiente: totalsByBulk.get(Number(e.id)) || 0,
      })),
    ];

    res.json({ estudiantes: rows });
  } catch (error) {
    return sendSchemaError(res, error);
  }
});

// GET - Detalle de pendientes por estudiante
// Query params: estudiante_id (requerido), fecha_inicio, fecha_fin
router.get('/pendientes/detalle-estudiante', async (req, res) => {
  try {
    const { estudiante_id, estudiante_bulk_id, fecha_inicio, fecha_fin } = req.query;
    if (!estudiante_id && !estudiante_bulk_id) {
      return res.status(400).json({ error: 'Query param requerido: estudiante_id o estudiante_bulk_id' });
    }
    if (fecha_inicio && !isValidISODate(String(fecha_inicio))) {
      return res.status(400).json({ error: 'fecha_inicio debe ser YYYY-MM-DD' });
    }
    if (fecha_fin && !isValidISODate(String(fecha_fin))) {
      return res.status(400).json({ error: 'fecha_fin debe ser YYYY-MM-DD' });
    }

    let grupoId = null;
    if (estudiante_id) {
      const { data: studentRow, error: studentErr } = await supabase
        .from('estudiantes')
        .select('id, matricula_grupo_id')
        .eq('id', String(estudiante_id))
        .maybeSingle();
      if (studentErr) throw studentErr;
      grupoId = studentRow?.matricula_grupo_id ?? null;
    }
    if (!grupoId && estudiante_bulk_id) {
      const { data: linkRow, error: linkErr } = await supabase
        .from('estudiantes_en_grupo')
        .select('matricula_grupo_id')
        .eq('estudiante_bulk_id', String(estudiante_bulk_id))
        .maybeSingle();
      if (linkErr) throw linkErr;
      grupoId = linkRow?.matricula_grupo_id ?? null;
    }

    let groupRepresentativeId = null;
    if (grupoId) {
      const { data: groupMembers, error: groupErr } = await supabase
        .from('estudiantes')
        .select('id')
        .eq('matricula_grupo_id', grupoId);
      if (groupErr) throw groupErr;
      if (groupMembers?.length) groupRepresentativeId = Number(groupMembers[0].id) || null;
    }

    let matriculas = [];
    if (estudiante_id) {
      const { data: matRows, error: matError } = await supabase
        .from('matriculas')
        .select('id, curso_id, tutor_id')
        .eq('estudiante_id', String(estudiante_id));
      if (matError) throw matError;
      matriculas = matRows || [];
    }

    const groupMatTarget = estudiante_id ? Number(estudiante_id) : groupRepresentativeId;
    let groupMatriculas = [];
    if (groupMatTarget != null) {
      let groupRows = null;
      let groupMatErr = null;

      ({ data: groupRows, error: groupMatErr } = await supabase
        .from('matriculas')
        .select('id, curso_id, tutor_id')
        .contains('estudiante_ids', [groupMatTarget]));

      if (groupMatErr && !isMissingColumnError(groupMatErr)) {
        ({ data: groupRows, error: groupMatErr } = await supabase
          .from('matriculas')
          .select('id, curso_id, tutor_id')
          .filter('estudiante_ids', 'cs', JSON.stringify([groupMatTarget])));
      }

      if (groupMatErr && !isMissingColumnError(groupMatErr)) {
        ({ data: groupRows, error: groupMatErr } = await supabase
          .from('matriculas')
          .select('id, curso_id, tutor_id')
          .filter('estudiante_ids', 'cs', `{${groupMatTarget}}`));
      }

      if (groupMatErr && !isMissingColumnError(groupMatErr)) throw groupMatErr;
      groupMatriculas = groupRows || [];
    }

    const matriculaIds = Array.from(new Set([...(matriculas || []), ...groupMatriculas].map(m => m.id).filter(Boolean)));
    if (matriculaIds.length === 0) {
      return res.json({
        estudiante_id: estudiante_id ? String(estudiante_id) : null,
        estudiante_bulk_id: estudiante_bulk_id ? String(estudiante_bulk_id) : null,
        fecha_inicio: fecha_inicio ? String(fecha_inicio) : null,
        fecha_fin: fecha_fin ? String(fecha_fin) : null,
        cantidad_movimientos: 0,
        total_monto: 0,
        movimientos: []
      });
    }

    let q = supabase
      .from('movimientos_dinero')
      .select('id,curso_id,matricula_id,fecha_pago,monto,estado,tipo,origen,periodo_inicio,periodo_fin,curso:curso_id (nombre),matricula:matricula_id (estudiante_ids,curso_id,tutor_id)')
      .eq('tipo', 'ingreso_estudiante')
      .eq('estado', 'pendiente')
      .in('matricula_id', matriculaIds);
    if (fecha_inicio) q = q.gte('fecha_pago', String(fecha_inicio));
    if (fecha_fin) q = q.lte('fecha_pago', String(fecha_fin));

    const { data: movimientos, error: movErr } = await q;
    if (movErr) throw movErr;

    const uniq = new Map();
    for (const m of movimientos || []) {
      if (!m?.id || uniq.has(m.id)) continue;
      uniq.set(m.id, { ...m, monto: Number(m.monto) || 0 });
    }

    const normalizedMovs = Array.from(uniq.values());

    const total_monto = normalizedMovs.reduce((acc, m) => acc + (Number(m.monto) || 0), 0);
    res.json({
      estudiante_id: estudiante_id ? String(estudiante_id) : null,
      estudiante_bulk_id: estudiante_bulk_id ? String(estudiante_bulk_id) : null,
      fecha_inicio: fecha_inicio ? String(fecha_inicio) : null,
      fecha_fin: fecha_fin ? String(fecha_fin) : null,
      cantidad_movimientos: normalizedMovs.length,
      total_monto,
      movimientos: normalizedMovs
    });
  } catch (error) {
    return sendSchemaError(res, error);
  }
});

// GET - Sesiones pendientes para conciliar (ingreso_estudiante pendiente con sesion_id)
// Query params: q?, tutor_id?, estudiante_id?, fecha_inicio?, fecha_fin?, limit?
router.get('/pendientes/sesiones', async (req, res) => {
  try {
    const { q, tutor_id, estudiante_id, fecha_inicio, fecha_fin, limit } = req.query;

    const tutorId = tutor_id ? toIntOrNull(tutor_id) : null;
    if (tutor_id && (tutorId === null || tutorId <= 0)) {
      return res.status(400).json({ error: 'tutor_id debe ser un entero válido' });
    }

    const estudianteId = estudiante_id ? toIntOrNull(estudiante_id) : null;
    if (estudiante_id && (estudianteId === null || estudianteId <= 0)) {
      return res.status(400).json({ error: 'estudiante_id debe ser un entero válido' });
    }

    if (fecha_inicio && !isValidISODate(String(fecha_inicio))) {
      return res.status(400).json({ error: 'fecha_inicio debe ser YYYY-MM-DD' });
    }
    if (fecha_fin && !isValidISODate(String(fecha_fin))) {
      return res.status(400).json({ error: 'fecha_fin debe ser YYYY-MM-DD' });
    }

    const limitN = clampInt(limit ?? 30, 1, 100) ?? 30;

    let matriculaIds = null;
    if (estudianteId) {
      const { data: matriculas, error: matError } = await supabase
        .from('matriculas')
        .select('id')
        .eq('estudiante_id', String(estudianteId));
      if (matError) throw matError;
      matriculaIds = (matriculas || []).map((m) => m.id).filter(Boolean);
      if (!matriculaIds.length) {
        return res.json({
          q: q ? String(q) : null,
          tutor_id: tutorId,
          estudiante_id: estudianteId,
          limit: limitN,
          supports_detalles: true,
          items: [],
        });
      }
    }

    const normalizeSearch = (value) =>
      String(value || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '')
        .trim();

    const qNorm = q ? normalizeSearch(String(q)) : '';

    let supportsDetalles = true;
    let query = supabase
      .from('movimientos_dinero')
      .select(
        `id, sesion_id, tutor_id, curso_id, matricula_id, fecha_pago, monto, estado, tipo,
         tutor:tutor_id (nombre),
         curso:curso_id (nombre),
         matricula:matricula_id (id, estudiante_id, estudiante:estudiante_id (nombre)),
         sesion:sesion_id (id, fecha, hora_inicio, hora_fin, estado)`
      )
      .eq('tipo', 'ingreso_estudiante')
      .eq('estado', 'pendiente')
      .not('sesion_id', 'is', null)
      .order('fecha_pago', { ascending: false })
      .limit(limitN);

    if (tutorId) query = query.eq('tutor_id', tutorId);
    if (fecha_inicio) query = query.gte('fecha_pago', String(fecha_inicio));
    if (fecha_fin) query = query.lte('fecha_pago', String(fecha_fin));
    if (matriculaIds) query = query.in('matricula_id', matriculaIds);

    let { data, error } = await query;
    if (error) {
      supportsDetalles = false;
      let q2 = supabase
        .from('movimientos_dinero')
        .select('id, sesion_id, tutor_id, curso_id, matricula_id, fecha_pago, monto, estado, tipo')
        .eq('tipo', 'ingreso_estudiante')
        .eq('estado', 'pendiente')
        .not('sesion_id', 'is', null)
        .order('fecha_pago', { ascending: false })
        .limit(limitN);

      if (tutorId) q2 = q2.eq('tutor_id', tutorId);
      if (fecha_inicio) q2 = q2.gte('fecha_pago', String(fecha_inicio));
      if (fecha_fin) q2 = q2.lte('fecha_pago', String(fecha_fin));
      if (matriculaIds) q2 = q2.in('matricula_id', matriculaIds);

      const res2 = await q2;
      data = res2.data;
      error = res2.error;
    }
    if (error) throw error;

    let items = (data || []).map((m) => {
      const tutorNombre = m?.tutor?.nombre;
      const cursoNombre = m?.curso?.nombre;
      const estudianteNombre = m?.matricula?.estudiante?.nombre;
      const estudianteIdRow = m?.matricula?.estudiante_id ?? null;
      const sesionFecha = m?.sesion?.fecha ?? null;
      const sesionHoraInicio = m?.sesion?.hora_inicio ?? null;
      const sesionHoraFin = m?.sesion?.hora_fin ?? null;

      return {
        movimiento_id: Number(m?.id) || null,
        sesion_id: Number(m?.sesion_id) || null,
        tutor_id: Number(m?.tutor_id) || null,
        tutor_nombre: tutorNombre || null,
        curso_id: Number(m?.curso_id) || null,
        curso_nombre: cursoNombre || null,
        matricula_id: Number(m?.matricula_id) || null,
        estudiante_id: estudianteIdRow ? Number(estudianteIdRow) : null,
        estudiante_nombre: estudianteNombre || null,
        fecha_pago: m?.fecha_pago ?? null,
        fecha_sesion: sesionFecha,
        hora_inicio: sesionHoraInicio,
        hora_fin: sesionHoraFin,
        monto: Number(m?.monto) || 0,
        estado: m?.estado ?? null,
        tipo: m?.tipo ?? null,
      };
    });

    if (qNorm) {
      items = items.filter((it) => {
        const hay = [
          it?.tutor_nombre,
          it?.estudiante_nombre,
          it?.curso_nombre,
          it?.fecha_sesion,
          it?.fecha_pago,
          it?.sesion_id,
          it?.movimiento_id,
        ]
          .map((x) => normalizeSearch(x))
          .join(' ');
        return hay.includes(qNorm);
      });
    }

    res.json({
      q: q ? String(q) : null,
      tutor_id: tutorId,
      estudiante_id: estudianteId,
      fecha_inicio: fecha_inicio ? String(fecha_inicio) : null,
      fecha_fin: fecha_fin ? String(fecha_fin) : null,
      limit: limitN,
      supports_detalles: supportsDetalles,
      items,
    });
  } catch (error) {
    return sendSchemaError(res, error);
  }
});

// POST - Registrar pago de estudiante (marca ingresos pendientes como completados)
// Body: estudiante_id (requerido), fecha_inicio, fecha_fin, metodo ('sinpe'|'transferencia'|'efectivo'), referencia, fecha_comprobante
router.post('/ingresos/liquidar-estudiante', async (req, res) => {
  try {
    const { estudiante_id, fecha_inicio, fecha_fin, metodo, referencia, fecha_comprobante, movimiento_ids } = req.body || {};

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

    if (metodoNorm !== 'efectivo' && !String(referencia || '').trim()) {
      return res.status(400).json({ error: 'numero_comprobante requerido para pagos no-efectivo' });
    }

    const selectedIds = Array.isArray(movimiento_ids)
      ? movimiento_ids.map((x) => toIntOrNull(x)).filter((x) => Number.isFinite(x) && x > 0)
      : [];
    if (!selectedIds.length) {
      return res.status(400).json({ error: 'Debe seleccionar ingresos pendientes a liquidar (movimiento_ids)' });
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
      .in('id', selectedIds)
      .in('matricula_id', matriculaIds);
    if (fecha_inicio) q = q.gte('fecha_pago', String(fecha_inicio));
    if (fecha_fin) q = q.lte('fecha_pago', String(fecha_fin));

    const { data: movimientos, error: movErr } = await q;
    if (movErr) throw movErr;
    if (!movimientos || movimientos.length === 0) {
      return res.status(409).json({ error: 'No hay ingresos pendientes para marcar como pagados con esos filtros' });
    }

    if (movimientos.length !== selectedIds.length) {
      return res.status(409).json({
        error: 'Algunos ingresos seleccionados no son válidos o no están pendientes para este estudiante',
      });
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

    // Registrar el dinero REAL ingresado como movimiento manual.
    // Esto mantiene el modelo: esperado (ingreso_estudiante pendiente) -> real (ingreso_manual).
    let movimiento_manual = null;
    try {
      const fechaReal = (fecha_comprobante && isValidISODate(String(fecha_comprobante)))
        ? String(fecha_comprobante)
        : new Date().toISOString().slice(0, 10);

      // Intentar inferir vínculo con una matrícula reciente (opcional)
      let matricula_id = null;
      let curso_id = null;
      let tutor_id = null;
      {
        const { data: mats, error: mErr } = await supabase
          .from('matriculas')
          .select('id, curso_id, tutor_id')
          .eq('estudiante_id', String(estudiante_id))
          .order('id', { ascending: false })
          .limit(1);
        if (!mErr) {
          const m0 = mats?.[0] ?? null;
          matricula_id = m0?.id ?? null;
          curso_id = m0?.curso_id ?? null;
          tutor_id = m0?.tutor_id ?? null;
        }
      }

      const notasParts = [
        'MANUAL',
        'ORIGEN:LIQ_ESTUDIANTE',
        `ESTUDIANTE_ID:${String(estudiante_id)}`,
        `METODO:${metodoNorm}`,
        referencia ? `REF:${String(referencia)}` : null,
        fecha_inicio ? `PERIODO_INICIO:${String(fecha_inicio)}` : null,
        fecha_fin ? `PERIODO_FIN:${String(fecha_fin)}` : null,
      ].filter(Boolean);

      const insert = {
        tipo: 'ingreso_manual',
        monto: total_monto,
        estado: 'completado',
        fecha_pago: fechaReal,
        fecha_comprobante: fechaReal,
        factura_numero: referencia ? String(referencia) : null,
        notas: notasParts.join(' | '),
        origen: 'manual',
        periodo_inicio: null,
        periodo_fin: null,
        tutor_id: tutor_id ? String(tutor_id) : null,
        curso_id: curso_id ? String(curso_id) : null,
        matricula_id: matricula_id ? String(matricula_id) : null,
        sesion_id: null,
      };

      const ins = await supabase
        .from('movimientos_dinero')
        .insert(insert)
        .select('id, tipo, monto, estado, fecha_pago')
        .single();
      if (!ins.error) movimiento_manual = ins.data;
    } catch {
      // Si falla el registro real, no rompemos la liquidación (pero el dashboard real quedará corto).
      movimiento_manual = null;
    }

    res.status(201).json({
      estudiante_id: String(estudiante_id),
      movimiento_ids: ids,
      movimientos_actualizados: ids.length,
      total_monto,
      movimiento_manual_id: movimiento_manual?.id ?? null,
      metodo: metodoNorm,
      referencia: referencia ? String(referencia) : null,
      fecha_comprobante: fecha_comprobante ? String(fecha_comprobante) : null
    });
  } catch (error) {
    return sendSchemaError(res, error);
  }
});

// POST - Registrar pago de una sesión específica (conciliación por sesión)
// Body: { sesion_id (requerido), metodo ('sinpe'|'transferencia'|'efectivo'), referencia?, fecha_comprobante? }
router.post('/ingresos/liquidar-sesion', async (req, res) => {
  try {
    const { sesion_id, metodo, referencia, fecha_comprobante } = req.body || {};

    const sesionId = toIntOrNull(sesion_id);
    if (!sesionId || sesionId <= 0) {
      return res.status(400).json({ error: 'Campo requerido: sesion_id (entero válido)' });
    }

    if (fecha_comprobante && !isValidISODate(String(fecha_comprobante))) {
      return res.status(400).json({ error: 'fecha_comprobante debe ser YYYY-MM-DD' });
    }

    const metodoNorm = String(metodo || '').trim().toLowerCase();
    const metodoOk = ['sinpe', 'transferencia', 'efectivo'].includes(metodoNorm);
    if (!metodoOk) {
      return res.status(400).json({ error: "metodo debe ser 'sinpe', 'transferencia' o 'efectivo'" });
    }

    const { data: mov, error: selErr } = await supabase
      .from('movimientos_dinero')
      .select('id, monto, estado, tipo')
      .eq('tipo', 'ingreso_estudiante')
      .eq('sesion_id', sesionId)
      .maybeSingle();
    if (selErr) throw selErr;
    if (!mov) {
      return res.status(404).json({ error: 'No se encontró ingreso_estudiante asociado a esa sesión' });
    }

    if (normalizeEstado(mov?.estado) !== 'pendiente') {
      return res.status(409).json({ error: 'Ese ingreso ya no está pendiente (ya fue conciliado)', movimiento_id: mov.id });
    }

    const patch = {
      estado: 'completado',
      updated_at: new Date().toISOString(),
      ...(fecha_comprobante ? { fecha_comprobante: String(fecha_comprobante) } : {}),
      ...(referencia ? { factura_numero: String(referencia) } : {}),
      notas: `PAGO_SESION:${metodoNorm}${referencia ? `:${String(referencia)}` : ''}`
    };

    const upd = await supabase
      .from('movimientos_dinero')
      .update(patch)
      .eq('id', mov.id);
    if (upd.error) throw upd.error;

    return res.status(201).json({
      sesion_id: sesionId,
      movimiento_id: mov.id,
      monto: Number(mov?.monto) || 0,
      metodo: metodoNorm,
      referencia: referencia ? String(referencia) : null,
      fecha_comprobante: fecha_comprobante ? String(fecha_comprobante) : null,
    });
  } catch (error) {
    return sendSchemaError(res, error);
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

    // Validación: no se puede liquidar más de lo que hay en la bolsa REAL.
    // Bolsa real = ingresos completados/verificados - egresos completados/verificados.
    // (Los pendientes cuentan como esperado, no como efectivo disponible.)
    {
      let qIng = supabase
        .from('movimientos_dinero')
        .select('tipo, monto, estado')
        .like('tipo', 'ingreso_%')
        .neq('tipo', 'ingreso_estudiante');
      qIng = qIng.or('estado.is.null,estado.in.(completado,verificado)');

      let qEgr = supabase
        .from('movimientos_dinero')
        .select('tipo, monto, estado')
        .or('tipo.like.pago_%,tipo.like.egreso_%');
      qEgr = qEgr.or('estado.is.null,estado.in.(completado,verificado)');

      const [ingRes, egrRes] = await Promise.all([qIng, qEgr]);
      if (ingRes.error) throw ingRes.error;
      if (egrRes.error) throw egrRes.error;

      const totalIng = (ingRes.data || []).reduce((sum, r) => {
        if (!isRealEstado(r?.estado)) return sum;
        return sum + (Number(r?.monto) || 0);
      }, 0);
      const totalEgr = (egrRes.data || []).reduce((sum, r) => {
        if (!isRealEstado(r?.estado)) return sum;
        return sum + (Number(r?.monto) || 0);
      }, 0);

      const bolsaReal = totalIng - totalEgr;
      if (monto_total > bolsaReal + 0.0001) {
        return res.status(409).json({
          error: 'No se puede liquidar: el monto excede la bolsa real disponible.',
          bolsa_real: bolsaReal,
          monto_solicitado: monto_total,
        });
      }
    }

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
    return sendSchemaError(res, error);
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
    return sendSchemaError(res, error);
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
    return sendSchemaError(res, error);
  }
});

export default router;

