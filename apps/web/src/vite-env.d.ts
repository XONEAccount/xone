/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  readonly VITE_PRIVY_APP_ID: string;
  readonly VITE_PRIVY_CLIENT_ID?: string;
  readonly VITE_RPC_URL?: string;
  readonly VITE_ETHERSCAN_API_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
