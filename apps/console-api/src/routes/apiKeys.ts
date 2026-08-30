import { Hono } from "hono";
import type { ApiBindings, ApiVariables } from "../env";
import { ensureProfile, softDeleteAgent } from "../lib/agents";
import { HttpError } from "../lib/errors";
import { randomAlnum, sha256Hex, uuidHex } from "../lib/ids";
import { serializeApiKey } from "../lib/serialize";
import { createServiceClient, type DbAgent, type DbApiKey } from "../lib/supabase";
import { requireUser } from "../middleware/auth";

type Env = { Bindings: ApiBindings; Variables: ApiVariables };

export const apiKeysRoutes = new Hono<Env>();

apiKeysRoutes.use("*", requireUser);

/**
 * Lists API keys for the signed-in user (newest first).
 */
apiKeysRoutes.get("/", async (c) => {
  await ensureProfile(c);
  const supabase = createServiceClient(c.env);
  const { data, error } = await supabase
    .from("xone_api_keys")
    .select("*")
    .eq("user_id", c.get("userId"))
    .neq("status", "deleted")
    .order("created_at", { ascending: false });

  if (error) throw new HttpError(500, error.message, "db_error");
  return c.json({
    items: ((data ?? []) as DbApiKey[]).map((row) => serializeApiKey(row)),
  });
});

/**
 * Creates an API key. Full token returned once.
 */
apiKeysRoutes.post("/", async (c) => {
  await ensureProfile(c);
  const body = (await c.req.json().catch(() => ({}))) as { name?: string };
  const name = body.name?.trim();
  if (!name) throw new HttpError(400, "name is required", "validation_error");

  const supabase = createServiceClient(c.env);
  const userId = c.get("userId");

  const { data: clash } = await supabase
    .from("xone_api_keys")
    .select("id")
    .eq("user_id", userId)
    .eq("status", "active")
    .ilike("name", name)
    .maybeSingle();

  if (clash) {
    throw new HttpError(
      400,
      `API key name already exists: ${name}`,
      "validation_error",
    );
  }

  const id = `key_${uuidHex(12)}`;
  // Format: xone_ + 16 alphanumeric chars. Shown in full only once on create.
  const token = `xone_${randomAlnum(16)}`;
  const tokenHash = await sha256Hex(token);
  const tokenPrefix = "xone_";

  const row = {
    id,
    user_id: userId,
    name,
    token_hash: tokenHash,
    token_prefix: tokenPrefix,
    status: "active" as const,
    created_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("xone_api_keys")
    .insert(row)
    .select("*")
    .single();

  if (error) throw new HttpError(500, error.message, "db_error");
  return c.json(serializeApiKey(data as DbApiKey, token), 201);
});

/**
 * Soft-deletes an API key.
 */
apiKeysRoutes.delete("/:id", async (c) => {
  await ensureProfile(c);
  const id = c.req.param("id");
  const supabase = createServiceClient(c.env);
  const { data, error } = await supabase
    .from("xone_api_keys")
    .select("*")
    .eq("id", id)
    .eq("user_id", c.get("userId"))
    .maybeSingle();

  if (error) throw new HttpError(500, error.message, "db_error");
  if (!data) throw new HttpError(404, `API key not found: ${id}`, "not_found");

  const key = data as DbApiKey;
  if (key.status === "deleted") {
    return c.json(serializeApiKey(key));
  }

  const { data: updated, error: updErr } = await supabase
    .from("xone_api_keys")
    .update({ status: "deleted" })
    .eq("id", id)
    .select("*")
    .single();

  if (updErr) throw new HttpError(500, updErr.message, "db_error");

  // Soft-delete the bound agent wallet so console status stays in sync.
  const { data: boundAgents } = await supabase
    .from("xone_agents")
    .select("*")
    .eq("api_key_id", id)
    .eq("user_id", c.get("userId"))
    .neq("status", "deleted");

  for (const row of (boundAgents ?? []) as DbAgent[]) {
    await softDeleteAgent(c, row);
  }

  return c.json(serializeApiKey(updated as DbApiKey));
});
