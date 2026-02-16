import { createClient, SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

let client: SupabaseClient | null = null;

if (!url || !key) {
  console.warn('Supabase realtime deshabilitado: faltan VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY');
} else {
  client = createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    realtime: {
      params: {
        eventsPerSecond: 5,
      },
    },
  });
}

export const supabaseClient = client;
