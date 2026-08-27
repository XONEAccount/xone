/**
 * Cloudflare Worker bindings that mirror process.env for Node/local.
 */
export type WorkerBindings = {
  API_CORS_ORIGIN?: string;
  SUPABASE_URL?: string;
  SUPABASE_ANON_KEY?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  WALLET_SUPABASE_URL?: string;
  WALLET_SUPABASE_ANON_KEY?: string;
  WALLET_SUPABASE_SERVICE_ROLE_KEY?: string;
  ADMIN_JWT_SECRET?: string;
  /** Comma-separated allowlisted admin wallets. */
  ADMIN_WALLETS?: string;
};

const BINDING_KEYS: (keyof WorkerBindings)[] = [
  "API_CORS_ORIGIN",
  "SUPABASE_URL",
  "SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "WALLET_SUPABASE_URL",
  "WALLET_SUPABASE_ANON_KEY",
  "WALLET_SUPABASE_SERVICE_ROLE_KEY",
  "ADMIN_JWT_SECRET",
  "ADMIN_WALLETS",
];

/**
 * Copies Cloudflare Worker bindings into process.env so getEnv() works on Workers.
 * @param bindings - Request-scoped Worker env
 */
export function applyWorkerBindings(bindings: WorkerBindings | undefined): void {
  if (!bindings) return;
  for (const key of BINDING_KEYS) {
    const value = bindings[key];
    if (typeof value === "string" && value.length > 0) {
      process.env[key] = value;
    }
  }
}
