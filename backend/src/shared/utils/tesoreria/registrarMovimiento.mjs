import { supabase } from '../../config/supabaseClient.mjs';
import { getOrCreateEncargadoId } from '../encargados.mjs';
import { AppError } from '../../errors/AppError.mjs';

const isValidISODate = (value) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);

function normalizeEstado(value) {
  if (value == null) return '';
  return String(value).trim().toLowerCase();
}

function normalizeMetodo(value) {
  if (value == null) return '';
  return String(value).trim().toLowerCase();
}

export function validateMontoFecha({ monto, fecha_pago }) {
  const montoNum = Number(monto);
  if (!Number.isFinite(montoNum) || montoNum <= 0) {
    throw new AppError('monto debe ser > 0', 400);
  }
  if (!isValidISODate(String(fecha_pago || ''))) {
    throw new AppError('fecha_pago requerida (YYYY-MM-DD)', 400);
  }
  return { montoNum, fecha_pago: String(fecha_pago) };
}

export function validateFechaComprobante(fecha_comprobante) {
  if (fecha_comprobante && !isValidISODate(String(fecha_comprobante))) {
    throw new AppError('fecha_comprobante debe ser YYYY-MM-DD', 400);
  }
}

export function validateEvidenciaIfNeeded({ metodo, estado, numero_comprobante, fecha_comprobante, comprobante_url }) {
  const finalMetodo = normalizeMetodo(metodo);
  const finalEstado = normalizeEstado(estado);

  const isReal = finalEstado === 'completado' || finalEstado === 'verificado';
  const needsEvidence = isReal && finalMetodo && finalMetodo !== 'efectivo';

  if (!needsEvidence) return;

  if (!numero_comprobante) throw new AppError('numero_comprobante requerido para pagos no-efectivo cuando el estado es completado/verificado', 400);
  if (!fecha_comprobante) throw new AppError('fecha_comprobante requerido para pagos no-efectivo cuando el estado es completado/verificado', 400);
  if (!comprobante_url) throw new AppError('comprobante_url requerido para pagos no-efectivo cuando el estado es completado/verificado', 400);
}

export async function registrarPagoEncargadoV1(params) {
  const { encargadoId } = params || {};
  const encargadoIdNum = Number(encargadoId);
  if (!Number.isFinite(encargadoIdNum) || encargadoIdNum <= 0) {
    throw new AppError('encargadoId inválido', 400);
  }

  const { montoNum, fecha_pago } = validateMontoFecha(params);

  const { metodo, numero_comprobante, fecha_comprobante, comprobante_url, referencia, detalle } = params || {};

  validateFechaComprobante(fecha_comprobante);

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
    throw new AppError('tutorId inválido', 400);
  }

  const { montoNum, fecha_pago } = validateMontoFecha(params);

  try {
    const { data: bolsaRow } = await supabase
      .from('tesoreria_bolsa_v1')
      .select('bolsa_real')
      .maybeSingle();
    const bolsaReal = Number(bolsaRow?.bolsa_real) || 0;
    if (montoNum > bolsaReal) {
      throw new AppError(`Monto supera bolsa real (${bolsaReal}). Ajusta el pago o registra ingresos primero.`, 400);
    }
  } catch (err) {
    if (err instanceof AppError) throw err;
    // si falla la lectura de bolsa, no bloqueamos
  }

  const {
    metodo, numero_comprobante, fecha_comprobante, comprobante_url,
    referencia, detalle, funding_mode, source_encargado_id, obligacion_ids,
  } = params || {};

  validateFechaComprobante(fecha_comprobante);

  const sourceEncId = source_encargado_id != null ? Number(source_encargado_id) : null;
  const obligacionIds = Array.isArray(obligacion_ids)
    ? obligacion_ids.map((x) => Number(x)).filter((x) => Number.isFinite(x) && x > 0)
    : null;

  const fundingModeRaw = String(funding_mode ?? '').trim().toLowerCase();
  const fundingMode = fundingModeRaw || null;

  const wantsAuto = fundingMode === 'auto_encargados';
  const wantsSistema = fundingMode === 'sistema';
  const wantsV3 = wantsAuto || wantsSistema;
  const wantsV2 = wantsV3 || (Number.isFinite(sourceEncId) && sourceEncId > 0) || (obligacionIds && obligacionIds.length);

  const commonParams = {
    p_tutor_id: tutorIdNum,
    p_monto: montoNum,
    p_fecha_pago: fecha_pago,
    p_metodo: metodo ?? null,
    p_numero_comprobante: numero_comprobante ?? null,
    p_fecha_comprobante: fecha_comprobante ?? null,
    p_comprobante_url: comprobante_url ?? null,
    p_referencia: referencia ?? null,
    p_detalle: detalle ?? null,
  };

  if (wantsV3) {
    const { data, error } = await supabase.rpc('tesoreria_registrar_pago_tutor_v3', {
      ...commonParams,
      p_funding_mode: fundingMode,
      p_source_encargado_id: sourceEncId,
      p_obligacion_ids: obligacionIds,
    });
    if (error) {
      const msg = String(error?.message || '').toLowerCase();
      if (msg.includes('does not exist')) {
        // fallback to v2
      } else {
        throw error;
      }
    } else {
      return data;
    }
  }

  if (wantsV2) {
    const { data, error } = await supabase.rpc('tesoreria_registrar_pago_tutor_v2', {
      ...commonParams,
      p_source_encargado_id: sourceEncId,
      p_obligacion_ids: obligacionIds,
    });
    if (error) {
      const msg = String(error?.message || '').toLowerCase();
      if (!msg.includes('does not exist')) throw error;
    } else {
      return data;
    }
  }

  const { data, error } = await supabase.rpc('tesoreria_registrar_pago_tutor_v1', commonParams);
  if (error) throw error;
  return data;
}

export async function updatePagoEvidenciaYEstado(params) {
  const { pagoId, estado, comprobante_url, numero_comprobante, fecha_comprobante } = params || {};
  const pagoIdNum = Number(pagoId);
  if (!Number.isFinite(pagoIdNum) || pagoIdNum <= 0) {
    throw new AppError('pagoId inválido', 400);
  }

  validateFechaComprobante(fecha_comprobante);

  const update = { updated_at: new Date().toISOString() };
  if (estado !== undefined) update.estado = estado;
  if (comprobante_url !== undefined) update.comprobante_url = comprobante_url;
  if (numero_comprobante !== undefined) update.numero_comprobante = numero_comprobante;
  if (fecha_comprobante !== undefined) update.fecha_comprobante = fecha_comprobante;

  const { data, error } = await supabase
    .from('tesoreria_pagos')
    .update(update)
    .eq('id', pagoIdNum)
    .select('*')
    .single();

  if (error) throw error;
  return data;
}
