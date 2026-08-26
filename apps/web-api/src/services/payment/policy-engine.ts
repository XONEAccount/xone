import type { PaymentPolicy, PaymentRequest, PolicyDecision } from "@xone/types";
import { DEFAULT_PAYMENT_POLICY } from "@xone/config";

/**
 * Parses a decimal amount string into a number for policy comparisons.
 * @param value - Decimal string such as "50.25"
 * @returns Numeric amount, or NaN when invalid
 */
function toAmount(value: string): number {
  return Number(value);
}

/**
 * Evaluates whether a payment request may auto-execute, needs confirmation, or must be blocked.
 * This function is intentionally deterministic and must never call an LLM.
 * @param request - Payment intent to evaluate
 * @param policy - User payment policy limits
 * @returns Policy decision
 */
export function evaluatePaymentPolicy(
  request: Pick<PaymentRequest, "amount" | "asset" | "chain" | "merchant">,
  policy: PaymentPolicy = DEFAULT_PAYMENT_POLICY,
): PolicyDecision {
  const amount = toAmount(request.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    return "block";
  }

  if (!policy.allowedAssets.includes(request.asset)) {
    return "block";
  }

  if (!policy.allowedChains.includes(request.chain)) {
    return "block";
  }

  if (amount > toAmount(policy.blockAbove)) {
    return "block";
  }

  const merchantAllowed =
    !request.merchant ||
    policy.allowedMerchants.length === 0 ||
    policy.allowedMerchants.includes(request.merchant);

  if (
    amount <= toAmount(policy.maxAutoAmount) &&
    merchantAllowed
  ) {
    return "allow";
  }

  if (amount <= toAmount(policy.requireConfirmationAbove) || amount <= toAmount(policy.blockAbove)) {
    return "confirm";
  }

  return "block";
}
