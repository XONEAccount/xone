import { serve } from "@hono/node-server";
import { config } from "dotenv";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import app from "./index";
import type { ApiBindings } from "./env";

const here = fileURLToPath(new URL(".", import.meta.url));
config({ path: resolve(here, "../.env") });

/**
 * Loads bindings from api/.env for local Node.
 *
 * @returns API bindings
 */
function loadEnv(): ApiBindings {
  const required = [
    "SUPABASE_URL",
    "SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "WALLET_ENCRYPTION_KEY",
  ] as const;

  for (const key of required) {
    if (!process.env[key]?.trim()) {
      throw new Error(`Missing ${key} in api/.env`);
    }
  }

  return {
    SUPABASE_URL: process.env.SUPABASE_URL!,
    SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY!,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY!,
    SUPABASE_JWT_SECRET: process.env.SUPABASE_JWT_SECRET,
    WALLET_ENCRYPTION_KEY: process.env.WALLET_ENCRYPTION_KEY!,
    CORS_ORIGIN: process.env.CORS_ORIGIN,
  };
}

const bindings = loadEnv();
const port = Number(process.env.PORT || 8787);

serve(
  {
    port,
    fetch: (request) => app.fetch(request, bindings),
  },
  (info) => {
    console.log(`xone-api (node) http://127.0.0.1:${info.port}`);
  },
);
