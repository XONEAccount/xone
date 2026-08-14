/**
 * USDC-style money helpers using integer micro-units (6 decimals).
 * Avoids float drift for ledger math.
 */

import { HttpError } from "./errors";

const SCALE = 1_000_000n;

/**
 * Parses a human amount into micro-units.
 * @param value - Decimal string or number (e.g. `"1.5"` / `1.5`)
 * @returns Micro-units as bigint
 * @throws {HttpError} When the value is invalid
 */
export function parseMoney(value: string | number): bigint {
  if (typeof value === "number") {
    if (!Number.isFinite(value) || value < 0) {
      throw new HttpError(400, `Invalid amount: ${value}`, "validation_error");
    }
    return BigInt(Math.round(value * 1e6));
  }

  const raw = value.trim();
  if (!/^\d+(\.\d+)?$/.test(raw)) {
    throw new HttpError(400, `Invalid amount: ${value}`, "validation_error");
  }
  const [whole, frac = ""] = raw.split(".");
  if (frac.length > 6) {
    throw new HttpError(
      400,
      `Amount has more than 6 decimal places: ${value}`,
      "validation_error",
    );
  }
  const micros = BigInt(whole || "0") * SCALE + BigInt((frac + "000000").slice(0, 6));
  return micros;
}

/**
 * @param micros - Micro-units
 * @returns Human decimal string
 */
export function formatMoney(micros: bigint): string {
  const neg = micros < 0n;
  const abs = neg ? -micros : micros;
  const whole = abs / SCALE;
  const frac = (abs % SCALE).toString().padStart(6, "0").replace(/0+$/, "");
  const body = frac ? `${whole}.${frac}` : `${whole}`;
  return neg ? `-${body}` : body;
}

/**
 * @param micros - Micro-units
 * @returns JS number for DB columns (rounded to 6 decimals)
 */
export function moneyToNumber(micros: bigint): number {
  return Number(micros) / 1e6;
}

/**
 * @param value - DB / JSON number
 * @returns Micro-units
 */
export function numberToMoney(value: number): bigint {
  if (!Number.isFinite(value)) {
    throw new HttpError(400, `Invalid amount: ${value}`, "validation_error");
  }
  return BigInt(Math.round(value * 1e6));
}

/**
 * @param micros - Micro-units
 * @throws {HttpError} When not strictly positive
 */
export function assertPositiveMoney(micros: bigint): void {
  if (micros <= 0n) {
    throw new HttpError(
      400,
      `Invalid amount: ${formatMoney(micros)}`,
      "validation_error",
    );
  }
}

/**
 * UTC calendar day key `YYYY-MM-DD`.
 * @param date - Instant
 * @returns Period key
 */
export function utcDayKey(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}
