import { supabase } from '../../shared/config/supabaseClient.mjs';
import { AppError } from '../../shared/errors/AppError.mjs';

export async function loginUser({ email, password }) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new AppError(error.message, 401);

  const session = data.session;
  const userId = data.user?.id;

  // Obtener perfil del empleado
  const { data: perfil } = await supabase
    .from('usuarios')
    .select('rol, estado, nombre_completo, telefono')
    .eq('id', userId)
    .maybeSingle();

  if (perfil && perfil.estado === false) {
    await supabase.auth.signOut();
    throw new AppError('Cuenta desactivada', 403);
  }

  return {
    token: session.access_token,
    user: {
      id: userId,
      email: data.user?.email,
      rol: perfil?.rol ?? null,
      estado: perfil?.estado ?? true,
      nombre_completo: perfil?.nombre_completo ?? null,
      telefono: perfil?.telefono ?? null,
    },
  };
}

export async function registerUser({ email, password }) {
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw new AppError(error.message, 400);

  return {
    message: 'Usuario registrado correctamente',
    user: { id: data.user?.id, email: data.user?.email },
  };
}

export async function logoutUser(token) {
  await supabase.auth.signOut();
  return { message: 'Sesión cerrada correctamente' };
}

export async function getMe(userId, token) {
  const { data: perfil } = await supabase
    .from('usuarios')
    .select('rol, estado, nombre_completo, telefono')
    .eq('id', userId)
    .maybeSingle();

  // Obtener email desde auth
  const { data: { user } } = await supabase.auth.getUser(token);

  return {
    user: {
      id: userId,
      email: user?.email ?? null,
      rol: perfil?.rol ?? null,
      estado: perfil?.estado ?? true,
      nombre_completo: perfil?.nombre_completo ?? null,
      telefono: perfil?.telefono ?? null,
    },
  };
}
