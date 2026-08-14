import {
  AgentDeletedError,
  AgentNotFoundError,
  AgentPausedError,
  XOneError,
} from "./errors.js";
import {
  appendAgentHistory,
  assertAgentCanSpend,
  getAgentRecord,
  refundAgentSpend,
  spendFromAgent,
} from "./store/mock.js";
import {
  claimMockPayIntent,
  completeMockPayIntent,
  finishMockPayIntent,
  resolvePayIdempotencyKey,
} from "./store/payIntents.js";
import type { PayParams, PayResult } from "./types.js";
import { payX402Url } from "./x402/payUrl.js";

/**
 * Mock-mode x402 pay with reserve-before-settle and idempotency.
 *
 * @param agentId - Agent id
 * @param params - URL / ceiling / idempotency key
 * @returns Pay result
 */
export async function payMockAgent(
  agentId: string,
  params: PayParams,
): Promise<PayResult> {
  const record = getAgentRecord(agentId);
  if (!record) throw new AgentNotFoundError(agentId);
  if (record.status === "paused") throw new AgentPausedError(agentId);
  if (record.status === "deleted") throw new AgentDeletedError(agentId);

  const idempotencyKey = resolvePayIdempotencyKey(params);
  const claim = claimMockPayIntent(agentId, idempotencyKey);
  if (claim.kind === "replay") return claim.result;
  if (claim.kind === "conflict") {
    throw new XOneError(claim.message, claim.code);
  }

  let settleAttempted = false;
  let reserved = 0;
  try {
    const result = await payX402Url({
      url: params.url,
      privateKey: record.wallet.privateKey,
      chain: record.chain,
      maxAmount: params.maxAmount,
      allowedHosts: record.allowedHosts,
      allowedPayees: record.allowedPayees,
      beforePay: (paid) => {
        assertAgentCanSpend(agentId, paid);
        if (paid > 0) {
          spendFromAgent(agentId, paid, {
            type: "x402",
            url: params.url,
            silent: true,
          });
          reserved = paid;
        }
      },
      onReadyToSettle: () => {
        settleAttempted = true;
      },
    });

    const txHash =
      typeof result.settlement === "object" &&
      result.settlement &&
      "transaction" in (result.settlement as Record<string, unknown>)
        ? String((result.settlement as { transaction?: string }).transaction)
        : undefined;

    const latest = getAgentRecord(agentId);
    let remainingDaily = latest?.remainingDaily ?? record.remainingDaily;
    if (result.paid > 0) {
      appendAgentHistory(agentId, {
        type: "x402",
        amount: result.paid,
        currency: result.currency,
        url: params.url,
        txHash,
      });
      remainingDaily = getAgentRecord(agentId)?.remainingDaily ?? remainingDaily;
    }

    const payload: PayResult = {
      ...result,
      remainingDaily,
      idempotencyKey,
    };
    completeMockPayIntent(agentId, idempotencyKey, payload);
    return payload;
  } catch (err) {
    if (!settleAttempted && reserved > 0) {
      refundAgentSpend(agentId, reserved);
    }
    finishMockPayIntent(
      agentId,
      idempotencyKey,
      settleAttempted ? "uncertain" : "failed",
    );
    if (settleAttempted) {
      throw new XOneError(
        `Payment uncertain after settlement attempt. Reuse idempotencyKey=${idempotencyKey} only to detect replay; do not mint a new key until verified.`,
        "payment_uncertain",
      );
    }
    throw err;
  }
}
