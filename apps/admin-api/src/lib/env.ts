/**
 * Loads admin-api environment variables for Node and Workers.
 * @returns Parsed environment configuration
 */
export function getEnv() {
  const port = Number(process.env.API_PORT ?? process.env.PORT ?? "4397");

  return {
    port: Number.isFinite(port) ? port : 4397,
    corsOrigin: process.env.API_CORS_ORIGIN ?? "*",
    supabaseUrl: process.env.SUPABASE_URL ?? "",
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY ?? "",
    supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
    adminJwtSecret: process.env.ADMIN_JWT_SECRET ?? "",
    /**
     * Comma-separated EVM addresses allowed to sign in to the ops console.
     * Example: `0xabc…,0xdef…`
     */
    adminWallets: process.env.ADMIN_WALLETS ?? "",
  };
}

export type AdminApiEnv = ReturnType<typeof getEnv>;
