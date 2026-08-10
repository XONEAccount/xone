import type {
  PaymentAuthorization,
  PaymentRequest,
  PaymentResult,
} from "@wallet/types";

/**
 * Provider-agnostic payment execution interface.
 * MVP implements ThirdwebPaymentProvider; other rails can plug in later.
 */
export interface PaymentProvider {
  readonly name: string;

  /**
   * Checks whether this provider can settle the given payment request.
   * @param request - Payment intent
   */
  canPay(request: PaymentRequest): Promise<boolean>;

  /**
   * Executes an authorized payment.
   * @param request - Payment intent
   * @param authorization - Explicit authorization record
   * @throws When authorization is invalid or execution fails
   */
  pay(
    request: PaymentRequest,
    authorization: PaymentAuthorization,
  ): Promise<PaymentResult>;
}
