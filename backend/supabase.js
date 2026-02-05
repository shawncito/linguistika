import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import dns from 'dns';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Cargar .env del backend explícitamente (evita problemas al empaquetar con Electron)
dotenv.config({ path: path.join(__dirname, '.env') });

// En algunos entornos Windows/redes corporativas, IPv6 puede causar timeouts hacia *.supabase.co.
// Esto prioriza IPv4 para reducir errores de conexión.
try {
  dns.setDefaultResultOrder('ipv4first');
} catch {
  // ignore
}

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;
const supabaseFetchTimeoutMs = parseInt(process.env.SUPABASE_FETCH_TIMEOUT_MS || '20000', 10);

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Error: SUPABASE_URL y SUPABASE_ANON_KEY deben estar configurados en .env');
  process.exit(1);
}

const fetchWithTimeout = async (input, init = {}) => {
  const timeoutMs = Number.isFinite(supabaseFetchTimeoutMs) ? supabaseFetchTimeoutMs : 20000;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
};

// Cliente de Supabase para consultas públicas
export const supabase = createClient(supabaseUrl, supabaseKey, {
  global: { fetch: fetchWithTimeout },
});

// Cliente con service role key para acciones administrativas (opcional)
export const supabaseAdmin = supabaseServiceKey 
  ? createClient(supabaseUrl, supabaseServiceKey, { global: { fetch: fetchWithTimeout } })
  : null;

// Cliente por-request con el JWT del usuario (útil si activas RLS)
export function supabaseForToken(token) {
  return createClient(supabaseUrl, supabaseKey, {
    global: {
      headers: {
        Authorization: `Bearer ${token}`
      },
      fetch: fetchWithTimeout,
    }
  });
}

console.log('✅ Cliente Supabase inicializado');

export default supabase;
