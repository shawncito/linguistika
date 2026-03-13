import { supabaseAdmin } from '../../shared/config/supabaseClient.mjs';
import AppError from '../../shared/errors/AppError.mjs';
import {
  buildAdminPaginas,
  isPaginasTableMissingError,
  resolvePageName,
} from '../paginas/paginas.constants.mjs';

function requireAdmin() {
  if (!supabaseAdmin) {
    throw new AppError('SUPABASE_SERVICE_KEY no configurado; no se puede gestionar usuarios desde el backend.', 503);
  }
  return supabaseAdmin;
}

export async function createEmployee({ email, password, rol = 'tutor_view_only', nombre_completo = null, telefono = null, email_confirm = true }) {
  const admin = requireAdmin();

  if (!email || !password) throw new AppError('Campos requeridos: email, password', 400);

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm,
  });

  if (createErr) throw new AppError(createErr.message, 400);

  const userId = created.user?.id;
  if (!userId) throw new AppError('No se pudo obtener el id del usuario creado', 500);

  const { data: perfil, error: perfilErr } = await admin
    .from('usuarios')
    .upsert({
      id: userId,
      rol,
      nombre_completo,
      telefono,
      estado: true,
      updated_at: new Date().toISOString(),
    })
    .select('id, rol, nombre_completo, telefono, estado')
    .single();

  if (perfilErr) throw new AppError(perfilErr.message, 400);

  return { id: userId, email, perfil };
}

export async function listEmployees() {
  const admin = requireAdmin();

  const { data: usuarios, error } = await admin
    .from('usuarios')
    .select('id, rol, nombre_completo, telefono, estado, created_at, updated_at')
    .order('created_at', { ascending: false });

  if (error) throw error;

  const { data: authUsers, error: authError } = await admin.auth.admin.listUsers({ perPage: 1000 });

  if (authError) {
    console.error('Error obteniendo auth users:', authError);
    return usuarios;
  }

  const emailMap = {};
  (authUsers?.users || []).forEach((u) => { emailMap[u.id] = u.email; });

  return (usuarios || []).map((u) => ({ ...u, email: emailMap[u.id] || null }));
}

export async function updateEmployee(id, { rol, estado, nombre_completo, telefono }) {
  const admin = requireAdmin();

  const update = { updated_at: new Date().toISOString() };
  if (rol !== undefined) update.rol = rol;
  if (estado !== undefined) update.estado = !!estado;
  if (nombre_completo !== undefined) update.nombre_completo = nombre_completo;
  if (telefono !== undefined) update.telefono = telefono;

  const { data, error } = await admin
    .from('usuarios')
    .update(update)
    .eq('id', id)
    .select('id, rol, nombre_completo, telefono, estado, created_at, updated_at')
    .single();

  if (error) throw error;
  return data;
}

export async function deleteEmployee(userId) {
  const admin = requireAdmin();

  const { error: delPerfilErr } = await admin.from('usuarios').delete().eq('id', userId);
  if (delPerfilErr) throw new AppError(delPerfilErr.message, 400);

  const { error: delAuthErr } = await admin.auth.admin.deleteUser(userId);
  if (delAuthErr) throw new AppError(delAuthErr.message, 400);

  return { ok: true, id: userId };
}

export async function listarPaginasAdmin() {
  const admin = requireAdmin();
  const { data, error } = await admin
    .from('paginas_mantenimiento')
    .select('slug, nombre, activa, desactivada_por, desactivada_por_nombre, mensaje, updated_at')
    .order('slug');
  if (error) {
    if (isPaginasTableMissingError(error)) {
      return buildAdminPaginas();
    }
    throw error;
  }
  return buildAdminPaginas(data ?? []);
}

export async function togglePaginaAdmin(slug, { activa, desactivada_por, desactivada_por_nombre, mensaje }) {
  const admin = requireAdmin();
  const slugNorm = String(slug || '').trim().toLowerCase();
  if (!slugNorm) throw new AppError('Slug de página inválido', 400);

  const update = {
    slug: slugNorm,
    nombre: resolvePageName(slugNorm),
    activa,
    updated_at: new Date().toISOString(),
    desactivada_por: activa ? null : (desactivada_por ?? null),
    desactivada_por_nombre: activa ? null : (desactivada_por_nombre ?? null),
    mensaje: activa ? null : (mensaje ?? null),
  };
  const { data, error } = await admin
    .from('paginas_mantenimiento')
    .upsert(update, { onConflict: 'slug' })
    .select('slug, nombre, activa, desactivada_por, desactivada_por_nombre, mensaje, updated_at')
    .single();
  if (error) {
    if (isPaginasTableMissingError(error)) {
      throw new AppError('Falta aplicar la migración 027_paginas_mantenimiento.sql en Supabase para poder guardar cambios de páginas.', 409);
    }
    throw new AppError(error.message, 400);
  }
  return data;
}
