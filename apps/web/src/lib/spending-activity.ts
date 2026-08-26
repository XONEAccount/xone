/**
 * Normalized spend / income event for dashboard charts.
 */
export type SpendingEvent = {
  id: string;
  createdAt: string;
  /** Absolute USDC amount */
  amount: number;
  direction: "in" | "out";
  walletId: string;
  walletLabel: string;
  /** Merchant / A2A agent / transfer counterpart label */
  service: string;
};

export type TimeGrain = "day" | "month" | "year";

export type PeriodBucket = {
  key: string;
  label: string;
  income: number;
  spend: number;
};

export type ServiceBucket = {
  service: string;
  spend: number;
};

export type WalletOption = {
  id: string;
  label: string;
};

/**
 * Formats a period key for chart axis labels.
 * @param key - Period key (`yyyy` / `yyyy-MM` / `yyyy-MM-dd`)
 * @param grain - Active time grain
 */
export function formatPeriodLabel(key: string, grain: TimeGrain): string {
  if (grain === "year") return `${key}年`;
  if (grain === "month") {
    const [y, m] = key.split("-");
    return `${y}/${m}`;
  }
  const [, m, d] = key.split("-");
  return `${Number(m)}/${Number(d)}`;
}

/**
 * Builds a period key from an ISO timestamp.
 * @param iso - ISO date string
 * @param grain - Active time grain
 */
export function toPeriodKey(iso: string, grain: TimeGrain): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "invalid";
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  if (grain === "year") return String(y);
  if (grain === "month") return `${y}-${m}`;
  return `${y}-${m}-${d}`;
}

/**
 * Lists contiguous period keys ending at today.
 * @param grain - Active time grain
 * @param count - Number of buckets
 */
export function listPeriodKeys(grain: TimeGrain, count: number): string[] {
  const now = new Date();
  const keys: string[] = [];
  for (let i = count - 1; i >= 0; i -= 1) {
    const date = new Date(now);
    if (grain === "day") date.setDate(now.getDate() - i);
    else if (grain === "month") date.setMonth(now.getMonth() - i, 1);
    else date.setFullYear(now.getFullYear() - i, 0, 1);
    keys.push(toPeriodKey(date.toISOString(), grain));
  }
  return keys;
}

/**
 * Aggregates income / spend by period for the selected wallet filter.
 * @param events - Normalized events
 * @param grain - Day / month / year
 * @param walletId - Wallet id, or `all`
 */
export function aggregateByPeriod(
  events: SpendingEvent[],
  grain: TimeGrain,
  walletId: string,
): PeriodBucket[] {
  const count = grain === "day" ? 14 : grain === "month" ? 12 : 5;
  const keys = listPeriodKeys(grain, count);
  const map = new Map(keys.map((key) => [key, { income: 0, spend: 0 }]));

  for (const event of events) {
    if (walletId !== "all" && event.walletId !== walletId) continue;
    const key = toPeriodKey(event.createdAt, grain);
    const bucket = map.get(key);
    if (!bucket) continue;
    if (event.direction === "in") bucket.income += event.amount;
    else bucket.spend += event.amount;
  }

  return keys.map((key) => {
    const bucket = map.get(key)!;
    return {
      key,
      label: formatPeriodLabel(key, grain),
      income: roundUsd(bucket.income),
      spend: roundUsd(bucket.spend),
    };
  });
}

/**
 * Aggregates outbound spend by service / merchant.
 * @param events - Normalized events
 * @param grain - Day / month / year (limits lookback window)
 * @param walletId - Wallet id, or `all`
 */
export function aggregateByService(
  events: SpendingEvent[],
  grain: TimeGrain,
  walletId: string,
): ServiceBucket[] {
  const count = grain === "day" ? 14 : grain === "month" ? 12 : 5;
  const allowed = new Set(listPeriodKeys(grain, count));
  const map = new Map<string, number>();

  for (const event of events) {
    if (event.direction !== "out") continue;
    if (walletId !== "all" && event.walletId !== walletId) continue;
    const key = toPeriodKey(event.createdAt, grain);
    if (!allowed.has(key)) continue;
    map.set(event.service, (map.get(event.service) ?? 0) + event.amount);
  }

  return [...map.entries()]
    .map(([service, spend]) => ({ service, spend: roundUsd(spend) }))
    .sort((a, b) => b.spend - a.spend)
    .slice(0, 8);
}

/**
 * Unique wallets present in the event stream.
 * @param events - Normalized events
 */
export function listWallets(events: SpendingEvent[]): WalletOption[] {
  const map = new Map<string, string>();
  for (const event of events) {
    if (!map.has(event.walletId)) map.set(event.walletId, event.walletLabel);
  }
  return [...map.entries()].map(([id, label]) => ({ id, label }));
}

/**
 * Rounds USDC amounts for display / chart math.
 * @param value - Raw amount
 */
function roundUsd(value: number): number {
  return Number(value.toFixed(6));
}
