import type {
  Payment,
  PaymentAuthorization,
  PaymentRequest,
  PaymentResult,
} from "@wallet/types";
import type { PaymentProvider } from "./provider.js";

/**
 * Placeholder thirdweb payment provider for Phase 1–2 scaffolding.
 * Real chain submission will be wired via thirdweb Server SDK.
 */
export class ThirdwebPaymentProvider implements PaymentProvider {
  readonly name = "thirdweb";

  /**
   * @param request - Payment intent
   * @returns True for EVM-compatible requests in MVP
   */
  async canPay(request: PaymentRequest): Promise<boolean> {
    return Boolean(request.recipient && request.amount && request.asset);
  }

  /**
   * Prepares a payment record. Blockchain submission is intentionally not faked as success.
   * @param request - Payment intent
   * @param authorization - Authorization granted by policy/user
   * @returns Payment result in submitting state pending real thirdweb integration
   * @throws When authorization decision is block
   */
  async pay(
    request: PaymentRequest,
    authorization: PaymentAuthorization,
  ): Promise<PaymentResult> {
    if (authorization.decision === "block") {
      throw new Error("Payment blocked by authorization");
    }

    const now = new Date().toISOString();
    const payment: Payment = {
      id: crypto.randomUUID(),
      paymentRequestId: request.id,
      provider: this.name,
      txHash: null,
      amount: request.amount,
      asset: request.asset,
      chain: request.chain,
      status: "submitting",
      submittedAt: now,
      confirmedAt: null,
      failureReason: null,
      metadata: {
        note: "Awaiting thirdweb Server SDK wiring",
      },
    };

    return { payment, txHash: null };
  }
}
