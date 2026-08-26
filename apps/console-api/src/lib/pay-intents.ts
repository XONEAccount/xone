import type { Context } from "hono";
import type { ApiBindings, ApiVariables } from "../env";
import { HttpError } from "./errors";
import { uuidHex } from "./ids";
import { createServiceClient } from "./supabase";

type AppContext = Context<{ Bindings: ApiBindings; Variables: ApiVariables }>;

export type PayIntentStatus = "pending" | "succeeded" | "failed" | "uncertain";

export type PayIntentRow = {
  id: string;
  agent_id: string;
  idempotency_key: string;
  url: string;
  status: PayIntentStatus;
  max_amount: string | null;
  result: Record<string, unknown> | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
};

export type CachedPayResult = {
  agentId: string;
  paid: number;
  currency: string;
  from: string;
  status: number;
  body: unknown;
  settlement?: unknown;
  network?: string;
  url: string;
  remainingDaily: number;
  chain: string;
  idempotencyKey: string;
  replay: true;
};

/**
 * Normalizes a client idempotency key.
 * @param raw - Header or body value
 * @returns Trimmed key
 */
export function normalizeIdempotencyKey(raw: string | undefined | null): string {
  const key = raw?.trim() ?? "";
  if (!key) {
    throw new HttpError(
      400,
      "idempotencyKey is required for pay (reuse the same key on network retries)",
      "validation_error",
    );
  }
  if (key.length < 8 || key.length > 128) {
    throw new HttpError(
      400,
      "idempotencyKey must be 8–128 characters",
      "validation_error",
    );
  }
  return key;
}

/**
 * Begins or resumes a pay intent.
 * Succeeded → return cached result; pending/uncertain → reject retry; missing → create pending.
 *
 * @param c - Context
 * @param agentId - Agent id
 * @param params - Key + url
 * @returns Existing succeeded cache, or a newly claimed pending intent
 */
export async function beginPayIntent(
  c: AppContext,
  agentId: string,
  params: { idempotencyKey: string; url: string; maxAmount?: string | number },
): Promise<
  | { kind: "replay"; result: CachedPayResult }
  | { kind: "claim"; intent: PayIntentRow }
> {
  const supabase = createServiceClient(c.env);
  const { data: existing, error: readError } = await supabase
    .from("xone_pay_intents")
    .select("*")
    .eq("agent_id", agentId)
    .eq("idempotency_key", params.idempotencyKey)
    .maybeSingle();

  if (readError) throw new HttpError(500, readError.message, "db_error");

  if (existing) {
    const row = existing as PayIntentRow;
    if (row.status === "succeeded" && row.result) {
      return {
        kind: "replay",
        result: row.result as CachedPayResult,
      };
    }
    if (row.status === "pending") {
      throw new HttpError(
        409,
        "Payment already in progress for this idempotencyKey — do not start a second pay",
        "payment_in_progress",
      );
    }
    if (row.status === "uncertain") {
      throw new HttpError(
        409,
        "Previous payment attempt is uncertain (possible on-chain success). Do not retry with a new key until you verify settlement.",
        "payment_uncertain",
      );
    }
    // failed → refuse reuse; client must mint a new key after a clean failure
    throw new HttpError(
      409,
      "This idempotencyKey already failed. Use a new key only after confirming no on-chain payment.",
      "idempotency_conflict",
    );
  }

  const now = new Date().toISOString();
  const row = {
    id: `pay_${uuidHex(16)}`,
    agent_id: agentId,
    idempotency_key: params.idempotencyKey,
    url: params.url,
    status: "pending" as const,
    max_amount:
      params.maxAmount === undefined || params.maxAmount === null
        ? null
        : String(params.maxAmount),
    result: null,
    error_message: null,
    created_at: now,
    updated_at: now,
  };

  const { data, error } = await supabase
    .from("xone_pay_intents")
    .insert(row)
    .select("*")
    .single();

  if (error) {
    // Race: another request inserted the same key.
    if (error.code === "23505") {
      return beginPayIntent(c, agentId, params);
    }
    throw new HttpError(500, error.message, "db_error");
  }

  return { kind: "claim", intent: data as PayIntentRow };
}

/**
 * Marks intent succeeded and stores the response for safe retries.
 * @param c - Context
 * @param intentId - Intent id
 * @param result - Cached pay payload
 */
export async function completePayIntent(
  c: AppContext,
  intentId: string,
  result: CachedPayResult,
): Promise<void> {
  const supabase = createServiceClient(c.env);
  const { error } = await supabase
    .from("xone_pay_intents")
    .update({
      status: "succeeded",
      result,
      updated_at: new Date().toISOString(),
    })
    .eq("id", intentId)
    .eq("status", "pending");
  if (error) throw new HttpError(500, error.message, "db_error");
}

/**
 * Marks intent failed (safe to tell client; they must use a new key later).
 * @param c - Context
 * @param intentId - Intent id
 * @param message - Error message
 */
export async function failPayIntent(
  c: AppContext,
  intentId: string,
  message: string,
): Promise<void> {
  const supabase = createServiceClient(c.env);
  const { error } = await supabase
    .from("xone_pay_intents")
    .update({
      status: "failed",
      error_message: message.slice(0, 500),
      updated_at: new Date().toISOString(),
    })
    .eq("id", intentId)
    .eq("status", "pending");
  if (error) throw new HttpError(500, error.message, "db_error");
}

/**
 * Marks intent uncertain after a possible on-chain settlement (blocks retries).
 * @param c - Context
 * @param intentId - Intent id
 * @param message - Detail
 */
export async function uncertainPayIntent(
  c: AppContext,
  intentId: string,
  message: string,
): Promise<void> {
  const supabase = createServiceClient(c.env);
  const { error } = await supabase
    .from("xone_pay_intents")
    .update({
      status: "uncertain",
      error_message: message.slice(0, 500),
      updated_at: new Date().toISOString(),
    })
    .eq("id", intentId)
    .eq("status", "pending");
  if (error) throw new HttpError(500, error.message, "db_error");
}
