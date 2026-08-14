/**
 * USDC-style money helpers using integer micro-units (6 decimals).
 */

const SCALE = 1_000_000n;

/**
 * Parses a human amount into micro-units.
 * @param value - Decimal string or number
 * @returns Micro-units
 */
export function parseMoney(value: string | number): bigint {
  if (typeof value === "number") {
    if (!Number.isFinite(value) || value < 0) {
      throw new Error(`Invalid amount: ${value}`);
    }
    return BigInt(Math.round(value * 1e6));
  }
  const raw = value.trim();
  if (!/^\d+(\.\d+)?$/.test(raw)) {
    throw new Error(`Invalid amount: ${value}`);
  }
  const [whole, frac = ""] = raw.split(".");
  if (frac.length > 6) {
    throw new Error(`Amount has more than 6 decimal places: ${value}`);
  }
  return BigInt(whole || "0") * SCALE + BigInt((frac + "000000").slice(0, 6));
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
 * @returns Number rounded to 6 decimals (ledger / JSON)
 */
export function moneyToNumber(micros: bigint): number {
  return Number(micros) / 1e6;
}

/**
 * @param value - JSON / store number
 * @returns Micro-units
 */
export function numberToMoney(value: number): bigint {
  if (!Number.isFinite(value)) throw new Error(`Invalid amount: ${value}`);
  return BigInt(Math.round(value * 1e6));
}

/**
 * @param micros - Micro-units
 */
export function assertPositiveMoney(micros: bigint): void {
  if (micros <= 0n) throw new Error(`Invalid amount: ${formatMoney(micros)}`);
}

/**
 * @param date - Instant
 * @returns UTC `YYYY-MM-DD`
 */
export function utcDayKey(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}
