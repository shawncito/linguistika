import express from 'express';
import { createClient } from '@supabase/supabase-js';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import ExcelJS from 'exceljs';
import { supabase } from '../supabase.js';
import { requireRoles } from '../middleware/roles.js';
import {
  registrarPagoEncargadoV1,
  registrarPagoTutorV1,
  updatePagoEvidenciaYEstado,
} from '../utils/tesoreria/registrarMovimiento.js';
import { schemaErrorPayload } from '../utils/schemaErrors.js';

const router = express.Router();

function sendSchemaError(res, error) {
  const payload = schemaErrorPayload(error);
  if (payload) return res.status(400).json(payload);
  return res.status(500).json({ error: error.message });
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const UPLOAD_ROOT = path.join(__dirname, '..', 'uploads', 'tesoreria');

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
      const pagoId = String(req.params?.pagoId || 'pago');
      const stamp = new Date().toISOString().replace(/[:.]/g, '-');
      cb(null, `${pagoId}-${stamp}-${sanitizeFilename(file.originalname)}`);
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const mime = String(file.mimetype || '').toLowerCase();
    const ok = mime.startsWith('image/') || mime === 'application/pdf';
    cb(ok ? null : new Error('Tipo de archivo no permitido (solo imagen o PDF)'), ok);
  },
});

// Solo admin/contador pueden entrar a tesorería
router.use(requireRoles(['admin', 'contador']));

const isValidISODate = (value) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
const isValidISOMonth = (value) => typeof value === 'string' && /^\d{4}-\d{2}$/.test(value);

const isAuthNetworkError = (err) => {
  const code = err?.cause?.code || err?.code;
  const name = err?.cause?.name || err?.name;
  const msg = String(err?.message || '').toLowerCase();
  return (
    code === 'UND_ERR_CONNECT_TIMEOUT' ||
    code === 'ETIMEDOUT' ||
    code === 'ECONNRESET' ||
    code === 'ECONNREFUSED' ||
    code === 'ENOTFOUND' ||
    code === 'EAI_AGAIN' ||
    name === 'AbortError' ||
    msg.includes('fetch failed')
  );
};

const createAuthClient = () => {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key) {
    const err = new Error('SUPABASE_URL y SUPABASE_ANON_KEY deben estar configurados');
    err.status = 500;
    throw err;
  }
  return createClient(url, key);
};

async function verifyUserPassword(email, password) {
  const client = createAuthClient();
  const { data, error } = await client.auth.signInWithPassword({
    email: String(email),
    password: String(password),
  });

  if (error || !data?.session) {
    return { ok: false, error };
  }

  try {
    await client.auth.signOut();
  } catch {
    // ignore
  }

  return { ok: true };
}

const getLastDayOfMonthISO = (mesYYYYMM) => {
  if (!isValidISOMonth(mesYYYYMM)) return null;
  const [yRaw, mRaw] = String(mesYYYYMM).split('-');
  const y = Number.parseInt(yRaw, 10);
  const m = Number.parseInt(mRaw, 10);
  if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) return null;
  const end = new Date(Date.UTC(y, m, 0));
  return end.toISOString().slice(0, 10);
};

const isMissingRelationError = (error) => {
  const msg = String(error?.message || '').toLowerCase();
  return msg.includes('does not exist') || msg.includes('relation') || msg.includes('schema');
};


const buildLibroQuery = ({ singleDate, start, end, includePendientes, encargadoIdNum, tutorIdNum, cuentaIdNum, ascending, limitNum }) => {
  let query = supabase
    .from('tesoreria_libro_diario_v1')
    .select('*')
    .order('fecha_pago', { ascending })
    .order('id', { ascending });

  if (Number.isFinite(cuentaIdNum) && cuentaIdNum > 0) query = query.eq('cuenta_id', cuentaIdNum);
  if (Number.isFinite(encargadoIdNum) && encargadoIdNum > 0) query = query.eq('encargado_id', encargadoIdNum);
  if (Number.isFinite(tutorIdNum) && tutorIdNum > 0) query = query.eq('tutor_id', tutorIdNum);

  if (singleDate) {
    query = query.eq('fecha_pago', singleDate);
  } else {
    if (start) query = query.gte('fecha_pago', start);
    if (end) query = query.lte('fecha_pago', end);
  }

  if (!includePendientes) {
    query = query.in('estado', ['completado', 'verificado']);
  }

  if (Number.isFinite(limitNum) && limitNum > 0) {
    query = query.limit(Math.min(5000, Math.max(1, limitNum)));
  }

  return query;
};

const writeXlsx = async ({ res, filename, sheetName, columns, rows }) => {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Linguistika';
  wb.created = new Date();
  const ws = wb.addWorksheet(sheetName);
  ws.columns = columns;
  ws.addRows(rows);
  ws.getRow(1).font = { bold: true };
  ws.views = [{ state: 'frozen', ySplit: 1 }];

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  const buf = await wb.xlsx.writeBuffer();
  return res.end(Buffer.from(buf));
};

router.get('/encargados/resumen', async (_req, res) => {
  try {
    // Traer solo encargados que tienen estudiantes activos o cuenta de tesorería
    const { data: encargadosConEstudiantes, error: encErr } = await supabase
      .from('encargados')
      .select(`
        id, nombre, email, telefono,
        estudiantes!inner(id)
      `)
      .order('nombre', { ascending: true });

    if (encErr) throw encErr;

    // Traer saldos de los que tienen cuenta de tesorería (con compensación automática)
    const { data: saldos, error: saldErr } = await supabase
      .from('tesoreria_saldos_encargados_v1')
      .select('cuenta_id, encargado_id, deuda_pendiente, saldo_a_favor, balance_neto, estado');

    if (saldErr) throw saldErr;

    // IDs de encargados con estudiantes
    const idsConEstudiantes = new Set(
      (encargadosConEstudiantes || []).map(e => e.id)
    );

    // IDs de encargados con cuenta de tesorería
    const idsConCuenta = new Set(
      (saldos || []).map(s => s.encargado_id)
    );

    // Combinar ambos sets (union)
    const todosIds = new Set([...idsConEstudiantes, ...idsConCuenta]);

    // Obtener datos completos de encargados
    const { data: todosEncargados, error: encTodosErr } = await supabase
      .from('encargados')
      .select('id, nombre, email, telefono')
      .in('id', Array.from(todosIds))
      .order('nombre', { ascending: true });

    if (encTodosErr) throw encTodosErr;

    // Crear mapa de saldos por encargado_id
    const saldosMap = (saldos || []).reduce((acc, s) => {
      acc[s.encargado_id] = s;
      return acc;
    }, {});

    // Combinar encargados con sus saldos (con balance neto y compensación)
    const resultado = (todosEncargados || []).map(enc => {
      const saldo = saldosMap[enc.id] || {};
      return {
        cuenta_id: saldo.cuenta_id || null,
        encargado_id: enc.id,
        deuda_pendiente: Number(saldo.deuda_pendiente) || 0,
        saldo_a_favor: Number(saldo.saldo_a_favor) || 0,
        balance_neto: Number(saldo.balance_neto) || 0,
        estado: saldo.estado || 'al_dia',
        encargados: {
          id: enc.id,
          nombre: enc.nombre,
          email: enc.email,
          telefono: enc.telefono,
        },
      };
    });

    return res.json({ encargados: resultado });
  } catch (error) {
    return sendSchemaError(res, error);
  }
});

router.get('/tutores/resumen', async (_req, res) => {
  try {
    const { data, error } = await supabase
      .from('tesoreria_saldos_tutores_v1')
      .select(`
        cuenta_id,
        tutor_id,
        por_pagar,
        pagado,
        tutores:tutor_id (
          id,
          nombre,
          email
        )
      `)
      .order('por_pagar', { ascending: false });

    if (error) throw error;
    return res.json({ tutores: data || [] });
  } catch (error) {
    return sendSchemaError(res, error);
  }
});

router.get('/diario', async (req, res) => {
  try {
    const {
      fecha,
      fecha_inicio,
      fecha_fin,
      incluir_pendientes,
      encargado_id,
      tutor_id,
      cuenta_id,
      order,
      limit,
    } = req.query;

    const singleDate = isValidISODate(String(fecha || '')) ? String(fecha) : null;
    const start = isValidISODate(String(fecha_inicio || '')) ? String(fecha_inicio) : null;
    const end = isValidISODate(String(fecha_fin || '')) ? String(fecha_fin) : null;

    const orderRaw = String(order ?? 'asc').toLowerCase();
    const ascending = !(orderRaw === 'desc' || orderRaw === 'descending');

    const encargadoIdNum = Number(encargado_id);
    const tutorIdNum = Number(tutor_id);
    const cuentaIdNum = Number(cuenta_id);

    const inclPend = String(incluir_pendientes ?? '').toLowerCase();
    const includePendientes = inclPend === '1' || inclPend === 'true' || inclPend === 'yes';

    const limitNum = Number(limit);
    const query = buildLibroQuery({
      singleDate,
      start,
      end,
      includePendientes,
      encargadoIdNum,
      tutorIdNum,
      cuentaIdNum,
      ascending,
      limitNum: Number.isFinite(limitNum) && limitNum > 0 ? Math.min(200, limitNum) : null,
    });

    const { data, error } = await query;
    if (error) throw error;

    return res.json({ movimientos: data || [] });
  } catch (error) {
    return sendSchemaError(res, error);
  }
});

router.get('/cuentas/encargado/:encargadoId/movimientos', async (req, res) => {
  try {
    const encargadoId = Number(req.params.encargadoId);
    if (!Number.isFinite(encargadoId) || encargadoId <= 0) {
      return res.status(400).json({ error: 'encargadoId inválido' });
    }

    const { fecha_inicio, fecha_fin, incluir_pendientes } = req.query;
    const start = isValidISODate(String(fecha_inicio || '')) ? String(fecha_inicio) : null;
    const end = isValidISODate(String(fecha_fin || '')) ? String(fecha_fin) : null;
    const inclPend = String(incluir_pendientes ?? '').toLowerCase();
    const includePendientes = inclPend === '1' || inclPend === 'true' || inclPend === 'yes';

    const { data: cuenta, error: cErr } = await supabase
      .from('tesoreria_cuentas_corrientes')
      .select('id')
      .eq('tipo', 'encargado')
      .eq('encargado_id', encargadoId)
      .maybeSingle();
    if (cErr) throw cErr;
    if (!cuenta?.id) return res.status(404).json({ error: 'Cuenta no encontrada' });

    const query = buildLibroQuery({
      singleDate: null,
      start,
      end,
      includePendientes,
      encargadoIdNum: null,
      tutorIdNum: null,
      cuentaIdNum: Number(cuenta.id),
      ascending: true,
      limitNum: 5000,
    });

    const { data, error } = await query;
    if (error) throw error;

    return res.json({ cuenta_id: Number(cuenta.id), movimientos: data || [] });
  } catch (error) {
    return sendSchemaError(res, error);
  }
});

router.get('/cuentas/tutor/:tutorId/movimientos', async (req, res) => {
  try {
    const tutorId = Number(req.params.tutorId);
    if (!Number.isFinite(tutorId) || tutorId <= 0) {
      return res.status(400).json({ error: 'tutorId inválido' });
    }

    const { fecha_inicio, fecha_fin, incluir_pendientes } = req.query;
    const start = isValidISODate(String(fecha_inicio || '')) ? String(fecha_inicio) : null;
    const end = isValidISODate(String(fecha_fin || '')) ? String(fecha_fin) : null;
    const inclPend = String(incluir_pendientes ?? '').toLowerCase();
    const includePendientes = inclPend === '1' || inclPend === 'true' || inclPend === 'yes';

    const { data: cuenta, error: cErr } = await supabase
      .from('tesoreria_cuentas_corrientes')
      .select('id')
      .eq('tipo', 'tutor')
      .eq('tutor_id', tutorId)
      .maybeSingle();
    if (cErr) throw cErr;
    if (!cuenta?.id) return res.status(404).json({ error: 'Cuenta no encontrada' });

    const query = buildLibroQuery({
      singleDate: null,
      start,
      end,
      includePendientes,
      encargadoIdNum: null,
      tutorIdNum: null,
      cuentaIdNum: Number(cuenta.id),
      ascending: true,
      limitNum: 5000,
    });

    const { data, error } = await query;
    if (error) throw error;

    return res.json({ cuenta_id: Number(cuenta.id), movimientos: data || [] });
  } catch (error) {
    return sendSchemaError(res, error);
  }
});

router.get('/export/diario', async (req, res) => {
  try {
    const {
      fecha,
      fecha_inicio,
      fecha_fin,
      incluir_pendientes,
      encargado_id,
      tutor_id,
      cuenta_id,
      order,
      limit,
    } = req.query;

    const singleDate = isValidISODate(String(fecha || '')) ? String(fecha) : null;
    const start = isValidISODate(String(fecha_inicio || '')) ? String(fecha_inicio) : null;
    const end = isValidISODate(String(fecha_fin || '')) ? String(fecha_fin) : null;

    const orderRaw = String(order ?? 'asc').toLowerCase();
    const ascending = !(orderRaw === 'desc' || orderRaw === 'descending');

    const encargadoIdNum = Number(encargado_id);
    const tutorIdNum = Number(tutor_id);
    const cuentaIdNum = Number(cuenta_id);

    const inclPend = String(incluir_pendientes ?? '').toLowerCase();
    const includePendientes = inclPend === '1' || inclPend === 'true' || inclPend === 'yes';

    const limitNum = Number(limit);

    const query = buildLibroQuery({
      singleDate,
      start,
      end,
      includePendientes,
      encargadoIdNum,
      tutorIdNum,
      cuentaIdNum,
      ascending,
      limitNum: Number.isFinite(limitNum) && limitNum > 0 ? limitNum : 5000,
    });

    const { data, error } = await query;
    if (error) throw error;

    const filename = `tesoreria_diario_${new Date().toISOString().slice(0, 10)}.xlsx`;
    const rows = (data || []).map((m) => ({
      Fecha: String(m?.fecha_pago || ''),
      Tipo: String(m?.cuenta_tipo || ''),
      EncargadoId: m?.encargado_id ?? '',
      TutorId: m?.tutor_id ?? '',
      Detalle: String(m?.detalle || ''),
      Estado: String(m?.estado || ''),
      Metodo: String(m?.metodo || ''),
      Referencia: String(m?.referencia || ''),
      Debe: Number(m?.debe) || 0,
      Haber: Number(m?.haber) || 0,
      Saldo: Number(m?.saldo_acumulado) || 0,
    }));

    return writeXlsx({
      res,
      filename,
      sheetName: 'Diario',
      columns: [
        { header: 'Fecha', key: 'Fecha', width: 12 },
        { header: 'Tipo', key: 'Tipo', width: 10 },
        { header: 'EncargadoId', key: 'EncargadoId', width: 12 },
        { header: 'TutorId', key: 'TutorId', width: 10 },
        { header: 'Detalle', key: 'Detalle', width: 40 },
        { header: 'Estado', key: 'Estado', width: 12 },
        { header: 'Metodo', key: 'Metodo', width: 14 },
        { header: 'Referencia', key: 'Referencia', width: 18 },
        { header: 'Debe', key: 'Debe', width: 14 },
        { header: 'Haber', key: 'Haber', width: 14 },
        { header: 'Saldo', key: 'Saldo', width: 14 },
      ],
      rows,
    });
  } catch (error) {
    return sendSchemaError(res, error);
  }
});

router.get('/export/cuenta/:cuentaId', async (req, res) => {
  try {
    const cuentaId = Number(req.params.cuentaId);
    if (!Number.isFinite(cuentaId) || cuentaId <= 0) {
      return res.status(400).json({ error: 'cuentaId inválido' });
    }

    const { fecha_inicio, fecha_fin, incluir_pendientes, order, limit } = req.query;
    const start = isValidISODate(String(fecha_inicio || '')) ? String(fecha_inicio) : null;
    const end = isValidISODate(String(fecha_fin || '')) ? String(fecha_fin) : null;
    const inclPend = String(incluir_pendientes ?? '').toLowerCase();
    const includePendientes = inclPend === '1' || inclPend === 'true' || inclPend === 'yes';
    const orderRaw = String(order ?? 'asc').toLowerCase();
    const ascending = !(orderRaw === 'desc' || orderRaw === 'descending');
    const limitNum = Number(limit);

    const query = buildLibroQuery({
      singleDate: null,
      start,
      end,
      includePendientes,
      encargadoIdNum: null,
      tutorIdNum: null,
      cuentaIdNum: cuentaId,
      ascending,
      limitNum: Number.isFinite(limitNum) && limitNum > 0 ? limitNum : 5000,
    });

    const { data, error } = await query;
    if (error) throw error;

    const filename = `tesoreria_cuenta_${cuentaId}_${new Date().toISOString().slice(0, 10)}.xlsx`;
    const rows = (data || []).map((m) => ({
      Fecha: String(m?.fecha_pago || ''),
      Detalle: String(m?.detalle || ''),
      Estado: String(m?.estado || ''),
      Metodo: String(m?.metodo || ''),
      Referencia: String(m?.referencia || ''),
      Debe: Number(m?.debe) || 0,
      Haber: Number(m?.haber) || 0,
      Saldo: Number(m?.saldo_acumulado) || 0,
    }));

    return writeXlsx({
      res,
      filename,
      sheetName: 'Cuenta',
      columns: [
        { header: 'Fecha', key: 'Fecha', width: 12 },
        { header: 'Detalle', key: 'Detalle', width: 45 },
        { header: 'Estado', key: 'Estado', width: 12 },
        { header: 'Metodo', key: 'Metodo', width: 14 },
        { header: 'Referencia', key: 'Referencia', width: 18 },
        { header: 'Debe', key: 'Debe', width: 14 },
        { header: 'Haber', key: 'Haber', width: 14 },
        { header: 'Saldo', key: 'Saldo', width: 14 },
      ],
      rows,
    });
  } catch (error) {
    return sendSchemaError(res, error);
  }
});

router.get('/pagos/:pagoId/aplicaciones', async (req, res) => {
  try {
    const pagoId = Number(req.params.pagoId);
    if (!Number.isFinite(pagoId) || pagoId <= 0) {
      return res.status(400).json({ error: 'pagoId inválido' });
    }

    const { data: pago, error: pErr } = await supabase
      .from('tesoreria_pagos')
      .select('id, cuenta_id, direccion, monto, fecha_pago, metodo, referencia, detalle, estado, comprobante_url, numero_comprobante, fecha_comprobante')
      .eq('id', pagoId)
      .maybeSingle();
    if (pErr) throw pErr;
    if (!pago) return res.status(404).json({ error: 'Pago no encontrado' });

    const { data: aplicaciones, error: aErr } = await supabase
      .from('tesoreria_aplicaciones')
      .select(`
        id,
        monto,
        created_at,
        obligacion:obligacion_id (
          id,
          tipo,
          monto,
          fecha_devengo,
          estado,
          estudiante_id,
          tutor_id,
          curso_id,
          matricula_id,
          sesion_id,
          detalle,
          estudiantes:estudiante_id (nombre),
          tutores:tutor_id (nombre),
          cursos:curso_id (nombre)
        )
      `)
      .eq('pago_id', pagoId)
      .order('id', { ascending: true });
    if (aErr) throw aErr;

    return res.json({ pago, aplicaciones: aplicaciones || [] });
  } catch (error) {
    return sendSchemaError(res, error);
  }
});

router.get('/resumen', async (_req, res) => {
  try {
    const { data: encRows, error: eErr } = await supabase
      .from('tesoreria_saldos_encargados_v1')
      .select('deuda_pendiente, saldo_a_favor');
    if (eErr) throw eErr;

    const { data: tutRows, error: tErr } = await supabase
      .from('tesoreria_saldos_tutores_v1')
      .select('por_pagar');
    if (tErr) throw tErr;

    // Sumar deudas pendientes de cobros grupales (estudiantes bulk sin encargado)
    const { data: cobroGrupalRows, error: cgErr } = await supabase
      .from('movimientos_dinero')
      .select('monto')
      .eq('estado', 'pendiente')
      .eq('tipo', 'ingreso')
      .eq('origen', 'cobro_grupal');
    
    if (cgErr) throw cgErr;

    const deudaPendiente = (encRows || []).reduce((acc, x) => acc + (Number(x?.deuda_pendiente) || 0), 0);
    const deudaCobroGrupal = (cobroGrupalRows || []).reduce((acc, x) => acc + (Number(x?.monto) || 0), 0);
    const saldoAFavor = (encRows || []).reduce((acc, x) => acc + (Number(x?.saldo_a_favor) || 0), 0);
    const porPagarTutores = (tutRows || []).reduce((acc, x) => acc + (Number(x?.por_pagar) || 0), 0);

    return res.json({ 
      deudaPendiente: deudaPendiente + deudaCobroGrupal, 
      saldoAFavor, 
      porPagarTutores 
    });
  } catch (error) {
    return sendSchemaError(res, error);
  }
});

router.get('/bolsa', async (_req, res) => {
  try {
    // Calcular bolsa_real desde tesoreria_pagos (completados o verificados)
    const { data: pagos, error } = await supabase
      .from('tesoreria_pagos')
      .select('direccion, monto, estado')
      .in('estado', ['completado', 'verificado']);
    
    if (error) throw error;

    // Sumar ingresos (haber) y restar egresos (debe)
    let debe_real = 0;
    let haber_real = 0;

    (pagos || []).forEach((pago) => {
      const monto = Number(pago.monto) || 0;
      if (pago.direccion === 'entrada') {
        haber_real += monto;
      } else if (pago.direccion === 'salida') {
        debe_real += monto;
      }
    });

    const bolsa_real = haber_real - debe_real;

    return res.json({
      debe_real,
      haber_real,
      bolsa_real,
      movimientos_count: pagos?.length || 0,
    });
  } catch (error) {
    return sendSchemaError(res, error);
  }
});


router.get('/encargados/porcentaje', async (_req, res) => {
  try {
    const select = `
        cuenta_id,
        encargado_id,
        saldo_a_favor,
        bolsa_real,
        porcentaje_bolsa,
        encargados:encargado_id (id, nombre, email, telefono)
      `;

    // Preferir v2 (ajustado por fuente de pago tutor); fallback a v1.
    let viewName = 'tesoreria_porcentaje_encargados_v2';
    let { data, error } = await supabase
      .from(viewName)
      .select(select)
      .order('saldo_a_favor', { ascending: false });

    if (error && isMissingRelationError(error)) {
      viewName = 'tesoreria_porcentaje_encargados_v1';
      ({ data, error } = await supabase
        .from(viewName)
        .select(select)
        .order('saldo_a_favor', { ascending: false }));
    }

    if (error) throw error;
    return res.json({ encargados: data || [] });
  } catch (error) {
    return sendSchemaError(res, error);
  }
});

router.get('/esperado/diario', async (req, res) => {
  try {
    const { fecha_inicio, fecha_fin } = req.query;

    const start = isValidISODate(String(fecha_inicio || '')) ? String(fecha_inicio) : null;
    const end = isValidISODate(String(fecha_fin || '')) ? String(fecha_fin) : null;

    let query = supabase
      .from('tesoreria_esperado_diario_v1')
      .select('*')
      .order('fecha', { ascending: true });

    if (start) query = query.gte('fecha', start);
    if (end) query = query.lte('fecha', end);

    const { data, error } = await query;
    if (error) throw error;
    return res.json({ esperado: data || [] });
  } catch (error) {
    return sendSchemaError(res, error);
  }
});

// =========================
// OBLIGACIONES (DESGLOSE)
// =========================
router.get('/encargados/:encargadoId/obligaciones', async (req, res) => {
  try {
    const encargadoId = Number(req.params.encargadoId);
    if (!Number.isFinite(encargadoId) || encargadoId <= 0) {
      return res.status(400).json({ error: 'encargadoId inválido' });
    }

    const estado = String(req.query?.estado || 'pendiente').trim().toLowerCase();
    const onlyPendiente = !estado || estado === 'pendiente';

    // Por defecto solo cobros de sesión (comportamiento original).
    // Para ver recuperos/adelantos del sistema: ?tipo=ajuste o ?tipo=all
    const tipoQ = String(req.query?.tipo || 'cobro_sesion').trim().toLowerCase();
    const tipos =
      tipoQ === 'all'
        ? ['cobro_sesion', 'ajuste']
        : tipoQ === 'ajuste'
          ? ['ajuste']
          : ['cobro_sesion'];

    const { data: cuenta, error: cErr } = await supabase
      .from('tesoreria_cuentas_corrientes')
      .select('id')
      .eq('tipo', 'encargado')
      .eq('encargado_id', encargadoId)
      .maybeSingle();
    if (cErr) throw cErr;
    if (!cuenta?.id) return res.status(404).json({ error: 'Cuenta no encontrada' });

    let query = supabase
      .from('tesoreria_obligaciones')
      .select(`
        id,
        tipo,
        cuenta_id,
        monto,
        fecha_devengo,
        estado,
        detalle,
        sesion_id,
        matricula_id,
        curso_id,
        tutor_id,
        estudiante_id,
        cursos:curso_id (nombre),
        tutores:tutor_id (nombre),
        estudiantes:estudiante_id (nombre)
      `)
      .eq('cuenta_id', cuenta.id)
      .in('tipo', tipos)
      .neq('estado', 'cancelado')
      .order('fecha_devengo', { ascending: true })
      .order('id', { ascending: true });

    if (onlyPendiente) query = query.eq('estado', 'pendiente');

    const { data: obligaciones, error } = await query;
    if (error) throw error;

    const ids = (obligaciones || []).map((o) => o.id).filter((x) => Number.isFinite(Number(x)));
    let appliedById = {};
    if (ids.length) {
      const { data: apps, error: aErr } = await supabase
        .from('tesoreria_aplicaciones')
        .select('obligacion_id, monto')
        .in('obligacion_id', ids);
      if (aErr) throw aErr;
      appliedById = (apps || []).reduce((acc, row) => {
        const k = String(row.obligacion_id);
        acc[k] = (Number(acc[k]) || 0) + (Number(row.monto) || 0);
        return acc;
      }, {});
    }

    const rows = (obligaciones || []).map((o) => {
      const ya_aplicado = Number(appliedById[String(o.id)]) || 0;
      const restante = Math.max(0, (Number(o.monto) || 0) - ya_aplicado);
      return { ...o, ya_aplicado, restante };
    });

    // Lógica empresarial: si ya quedó cubierta (restante=0), no debe salir como pendiente.
    const finalRows = onlyPendiente ? rows.filter((r) => (Number(r.restante) || 0) > 0) : rows;

    return res.json({ cuenta_id: cuenta.id, obligaciones: finalRows });
  } catch (error) {
    return sendSchemaError(res, error);
  }
});

router.get('/tutores/:tutorId/obligaciones', async (req, res) => {
  try {
    const tutorId = Number(req.params.tutorId);
    if (!Number.isFinite(tutorId) || tutorId <= 0) {
      return res.status(400).json({ error: 'tutorId inválido' });
    }

    const estado = String(req.query?.estado || 'pendiente').trim().toLowerCase();
    const onlyPendiente = !estado || estado === 'pendiente';

    const { data: cuenta, error: cErr } = await supabase
      .from('tesoreria_cuentas_corrientes')
      .select('id')
      .eq('tipo', 'tutor')
      .eq('tutor_id', tutorId)
      .maybeSingle();
    if (cErr) throw cErr;
    if (!cuenta?.id) return res.status(404).json({ error: 'Cuenta no encontrada' });

    let query = supabase
      .from('tesoreria_obligaciones')
      .select(`
        id,
        tipo,
        cuenta_id,
        monto,
        fecha_devengo,
        estado,
        detalle,
        sesion_id,
        matricula_id,
        curso_id,
        tutor_id,
        estudiante_id,
        cursos:curso_id (nombre),
        tutores:tutor_id (nombre),
        estudiantes:estudiante_id (
          nombre,
          encargado_id,
          encargados:encargado_id (nombre)
        )
      `)
      .eq('cuenta_id', cuenta.id)
      .eq('tipo', 'pago_tutor_sesion')
      .neq('estado', 'cancelado')
      .order('fecha_devengo', { ascending: true })
      .order('id', { ascending: true });

    if (onlyPendiente) query = query.eq('estado', 'pendiente');

    const { data: obligaciones, error } = await query;
    if (error) throw error;

    const ids = (obligaciones || []).map((o) => o.id).filter((x) => Number.isFinite(Number(x)));
    let appliedById = {};
    if (ids.length) {
      const { data: apps, error: aErr } = await supabase
        .from('tesoreria_aplicaciones')
        .select('obligacion_id, monto')
        .in('obligacion_id', ids);
      if (aErr) throw aErr;
      appliedById = (apps || []).reduce((acc, row) => {
        const k = String(row.obligacion_id);
        acc[k] = (Number(acc[k]) || 0) + (Number(row.monto) || 0);
        return acc;
      }, {});
    }

    const rows = (obligaciones || []).map((o) => {
      const ya_aplicado = Number(appliedById[String(o.id)]) || 0;
      const restante = Math.max(0, (Number(o.monto) || 0) - ya_aplicado);
      return { ...o, ya_aplicado, restante };
    });

    // Lógica empresarial: si ya quedó cubierta (restante=0), no debe salir como pendiente.
    const finalRows = onlyPendiente ? rows.filter((r) => (Number(r.restante) || 0) > 0) : rows;

    return res.json({ cuenta_id: cuenta.id, obligaciones: finalRows });
  } catch (error) {
    return sendSchemaError(res, error);
  }
});

router.post('/encargados/:encargadoId/pagos', async (req, res) => {
  try {
    const encargadoId = Number(req.params.encargadoId);
    if (!Number.isFinite(encargadoId) || encargadoId <= 0) {
      return res.status(400).json({ error: 'encargadoId inválido' });
    }

    const {
      monto,
      fecha_pago,
      metodo,
      numero_comprobante,
      fecha_comprobante,
      comprobante_url,
      referencia,
      detalle
    } = req.body || {};

    const data = await registrarPagoEncargadoV1({
      encargadoId,
      monto,
      fecha_pago,
      metodo,
      numero_comprobante,
      fecha_comprobante,
      comprobante_url,
      referencia,
      detalle,
    });

    return res.status(201).json(data);
  } catch (error) {
    const status = Number(error?.status) || 500;
    return res.status(status).json({ error: error.message });
  }
});

router.post('/tutores/:tutorId/pagos', async (req, res) => {
  try {
    const tutorId = Number(req.params.tutorId);
    if (!Number.isFinite(tutorId) || tutorId <= 0) {
      return res.status(400).json({ error: 'tutorId inválido' });
    }

    const {
      monto,
      fecha_pago,
      metodo,
      numero_comprobante,
      fecha_comprobante,
      comprobante_url,
      referencia,
      detalle,
      funding_mode,
      source_encargado_id,
      obligacion_ids,
    } = req.body || {};

    const data = await registrarPagoTutorV1({
      tutorId,
      monto,
      fecha_pago,
      metodo,
      numero_comprobante,
      fecha_comprobante,
      comprobante_url,
      referencia,
      detalle,
      funding_mode,
      source_encargado_id,
      obligacion_ids,
    });

    return res.status(201).json(data);
  } catch (error) {
    const status = Number(error?.status) || 500;
    return res.status(status).json({ error: error.message });
  }
});

// Subir comprobante (imagen/pdf) para un pago de tesorería
router.post('/pagos/:pagoId/comprobante', upload.single('file'), async (req, res) => {
  try {
    const pagoId = Number(req.params.pagoId);
    if (!Number.isFinite(pagoId) || pagoId <= 0) {
      return res.status(400).json({ error: 'pagoId inválido' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'Debe adjuntar un archivo (file)' });
    }

    const comprobante_url = `/uploads/tesoreria/${req.file.filename}`;

    const data = await updatePagoEvidenciaYEstado(pagoId, { comprobante_url });
    return res.json(data);
  } catch (error) {
    const status = Number(error?.status) || 500;
    return res.status(status).json({ error: error.message });
  }
});

// Actualizar evidencia/datos de un pago (y opcionalmente marcar completado)
router.patch('/pagos/:pagoId', async (req, res) => {
  try {
    const pagoId = Number(req.params.pagoId);
    if (!Number.isFinite(pagoId) || pagoId <= 0) {
      return res.status(400).json({ error: 'pagoId inválido' });
    }

    const {
      metodo,
      numero_comprobante,
      fecha_comprobante,
      referencia,
      detalle,
      estado,
    } = req.body || {};

    const data = await updatePagoEvidenciaYEstado(pagoId, {
      metodo,
      numero_comprobante,
      fecha_comprobante,
      referencia,
      detalle,
      estado,
    });

    return res.json(data);
  } catch (error) {
    const status = Number(error?.status) || 500;
    return res.status(status).json({ error: error.message });
  }
});

// POST - Registrar cobro grupal por curso
router.post('/grupos/:grupoId/cobro', async (req, res) => {
  try {
    const grupoId = Number(req.params.grupoId);
    if (!Number.isFinite(grupoId) || grupoId <= 0) {
      return res.status(400).json({ error: 'grupoId inválido' });
    }

    // Extraer datos del body
    const fecha_pago = req.body?.fecha_pago || new Date().toISOString().split('T')[0];
    const detalle = req.body?.detalle || null;
    const metodo = req.body?.metodo || 'manual';
    const numero_comprobante = req.body?.numero_comprobante || null;
    const fecha_comprobante = req.body?.fecha_comprobante || null;
    const comprobante_url = req.body?.comprobante_url || null;
    const referencia = req.body?.referencia || null;

    // Obtener grupo con curso
    const { data: grupo, error: gErr } = await supabase
      .from('matriculas_grupo')
      .select('id, curso_id, tutor_id, nombre_grupo')
      .eq('id', grupoId)
      .maybeSingle();

    if (gErr) throw gErr;
    if (!grupo) return res.status(404).json({ error: 'Grupo no encontrado' });

    const cursoId = grupo.curso_id;
    const tutorId = grupo.tutor_id;

    if (!cursoId) {
      return res.status(400).json({ error: 'El grupo no tiene un curso asignado' });
    }

    // Obtener datos del curso (precio)
    const { data: curso, error: cErr } = await supabase
      .from('cursos')
      .select('id, nombre, costo_curso, pago_tutor')
      .eq('id', cursoId)
      .maybeSingle();

    if (cErr) throw cErr;
    if (!curso) return res.status(400).json({ error: 'Curso no encontrado' });

    const montoCurso = Number(curso.costo_curso) || 0;
    const montoTutor = Number(curso.pago_tutor) || 0;

    if (montoCurso <= 0) {
      return res.status(400).json({ error: 'El curso no tiene un precio válido' });
    }

    // Obtener estudiantes del grupo
    const { data: links, error: lErr } = await supabase
      .from('estudiantes_en_grupo')
      .select('estudiante_bulk_id')
      .eq('matricula_grupo_id', grupoId);

    if (lErr) throw lErr;

    const bulkIds = (links || []).map((l) => l.estudiante_bulk_id);
    const { data: estudiantesBulk, error: eBErr } = bulkIds.length
      ? await supabase
          .from('estudiantes_bulk')
          .select('id, nombre')
          .in('id', bulkIds)
      : { data: [], error: null };

    if (eBErr) throw eBErr;

    // Obtener estudiantes normales
    const { data: estudiantesNormales, error: eNErr } = await supabase
      .from('estudiantes')
      .select('id, nombre')
      .eq('matricula_grupo_id', grupoId);

    if (eNErr && !String(eNErr.message || '').includes('column')) throw eNErr;

    const todosEstudiantes = [
      ...(estudiantesBulk || []).map((e) => ({
        id: String(e.id),
        tipo: 'bulk',
        nombre: e.nombre,
      })),
      ...(estudiantesNormales || []).map((e) => ({
        id: String(e.id),
        tipo: 'normal',
        nombre: e.nombre,
      })),
    ];

    if (todosEstudiantes.length === 0) {
      return res.status(400).json({ error: 'El grupo no tiene estudiantes' });
    }

    // Registrar DEUDA a estudiantes (estado pendiente, NO completado)
    const movimientosCreados = [];
    for (const est of todosEstudiantes) {
      const { data: mov, error: movErr } = await supabase
        .from('movimientos_dinero')
        .insert({
          curso_id: cursoId,
          tutor_id: tutorId,
          tipo: 'ingreso',
          monto: montoCurso,
          factura_numero: numero_comprobante,
          fecha_pago: fecha_pago,
          fecha_comprobante: fecha_comprobante,
          estado: 'pendiente',
          notas: detalle || `Cobro ${grupo.nombre_grupo} - ${curso.nombre} - ${est.nombre}`,
          origen: 'cobro_grupal',
        })
        .select();

      if (movErr) throw movErr;
      if (mov && mov.length > 0) {
        movimientosCreados.push(mov[0]);
      }
    }

    // Registrar DEUDA a tutor (estado pendiente, NO completado)
    let pagoTutor = null;
    if (tutorId && montoTutor > 0) {
      const { data: tutData, error: tutErr } = await supabase
        .rpc('tesoreria_registrar_pago_tutor_v1', {
          p_tutor_id: tutorId,
          p_monto: montoTutor,
          p_fecha_pago: fecha_pago,
          p_metodo: metodo || 'manual',
          p_numero_comprobante: numero_comprobante || null,
          p_fecha_comprobante: fecha_comprobante || null,
          p_comprobante_url: comprobante_url || null,
          p_referencia: referencia || null,
          p_detalle: detalle || `Pago por curso ${curso.nombre} - Grupo ${grupo.nombre_grupo}`,
          p_estado: 'pendiente',
        });

      if (tutErr) {
        // Log pero no fallar - el pago a estudiantes ya se registró
        console.error('Error registrando pago a tutor:', tutErr);
      } else {
        pagoTutor = tutData;
      }
    }

    return res.status(201).json({
      success: true,
      grupo: grupo.nombre_grupo,
      curso: curso.nombre,
      estudiantes_count: todosEstudiantes.length,
      monto_por_estudiante: montoCurso,
      total_estudiantes: montoCurso * todosEstudiantes.length,
      pago_tutor: pagoTutor,
      movimientos_creados: movimientosCreados.length,
      detalles: {
        estudiantes: todosEstudiantes,
        movimientos: movimientosCreados,
      },
    });
  } catch (error) {
    const status = Number(error?.status) || 500;
    return res.status(status).json({ error: error.message });
  }
});

export default router;
