/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  readonly VITE_USE_REMOTE?: string;
  readonly VITE_PLAYGROUND_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
