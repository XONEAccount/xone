/**
 * Cloudflare Worker bindings that mirror process.env for Node/local.
 */
export type WorkerBindings = {
  ALLOW_DEMO_AUTH?: string;
  API_CORS_ORIGIN?: string;
  SUPABASE_URL?: string;
  SUPABASE_ANON_KEY?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  OPENAI_API_KEY?: string;
  DEEPSEEK_API_KEY?: string;
  LLM_PROVIDER?: string;
  LLM_BASE_URL?: string;
  LLM_MODEL?: string;
  JWT_SECRET?: string;
  CUSTODY_PRIVATE_KEY?: string;
  CUSTODY_ADDRESS?: string;
  RELAYER_PRIVATE_KEY?: string;
  RPC_URL?: string;
};

const BINDING_KEYS: (keyof WorkerBindings)[] = [
  "ALLOW_DEMO_AUTH",
  "API_CORS_ORIGIN",
  "SUPABASE_URL",
  "SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "OPENAI_API_KEY",
  "DEEPSEEK_API_KEY",
  "LLM_PROVIDER",
  "LLM_BASE_URL",
  "LLM_MODEL",
  "JWT_SECRET",
  "CUSTODY_PRIVATE_KEY",
  "CUSTODY_ADDRESS",
  "RELAYER_PRIVATE_KEY",
  "RPC_URL",
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
