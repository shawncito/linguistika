import { createClient } from '@supabase/supabase-js';
import { setGlobalDispatcher, Agent } from 'undici';
import dns from 'dns';

// IPv4 first to avoid IPv6 issues on Windows
dns.setDefaultResultOrder('ipv4first');

setGlobalDispatcher(new Agent({ connect: { rejectUnauthorized: false } }));

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const TIMEOUT_MS = Number(process.env.SUPABASE_FETCH_TIMEOUT_MS) || 15000;
const MAX_RETRIES = 2;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('⚠️  SUPABASE_URL y SUPABASE_ANON_KEY son requeridas');
}

const TRANSIENT_CODES = new Set([
  'UND_ERR_CONNECT_TIMEOUT',
  'ETIMEDOUT',
  'ECONNRESET',
  'ECONNREFUSED',
  'ENOTFOUND',
  'EAI_AGAIN',
]);

function isTransientError(err) {
  const code = err?.cause?.code || err?.code;
  const name = err?.cause?.name || err?.name;
  const msg = String(err?.message || '').toLowerCase();
  return (
    TRANSIENT_CODES.has(code) ||
    name === 'AbortError' ||
    msg.includes('fetch failed') ||
    msg.includes('network')
  );
}

function fetchWithTimeout(url, options) {
  let attempt = 0;

  const tryFetch = async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const response = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(timer);
      return response;
    } catch (err) {
      clearTimeout(timer);
      if (attempt < MAX_RETRIES && isTransientError(err)) {
        attempt++;
        await new Promise((r) => setTimeout(r, 200 * attempt));
        return tryFetch();
      }
      throw err;
    }
  };

  return tryFetch();
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { fetch: fetchWithTimeout },
});

export const supabaseAdmin = SUPABASE_SERVICE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: fetchWithTimeout },
    })
  : null;

export function supabaseForToken(token) {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: fetchWithTimeout,
      headers: { Authorization: `Bearer ${token}` },
    },
  });
}
