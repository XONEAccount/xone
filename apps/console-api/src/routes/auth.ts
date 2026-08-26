import { Hono } from "hono";
import { createClient } from "@supabase/supabase-js";
import type { ApiBindings, ApiVariables } from "../env";
import { HttpError } from "../lib/errors";
import { createServiceClient } from "../lib/supabase";

type Env = { Bindings: ApiBindings; Variables: ApiVariables };

export const authRoutes = new Hono<Env>();

/**
 * Registers a user without sending a confirmation email.
 * Uses the service role to create an already-confirmed account, then returns a session.
 */
authRoutes.post("/register", async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as {
    email?: string;
    password?: string;
    name?: string;
  };

  const email = body.email?.trim().toLowerCase() ?? "";
  const password = body.password ?? "";
  const name = body.name?.trim() || email.split("@")[0] || "User";

  if (!email.includes("@")) {
    throw new HttpError(400, "Enter a valid email address", "validation_error");
  }
  if (password.length < 6) {
    throw new HttpError(
      400,
      "Password must be at least 6 characters",
      "validation_error",
    );
  }

  const admin = createServiceClient(c.env);
  if (
    !c.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    c.env.SUPABASE_SERVICE_ROLE_KEY === c.env.SUPABASE_ANON_KEY ||
    c.env.SUPABASE_SERVICE_ROLE_KEY.includes("REPLACE")
  ) {
    throw new HttpError(
      500,
      "Server misconfigured: set SUPABASE_SERVICE_ROLE_KEY to the service_role secret (not anon) in api/.env",
      "config_error",
    );
  }
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name },
  });

  if (createErr) {
    const msg = createErr.message.toLowerCase();
    if (msg.includes("already") || msg.includes("registered")) {
      throw new HttpError(
        400,
        "That email is already registered. Sign in instead.",
        "validation_error",
      );
    }
    throw new HttpError(400, createErr.message, "auth_error");
  }

  // Ensure xone_profiles row exists even if DB trigger is not installed yet.
  if (created.user) {
    const { error: profileErr } = await admin.from("xone_profiles").upsert({
      id: created.user.id,
      email,
      name,
      avatar_url: `https://api.dicebear.com/9.x/shapes/svg?seed=${encodeURIComponent(email)}`,
    });
    if (profileErr) {
      console.warn("xone_profiles upsert:", profileErr.message);
    }
  }

  const anon = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: signed, error: signErr } = await anon.auth.signInWithPassword({
    email,
    password,
  });

  if (signErr || !signed.session) {
    throw new HttpError(
      500,
      signErr?.message || "Account created but sign-in failed",
      "auth_error",
    );
  }

  return c.json(
    {
      accessToken: signed.session.access_token,
      refreshToken: signed.session.refresh_token,
      user: {
        id: signed.user.id,
        email: signed.user.email ?? email,
        name,
      },
    },
    201,
  );
});
