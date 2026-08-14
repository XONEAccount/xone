/**
 * Cloudflare Worker bindings for the XOne Hono API.
 */
export type ApiBindings = {
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  /**
   * Legacy HS256 JWT secret from Supabase project settings.
   * Prefer JWKS when available; this covers classic projects.
   */
  SUPABASE_JWT_SECRET?: string;
  /** 32-byte key as 64 hex chars for AES-GCM wallet encryption. */
  WALLET_ENCRYPTION_KEY: string;
  /** Comma-separated allowed browser origins. */
  CORS_ORIGIN?: string;
};

/**
 * Hono app variables set by middleware.
 */
export type ApiVariables = {
  userId: string;
  userEmail: string;
  apiKeyId?: string;
};
