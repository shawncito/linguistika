import { supabase } from '../../supabase.js';
import { getOrCreateEncargadoId } from '../encargados.js';

const isValidISODate = (value) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);

function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function normalizeEstado(value) {
  if (value == null) return '';
  return String(value).trim().toLowerCase();
}

function normalizeMetodo(value) {
  if (value == null) return '';
  return String(value).trim().toLowerCase();
}

async function getCierreHasta() {
  try {
    const { data, error } = await supabase
      .from('tesoreria_cierres_mensuales')
      .select('cerrado_hasta')
      .order('cerrado_hasta', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) return null;
    return data?.cerrado_hasta ? String(data.cerrado_hasta).slice(0, 10) : null;
  } catch {
    return null;
  }
}

async function assertFechaNoCerrada(fechaISO) {
  // Se permite registrar/modificar movimientos en cualquier fecha (sin bloqueo por cierre).
  void fechaISO;
  return;
}

export function validateMontoFecha({ monto, fecha_pago }) {
  const montoNum = Number(monto);
  if (!Number.isFinite(montoNum) || montoNum <= 0) {
    throw httpError(400, 'monto debe ser > 0');
  }
  if (!isValidISODate(String(fecha_pago || ''))) {
    throw httpError(400, 'fecha_pago requerida (YYYY-MM-DD)');
  }
  return { montoNum, fecha_pago: String(fecha_pago) };
}

export function validateFechaComprobante(fecha_comprobante) {
  if (fecha_comprobante && !isValidISODate(String(fecha_comprobante))) {
    throw httpError(400, 'fecha_comprobante debe ser YYYY-MM-DD');
  }
}

export function validateEvidenciaIfNeeded({ metodo, estado, numero_comprobante, fecha_comprobante, comprobante_url }) {
  const finalMetodo = normalizeMetodo(metodo);
  const finalEstado = normalizeEstado(estado);

  const isReal = finalEstado === 'completado' || finalEstado === 'verificado';
  const needsEvidence = isReal && finalMetodo && finalMetodo !== 'efectivo';

  if (!needsEvidence) return;

  if (!numero_comprobante) throw httpError(400, 'numero_comprobante requerido para pagos no-efectivo cuando el estado es completado/verificado');
  if (!fecha_comprobante) throw httpError(400, 'fecha_comprobante requerido para pagos no-efectivo cuando el estado es completado/verificado');
  if (!comprobante_url) throw httpError(400, 'comprobante_url requerido para pagos no-efectivo cuando el estado es completado/verificado');
}

export async function registrarPagoEncargadoV1(params) {
  const { encargadoId } = params || {};
  const encargadoIdNum = Number(encargadoId);
  if (!Number.isFinite(encargadoIdNum) || encargadoIdNum <= 0) {
    throw httpError(400, 'encargadoId inválido');
  }

  const { montoNum, fecha_pago } = validateMontoFecha(params);

  await assertFechaNoCerrada(fecha_pago);

  const {
    metodo,
    numero_comprobante,
    fecha_comprobante,
    comprobante_url,
    referencia,
    detalle,
  } = params || {};

  validateFechaComprobante(fecha_comprobante);

  // Preferir v2 (recupero automático de adelantos del sistema) y hacer fallback a v1.
  let { data, error } = await supabase.rpc('tesoreria_registrar_pago_encargado_v2', {
    p_encargado_id: encargadoIdNum,
    p_monto: montoNum,
    p_fecha_pago: fecha_pago,
    p_metodo: metodo ?? null,
    p_numero_comprobante: numero_comprobante ?? null,
    p_fecha_comprobante: fecha_comprobante ?? null,
    p_comprobante_url: comprobante_url ?? null,
    p_referencia: referencia ?? null,
    p_detalle: detalle ?? null,
  });

  if (error) {
    const msg = String(error?.message || '').toLowerCase();
    if (msg.includes('function') && msg.includes('does not exist')) {
      ({ data, error } = await supabase.rpc('tesoreria_registrar_pago_encargado_v1', {
        p_encargado_id: encargadoIdNum,
        p_monto: montoNum,
        p_fecha_pago: fecha_pago,
        p_metodo: metodo ?? null,
        p_numero_comprobante: numero_comprobante ?? null,
        p_fecha_comprobante: fecha_comprobante ?? null,
        p_comprobante_url: comprobante_url ?? null,
        p_referencia: referencia ?? null,
        p_detalle: detalle ?? null,
      }));
    }
  }

  if (error) throw error;
  return data;
}

export async function registrarPagoTutorV1(params) {
  const { tutorId } = params || {};
  const tutorIdNum = Number(tutorId);
  if (!Number.isFinite(tutorIdNum) || tutorIdNum <= 0) {
    throw httpError(400, 'tutorId inválido');
  }

  const { montoNum, fecha_pago } = validateMontoFecha(params);

  await assertFechaNoCerrada(fecha_pago);

  // Validación dura: no se puede pagar más que la bolsa real
  try {
    const { data: bolsaRow } = await supabase
      .from('tesoreria_bolsa_v1')
      .select('bolsa_real')
      .maybeSingle();
    const bolsaReal = Number(bolsaRow?.bolsa_real) || 0;
    if (montoNum > bolsaReal) {
      throw httpError(400, `Monto supera bolsa real (${bolsaReal}). Ajusta el pago o registra ingresos primero.`);
    }
  } catch (err) {
    if (err?.status) throw err;
    // si falla la lectura de bolsa, no bloqueamos por aquí
  }

  const {
    metodo,
    numero_comprobante,
    fecha_comprobante,
    comprobante_url,
    referencia,
    detalle,
    funding_mode,
    source_encargado_id,
    obligacion_ids,
  } = params || {};

  validateFechaComprobante(fecha_comprobante);

  const sourceEncId = source_encargado_id != null ? Number(source_encargado_id) : null;
  const obligacionIds = Array.isArray(obligacion_ids)
    ? obligacion_ids.map((x) => Number(x)).filter((x) => Number.isFinite(x) && x > 0)
    : null;

  const fundingModeRaw = String(funding_mode ?? '').trim().toLowerCase();
  const fundingMode = fundingModeRaw || null; // null => comportamiento legacy

  const wantsAuto = fundingMode === 'auto_encargados';
  const wantsSistema = fundingMode === 'sistema';
  const wantsV3 = wantsAuto || wantsSistema;
  const wantsV2 = wantsV3 || (Number.isFinite(sourceEncId) && sourceEncId > 0) || (obligacionIds && obligacionIds.length);

  const tryBackfillEncargadosForEstudiantes = async (estudianteIds) => {
    const ids = Array.isArray(estudianteIds)
      ? estudianteIds.map((x) => Number(x)).filter((x) => Number.isFinite(x) && x > 0)
      : [];
    if (!ids.length) return { updated: 0, stillMissing: [] };

    const { data: estudiantes, error: eErr } = await supabase
      .from('estudiantes')
      .select('id, encargado_id, nombre_encargado, email_encargado, telefono_encargado')
      .in('id', ids);
    if (eErr) throw eErr;

    let updated = 0;
    const stillMissing = [];

    for (const e of estudiantes || []) {
      const eid = Number(e?.id);
      if (!Number.isFinite(eid) || eid <= 0) continue;
      if (e?.encargado_id) continue;

      const emailEnc = e?.email_encargado ? String(e.email_encargado).trim() : null;
      const telEnc = e?.telefono_encargado ? String(e.telefono_encargado).trim() : null;
      const nomEnc = e?.nombre_encargado ? String(e.nombre_encargado).trim() : null;

      if (!emailEnc && !telEnc) {
        stillMissing.push(eid);
        continue;
      }

      // eslint-disable-next-line no-await-in-loop
      const encargadoId = await getOrCreateEncargadoId({ nombre: nomEnc, email: emailEnc, telefono: telEnc });
      if (!encargadoId) {
        stillMissing.push(eid);
        continue;
      }

      // eslint-disable-next-line no-await-in-loop
      const { error: uErr } = await supabase
        .from('estudiantes')
        .update({ encargado_id: encargadoId })
        .eq('id', eid);
      if (uErr) throw uErr;
      updated += 1;
    }

    return { updated, stillMissing };
  };

  const tryBackfillEncargadosForObligaciones = async (obIds) => {
    const ids = Array.isArray(obIds)
      ? obIds.map((x) => Number(x)).filter((x) => Number.isFinite(x) && x > 0)
      : [];
    if (!ids.length) return { updated: 0, stillMissing: [] };

    const { data: obs, error: oErr } = await supabase
      .from('tesoreria_obligaciones')
      .select('id, estudiante_id')
      .in('id', ids);
    if (oErr) throw oErr;

    const estudianteIds = (obs || [])
      .map((r) => Number(r?.estudiante_id))
      .filter((x) => Number.isFinite(x) && x > 0);

    return await tryBackfillEncargadosForEstudiantes(estudianteIds);
  };

  // Preferir v2/v3 cuando se pide fuente/selección/modo; si no existe, devolver error claro.
  if (wantsV2) {
    const rpcName = wantsV3 ? 'tesoreria_registrar_pago_tutor_v3' : 'tesoreria_registrar_pago_tutor_v2';

    // Datos legacy: si llegan obligaciones de tutor con estudiantes sin encargado_id, intentamos repararlo
    // automáticamente a partir de email/telefono del encargado para no bloquear el pago.
    if (wantsV3) {
      try {
        if (obligacionIds && obligacionIds.length) {
          const { stillMissing } = await tryBackfillEncargadosForObligaciones(obligacionIds);
          if (stillMissing.length) {
            throw httpError(
              409,
              `Hay estudiantes sin encargado asignado: ${stillMissing.join(', ')}. ` +
                'Completa email/telefono del encargado en el estudiante o asigna el encargado antes de pagar al tutor.'
            );
          }
        }
      } catch (err) {
        if (err?.status) throw err;
        // Si el backfill falla por algo no crítico (p.ej. tabla encargados no existe), dejamos que el RPC
        // determine el error real.
      }
    }

    const { data, error } = await supabase.rpc(rpcName, {
      p_tutor_id: tutorIdNum,
      p_monto: montoNum,
      p_fecha_pago: fecha_pago,
      p_source_encargado_id: Number.isFinite(sourceEncId) && sourceEncId > 0 ? sourceEncId : null,
      p_obligacion_ids: obligacionIds && obligacionIds.length ? obligacionIds : null,
      p_funding_mode: wantsAuto ? 'auto_encargados' : (wantsSistema ? 'sistema' : null),
      p_metodo: metodo ?? null,
      p_numero_comprobante: numero_comprobante ?? null,
      p_fecha_comprobante: fecha_comprobante ?? null,
      p_comprobante_url: comprobante_url ?? null,
      p_referencia: referencia ?? null,
      p_detalle: detalle ?? null,
    });
    if (error) {
      const msg = String(error?.message || 'Error registrando pago tutor (v2)');
      if (msg.toLowerCase().includes('function') && msg.toLowerCase().includes('does not exist')) {
        throw httpError(501, wantsV3
          ? (wantsSistema
            ? 'Falta migración Tesorería v2 (RPC tesoreria_registrar_pago_tutor_v3 con modo sistema). Ejecuta la migración 022 (y antes la 021).'
            : 'Falta migración Tesorería v2 (RPC tesoreria_registrar_pago_tutor_v3). Ejecuta la migración 021.')
          : 'Falta migración Tesorería v2 (RPC tesoreria_registrar_pago_tutor_v2). Ejecuta la migración 020.');
      }

      // Si el RPC falla por encargado_id faltante, intentamos reparar y reintentar una vez.
      // Esto cubre el caso sin p_obligacion_ids (FIFO interno) y el caso donde el RPC detecta otro estudiante.
      const lower = msg.toLowerCase();
      const match = lower.match(/estudiante\s+(\d+)\s+no\s+tiene\s+encargado_id/);
      if (wantsV3 && match) {
        const estudianteId = Number(match[1]);
        if (Number.isFinite(estudianteId) && estudianteId > 0) {
          try {
            const { stillMissing } = await tryBackfillEncargadosForEstudiantes([estudianteId]);
            if (!stillMissing.length) {
              const { data: data2, error: error2 } = await supabase.rpc(rpcName, {
                p_tutor_id: tutorIdNum,
                p_monto: montoNum,
                p_fecha_pago: fecha_pago,
                p_source_encargado_id: Number.isFinite(sourceEncId) && sourceEncId > 0 ? sourceEncId : null,
                p_obligacion_ids: obligacionIds && obligacionIds.length ? obligacionIds : null,
                p_funding_mode: wantsAuto ? 'auto_encargados' : (wantsSistema ? 'sistema' : null),
                p_metodo: metodo ?? null,
                p_numero_comprobante: numero_comprobante ?? null,
                p_fecha_comprobante: fecha_comprobante ?? null,
                p_comprobante_url: comprobante_url ?? null,
                p_referencia: referencia ?? null,
                p_detalle: detalle ?? null,
              });
              if (!error2) return data2;
            }
          } catch {
            // ignore: caemos al throw original
          }
        }
      }
      throw error;
    }
    return data;
  }

  const { data, error } = await supabase.rpc('tesoreria_registrar_pago_tutor_v1', {
    p_tutor_id: tutorIdNum,
    p_monto: montoNum,
    p_fecha_pago: fecha_pago,
    p_metodo: metodo ?? null,
    p_numero_comprobante: numero_comprobante ?? null,
    p_fecha_comprobante: fecha_comprobante ?? null,
    p_comprobante_url: comprobante_url ?? null,
    p_referencia: referencia ?? null,
    p_detalle: detalle ?? null,
  });

  if (error) throw error;
  return data;
}

export async function getPagoById(pagoId) {
  const pagoIdNum = Number(pagoId);
  if (!Number.isFinite(pagoIdNum) || pagoIdNum <= 0) {
    throw httpError(400, 'pagoId inválido');
  }

  const { data, error } = await supabase
    .from('tesoreria_pagos')
    .select('id, cuenta_id, metodo, estado, comprobante_url, numero_comprobante, fecha_comprobante')
    .eq('id', pagoIdNum)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function updatePagoEvidenciaYEstado(pagoId, patch) {
  const pagoIdNum = Number(pagoId);
  if (!Number.isFinite(pagoIdNum) || pagoIdNum <= 0) {
    throw httpError(400, 'pagoId inválido');
  }

  const existing = await getPagoById(pagoIdNum);
  if (!existing) throw httpError(404, 'Pago no encontrado');

  if (patch?.comprobante_url && existing.comprobante_url) {
    throw httpError(409, 'Este pago ya tiene comprobante cargado');
  }

  if (patch?.numero_comprobante && String(patch.numero_comprobante).trim()) {
    const numero = String(patch.numero_comprobante).trim();
    const cuentaId = Number(existing.cuenta_id);
    if (Number.isFinite(cuentaId) && cuentaId > 0) {
      const { data: dupRows, error: dupErr } = await supabase
        .from('tesoreria_pagos')
        .select('id')
        .eq('cuenta_id', cuentaId)
        .eq('numero_comprobante', numero)
        .neq('id', pagoIdNum)
        .limit(1);
      if (dupErr) throw dupErr;
      if ((dupRows || []).length) {
        throw httpError(409, 'Número de comprobante ya registrado en esta cuenta');
      }
    }
  }

  // Sin bloqueo por cierre (se permiten cambios históricos).

  const merged = {
    metodo: patch?.metodo !== undefined ? patch.metodo : existing.metodo,
    estado: patch?.estado !== undefined ? patch.estado : existing.estado,
    comprobante_url: patch?.comprobante_url !== undefined ? patch.comprobante_url : existing.comprobante_url,
    numero_comprobante: patch?.numero_comprobante !== undefined ? patch.numero_comprobante : existing.numero_comprobante,
    fecha_comprobante: patch?.fecha_comprobante !== undefined ? patch.fecha_comprobante : existing.fecha_comprobante,
  };

  validateFechaComprobante(merged.fecha_comprobante);
  validateEvidenciaIfNeeded(merged);

  const payload = {
    ...(patch?.metodo !== undefined ? { metodo: patch.metodo } : {}),
    ...(patch?.numero_comprobante !== undefined ? { numero_comprobante: patch.numero_comprobante } : {}),
    ...(patch?.fecha_comprobante !== undefined ? { fecha_comprobante: patch.fecha_comprobante } : {}),
    ...(patch?.referencia !== undefined ? { referencia: patch.referencia } : {}),
    ...(patch?.detalle !== undefined ? { detalle: patch.detalle } : {}),
    ...(patch?.estado !== undefined ? { estado: patch.estado } : {}),
    ...(patch?.comprobante_url !== undefined ? { comprobante_url: patch.comprobante_url } : {}),
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('tesoreria_pagos')
    .update(payload)
    .eq('id', pagoIdNum)
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

export default {
  registrarPagoEncargadoV1,
  registrarPagoTutorV1,
  updatePagoEvidenciaYEstado,
  getPagoById,
  validateMontoFecha,
  validateFechaComprobante,
  validateEvidenciaIfNeeded,
};
