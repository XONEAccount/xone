/**
 * HTTP-friendly domain error.
 */
export class HttpError extends Error {
  readonly status: number;
  readonly code: string;

  /**
   * @param status - HTTP status
   * @param message - Human message
   * @param code - Machine code
   */
  constructor(status: number, message: string, code = "error") {
    super(message);
    this.status = status;
    this.code = code;
  }
}

/**
 * @param amount - Parsed number
 * @returns Valid positive finite amount
 */
export function requirePositiveAmount(amount: number): number {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new HttpError(400, `Invalid amount: ${amount}`, "validation_error");
  }
  return amount;
}

/**
 * @param dailyLimit - Daily cap
 * @param perTransaction - Per-tx cap
 */
export function validateLimits(
  dailyLimit: number,
  perTransaction: number,
): void {
  if (!Number.isFinite(dailyLimit) || dailyLimit <= 0) {
    throw new HttpError(400, "dailyLimit must be > 0", "validation_error");
  }
  if (!Number.isFinite(perTransaction) || perTransaction <= 0) {
    throw new HttpError(400, "perTransaction must be > 0", "validation_error");
  }
  if (perTransaction > dailyLimit) {
    throw new HttpError(
      400,
      "perTransaction cannot exceed dailyLimit",
      "validation_error",
    );
  }
}
