import dotenv from 'dotenv';
import { supabaseAdmin } from '../supabase.js';

dotenv.config();

function getArg(name) {
  const idx = process.argv.indexOf(`--${name}`);
  if (idx === -1) return null;
  return process.argv[idx + 1] ?? null;
}

async function main() {
  if (!supabaseAdmin) {
    throw new Error('SUPABASE_SERVICE_KEY no configurado. Agrega SUPABASE_SERVICE_KEY en backend/.env');
  }

  const email = getArg('email') || process.env.BOOTSTRAP_ADMIN_EMAIL;
  const password = getArg('password') || process.env.BOOTSTRAP_ADMIN_PASSWORD;
  const nombre = getArg('nombre') || process.env.BOOTSTRAP_ADMIN_NOMBRE || null;
  const telefono = getArg('telefono') || process.env.BOOTSTRAP_ADMIN_TELEFONO || null;

  if (!email) {
    throw new Error('Falta --email (o BOOTSTRAP_ADMIN_EMAIL)');
  }

  let userId = null;

  // 1) Buscar usuario por email (listUsers y filtro local)
  const { data: listData, error: listErr } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000, page: 1 });
  if (listErr) throw listErr;

  const existing = (listData?.users || []).find((u) => (u.email || '').toLowerCase() === String(email).toLowerCase());
  if (existing?.id) {
    userId = existing.id;
  }

  // 2) Si no existe, crearlo (requiere password)
  if (!userId) {
    if (!password) {
      throw new Error('El usuario no existe en auth. Provee --password (o BOOTSTRAP_ADMIN_PASSWORD) para crearlo.');
    }

    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (createErr) throw createErr;
    userId = created?.user?.id;
  }

  if (!userId) {
    throw new Error('No se pudo determinar el userId del admin');
  }

  // 3) Upsert en public.usuarios como admin
  const { data: perfil, error: perfilErr } = await supabaseAdmin
    .from('usuarios')
    .upsert({
      id: userId,
      rol: 'admin',
      nombre_completo: nombre,
      telefono,
      estado: true,
      updated_at: new Date().toISOString(),
    })
    .select('id, rol, nombre_completo, telefono, estado, created_at, updated_at')
    .single();

  if (perfilErr) throw perfilErr;

  // eslint-disable-next-line no-console
  console.log(JSON.stringify({ ok: true, email, id: userId, perfil }, null, 2));
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('❌ bootstrapAdmin falló:', err?.message || err);
  process.exit(1);
});
