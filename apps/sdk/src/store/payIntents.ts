import type { PayParams, PayResult } from "../types.js";
import { uuid } from "../utils/id.js";

/** In-memory pay outcomes for mock idempotency. */
const mockPayIntents = new Map<
  string,
  { status: "pending" | "succeeded" | "failed" | "uncertain"; result?: PayResult }
>();

/**
 * Resolves the idempotency key for a pay call.
 * @param params - Pay params
 * @returns Key to use for this attempt
 */
export function resolvePayIdempotencyKey(params: PayParams): string {
  const key = params.idempotencyKey?.trim();
  if (key) return key;
  return uuid();
}

/**
 * Looks up a mock pay intent.
 * @param agentId - Agent id
 * @param key - Idempotency key
 * @returns Stored intent or undefined
 */
export function getMockPayIntent(agentId: string, key: string) {
  return mockPayIntents.get(`${agentId}:${key}`);
}

/**
 * Claims a mock pay intent (pending) or returns a replay/conflict signal.
 * @param agentId - Agent id
 * @param key - Idempotency key
 * @returns Claim outcome
 */
export function claimMockPayIntent(
  agentId: string,
  key: string,
):
  | { kind: "claim" }
  | { kind: "replay"; result: PayResult }
  | { kind: "conflict"; message: string; code: string } {
  const id = `${agentId}:${key}`;
  const existing = mockPayIntents.get(id);
  if (!existing) {
    mockPayIntents.set(id, { status: "pending" });
    return { kind: "claim" };
  }
  if (existing.status === "succeeded" && existing.result) {
    return { kind: "replay", result: { ...existing.result, replay: true } };
  }
  if (existing.status === "pending") {
    return {
      kind: "conflict",
      message:
        "Payment already in progress for this idempotencyKey — do not start a second pay",
      code: "payment_in_progress",
    };
  }
  if (existing.status === "uncertain") {
    return {
      kind: "conflict",
      message:
        "Previous payment attempt is uncertain. Do not retry with a new key until you verify settlement.",
      code: "payment_uncertain",
    };
  }
  return {
    kind: "conflict",
    message:
      "This idempotencyKey already failed. Use a new key only after confirming no on-chain payment.",
    code: "idempotency_conflict",
  };
}

/**
 * @param agentId - Agent id
 * @param key - Idempotency key
 * @param result - Successful pay result
 */
export function completeMockPayIntent(
  agentId: string,
  key: string,
  result: PayResult,
): void {
  mockPayIntents.set(`${agentId}:${key}`, {
    status: "succeeded",
    result: { ...result, replay: true },
  });
}

/**
 * @param agentId - Agent id
 * @param key - Idempotency key
 * @param status - Terminal non-success status
 */
export function finishMockPayIntent(
  agentId: string,
  key: string,
  status: "failed" | "uncertain",
): void {
  mockPayIntents.set(`${agentId}:${key}`, { status });
}

/**
 * Test helper — clears mock pay intents.
 */
export function clearMockPayIntents(): void {
  mockPayIntents.clear();
}
