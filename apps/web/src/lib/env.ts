/**
 * Reads Vite public environment variables for the web app.
 */
export function getWebEnv() {
  return {
    apiUrl: import.meta.env.VITE_API_URL ?? "http://localhost:4396",
    supabaseUrl: import.meta.env.VITE_SUPABASE_URL ?? "",
    supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY ?? "",
    thirdwebClientId: import.meta.env.VITE_THIRDWEB_CLIENT_ID ?? "",
  };
}
