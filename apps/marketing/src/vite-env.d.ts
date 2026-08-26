/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CONSOLE_URL?: string;
  readonly VITE_DOCS_URL?: string;
  readonly VITE_DOCS_API_URL?: string;
  readonly VITE_PLAYGROUND_URL?: string;
  readonly VITE_WALLET_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
