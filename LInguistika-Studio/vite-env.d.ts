/// <reference types="vite/client" />

type ViteEnvValue = string | undefined;

interface ImportMetaEnv {
  readonly VITE_API_URL?: ViteEnvValue;
  readonly VITE_SUPABASE_URL?: ViteEnvValue;
  readonly VITE_SUPABASE_ANON_KEY?: ViteEnvValue;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
