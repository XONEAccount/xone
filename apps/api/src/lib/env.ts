/**
 * Loads and validates API environment variables.
 * Works for local Node and Cloudflare Workers vars.
 * @returns Parsed environment configuration
 */
export function getEnv() {
  const port = Number(process.env.API_PORT ?? process.env.PORT ?? "8787");
  const llmProvider = (process.env.LLM_PROVIDER ?? "deepseek").toLowerCase();
  const deepseekApiKey = process.env.DEEPSEEK_API_KEY ?? "";
  const openaiApiKey =
    process.env.OPENAI_API_KEY ||
    (llmProvider === "deepseek" ? deepseekApiKey : "") ||
    "";

  return {
    port: Number.isFinite(port) ? port : 8787,
    corsOrigin: process.env.API_CORS_ORIGIN ?? "*",
    supabaseUrl: process.env.SUPABASE_URL ?? "",
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY ?? "",
    supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
    thirdwebClientId: process.env.THIRDWEB_CLIENT_ID ?? "",
    thirdwebSecretKey: process.env.THIRDWEB_SECRET_KEY ?? "",
    /** Prefer DEEPSEEK_API_KEY when LLM_PROVIDER=deepseek. */
    openaiApiKey,
    deepseekApiKey,
    llmProvider,
    llmBaseUrl:
      process.env.LLM_BASE_URL ??
      (llmProvider === "deepseek" ? "https://api.deepseek.com" : "https://api.openai.com/v1"),
    llmModel:
      process.env.LLM_MODEL ??
      (llmProvider === "deepseek" ? "deepseek-chat" : "gpt-4o-mini"),
    jwtSecret: process.env.JWT_SECRET ?? "",
    custodyPrivateKey: process.env.CUSTODY_PRIVATE_KEY ?? "",
    custodyAddress: process.env.CUSTODY_ADDRESS ?? "",
    rpcUrl: process.env.RPC_URL ?? "",
  };
}

export type ApiEnv = ReturnType<typeof getEnv>;
