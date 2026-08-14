/**
 * Reads Vite public environment variables for the web app.
 */
export function getWebEnv() {
  return {
    apiUrl: import.meta.env.VITE_API_URL ?? "http://localhost:4396",
    supabaseUrl: import.meta.env.VITE_SUPABASE_URL ?? "",
    supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY ?? "",
    privyAppId: import.meta.env.VITE_PRIVY_APP_ID ?? "",
    privyClientId: import.meta.env.VITE_PRIVY_CLIENT_ID ?? "",
    rpcUrl: import.meta.env.VITE_RPC_URL ?? "",
  };
}
