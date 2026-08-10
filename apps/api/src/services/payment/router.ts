import type {
  PaymentAuthorization,
  PaymentRequest,
  PaymentResult,
} from "@wallet/types";
import type { PaymentProvider } from "./provider.js";
import { ThirdwebPaymentProvider } from "./thirdweb-provider.js";

/**
 * Selects an available payment provider and routes execution.
 */
export class PaymentRouter {
  private readonly providers: PaymentProvider[];

  /**
   * @param providers - Registered payment providers; defaults to thirdweb-only MVP
   */
  constructor(providers: PaymentProvider[] = [new ThirdwebPaymentProvider()]) {
    this.providers = providers;
  }

  /**
   * Finds the first provider that can settle the request.
   * @param request - Payment intent
   * @returns Matching provider
   * @throws When no provider can pay
   */
  async resolve(request: PaymentRequest): Promise<PaymentProvider> {
    for (const provider of this.providers) {
      if (await provider.canPay(request)) {
        return provider;
      }
    }
    throw new Error("No payment provider available for request");
  }

  /**
   * Executes payment through the resolved provider.
   * @param request - Payment intent
   * @param authorization - Authorization record
   */
  async pay(
    request: PaymentRequest,
    authorization: PaymentAuthorization,
  ): Promise<PaymentResult> {
    const provider = await this.resolve(request);
    return provider.pay(request, authorization);
  }
}

export const paymentRouter = new PaymentRouter();
