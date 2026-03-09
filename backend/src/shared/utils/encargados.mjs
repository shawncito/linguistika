import { supabase } from '../config/supabaseClient.mjs';

function isMissingEncargadosTable(error) {
  const msg = String(error?.message || error || '');
  return msg.includes('does not exist') && msg.includes('encargados');
}

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

    if (!emailNorm && !telefonoNorm && nombreClean) {
      const { data, error } = await supabase
        .from('encargados')
        .select('id')
        .eq('nombre', nombreClean)
        .maybeSingle();
      if (error) throw error;
      if (data?.id) return data.id;
    }

    const { data: inserted, error: iErr } = await supabase
      .from('encargados')
      .insert({ nombre: nombreClean || null, email: emailNorm || null, telefono: telefonoNorm || null })
      .select('id')
      .single();

    if (iErr) {
      if (String(iErr?.code || '') === '23505') {
        if (emailNorm) {
          const { data, error } = await supabase.from('encargados').select('id').eq('email_norm', emailNorm).maybeSingle();
          if (error) throw error;
          if (data?.id) return data.id;
        }
        if (telefonoNorm) {
          const { data, error } = await supabase.from('encargados').select('id').eq('telefono_norm', telefonoNorm).maybeSingle();
          if (error) throw error;
          if (data?.id) return data.id;
        }
      }
      throw iErr;
    }

    return inserted?.id || null;
  } catch (error) {
    if (isMissingEncargadosTable(error)) return null;
    throw error;
  }
}
