/**
 * finanzas.repository.mjs
 *
 * Único módulo que accede a la BD para la feature finanzas.
 * Requiere supabaseAdmin — lanza 503 si no está disponible.
 */

import { supabaseAdmin } from '../../shared/config/supabaseClient.mjs';
import { AppError } from '../../shared/errors/AppError.mjs';

function requireAdmin() {
  if (!supabaseAdmin) throw new AppError('Servicio de administración no disponible (SUPABASE_SERVICE_ROLE_KEY faltante).', 503);
  return supabaseAdmin;
}

/* ─── movimientos_financieros ────────────────────────────────────────────── */

export async function listMovimientos({ tipo, estado, referencia_tabla, referencia_id, curso_id, matricula_grupo_id, fecha_inicio, fecha_fin }) {
  const db = requireAdmin();
  let query = db.from('movimientos_financieros').select('*');
  if (tipo) query = query.eq('tipo', tipo);
  if (estado) query = query.eq('estado', estado);
  if (referencia_tabla) query = query.eq('referencia_tabla', referencia_tabla);
  if (referencia_id) query = query.eq('referencia_id', parseInt(String(referencia_id), 10));
  if (curso_id) query = query.eq('curso_id', parseInt(String(curso_id), 10));
  if (matricula_grupo_id) query = query.eq('matricula_grupo_id', parseInt(String(matricula_grupo_id), 10));
  if (fecha_inicio) query = query.gte('fecha', fecha_inicio);
  if (fecha_fin) query = query.lte('fecha', fecha_fin);
  query = query.order('fecha', { ascending: false }).order('created_at', { ascending: false });
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

/* ─── comprobantes_ingresos ─────────────────────────────────────────────── */

export async function createComprobante({ numero_comprobante, monto, fecha_comprobante, pagador_nombre, pagador_contacto, detalle, movimiento_financiero_id, foto_url, userId }) {
  const db = requireAdmin();
  if (!numero_comprobante || !monto || !fecha_comprobante || !pagador_nombre) {
    throw new AppError('numero_comprobante, monto, fecha_comprobante y pagador_nombre son requeridos.', 422);
  }
  const montoNum = parseFloat(String(monto));
  if (!Number.isFinite(montoNum) || montoNum <= 0) throw new AppError('monto debe ser un número positivo.', 422);
  const { data, error } = await db.from('comprobantes_ingresos').insert({
    numero_comprobante: String(numero_comprobante).trim(),
    monto: montoNum,
    fecha_comprobante: String(fecha_comprobante).trim(),
    pagador_nombre: String(pagador_nombre).trim(),
    pagador_contacto: pagador_contacto ? String(pagador_contacto).trim() : null,
    detalle: detalle ? String(detalle).trim() : null,
    movimiento_financiero_id: movimiento_financiero_id ? parseInt(String(movimiento_financiero_id), 10) : null,
    foto_url: foto_url ? String(foto_url).trim() : null,
    estado: 'pendiente',
    created_by: userId,
    updated_by: userId,
    updated_at: new Date().toISOString(),
  }).select('*').single();
  if (error) throw error;
  return data;
}

export async function listComprobantes() {
  const db = requireAdmin();
  const { data, error } = await db.from('comprobantes_ingresos').select('*').order('fecha_comprobante', { ascending: false }).order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function updateComprobanteEstado(id, { estado, userId }) {
  const db = requireAdmin();
  if (!estado) throw new AppError('estado es requerido.', 422);
  const { data, error } = await db.from('comprobantes_ingresos').update({ estado: String(estado).trim(), updated_by: userId, updated_at: new Date().toISOString() }).eq('id', id).select('*').single();
  if (error) throw error;
  return data;
}
