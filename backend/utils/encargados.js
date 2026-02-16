import { supabase } from '../supabase.js';

const isMissingEncargadosTable = (error) => {
  const msg = String(error?.message || error || '');
  return msg.includes('does not exist') && msg.includes('encargados');
};

export async function getOrCreateEncargadoId({ nombre, email, telefono }) {
  const emailNorm = email ? String(email).trim().toLowerCase() : null;
  const telefonoNorm = telefono ? String(telefono).trim() : null;
  const nombreClean = nombre ? String(nombre).trim() : null;

  if (!emailNorm && !telefonoNorm && !nombreClean) return null;

  try {
    if (emailNorm) {
      const { data, error } = await supabase
        .from('encargados')
        .select('id')
        .eq('email_norm', emailNorm)
        .maybeSingle();
      if (error) throw error;
      if (data?.id) return data.id;
    }

    if (telefonoNorm) {
      const { data, error } = await supabase
        .from('encargados')
        .select('id')
        .eq('telefono_norm', telefonoNorm)
        .maybeSingle();
      if (error) throw error;
      if (data?.id) return data.id;
    }

    // Fallback: si no hay email/teléfono pero sí nombre, intentamos match por nombre.
    // No es perfecto (pueden existir homónimos), pero evita perder cobros en tesorería.
    if (!emailNorm && !telefonoNorm && nombreClean) {
      const { data, error } = await supabase
        .from('encargados')
        .select('id')
        .eq('nombre', nombreClean)
        .maybeSingle();
      if (error) throw error;
      if (data?.id) return data.id;
    }

    // No existe: insert (y si hay carrera por UNIQUE, reintentar select)
    const { data: inserted, error: iErr } = await supabase
      .from('encargados')
      .insert({
        nombre: nombreClean || null,
        email: emailNorm || null,
        telefono: telefonoNorm || null,
      })
      .select('id')
      .single();

    if (iErr) {
      if (String(iErr?.code || '') === '23505') {
        if (emailNorm) {
          const { data, error } = await supabase
            .from('encargados')
            .select('id')
            .eq('email_norm', emailNorm)
            .maybeSingle();
          if (error) throw error;
          if (data?.id) return data.id;
        }
        if (telefonoNorm) {
          const { data, error } = await supabase
            .from('encargados')
            .select('id')
            .eq('telefono_norm', telefonoNorm)
            .maybeSingle();
          if (error) throw error;
          if (data?.id) return data.id;
        }
      }
      throw iErr;
    }

    return inserted?.id || null;
  } catch (error) {
    // Compat: si la tabla no existe, no bloqueamos.
    if (isMissingEncargadosTable(error)) return null;
    throw error;
  }
}
