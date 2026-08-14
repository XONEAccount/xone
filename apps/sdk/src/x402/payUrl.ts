import {
  decodePaymentResponseHeader,
  wrapFetchWithPaymentFromConfig,
} from "@x402/fetch";
import { ExactEvmScheme } from "@x402/evm";
import { privateKeyToAccount } from "viem/accounts";
import { ValidationError, XOneError } from "../errors.js";
import type { XOneChain } from "../types.js";
import {
  assertPositiveMoney,
  formatMoney,
  moneyToNumber,
  parseMoney,
} from "../utils/money.js";
import { chainToX402Network, isEvmX402Chain } from "./networks.js";

export type PayUrlParams = {
  url: string;
  privateKey: string;
  chain: XOneChain;
  /** Abort if 402 quote exceeds this ceiling (does not override quote). */
  maxAmount?: string | number;
  /** Optional host / payTo allowlists from the agent record. */
  allowedHosts?: string[];
  allowedPayees?: string[];
  /**
   * Called after quoting the 402 price and before signing/settling.
   * Throw to abort (e.g. spend limits). `paid` is always the quote.
   */
  beforePay?: (paid: number, currency: string) => void | Promise<void>;
  /** Called after beforePay and immediately before on-chain settlement. */
  onReadyToSettle?: () => void | Promise<void>;
};

export type PayUrlResult = {
  ok: true;
  mock: false;
  protocol: "x402";
  url: string;
  paid: number;
  currency: string;
  chain: XOneChain;
  from: string;
  status: number;
  body: unknown;
  paymentHeader?: string;
  settlement?: unknown;
  network?: string;
};

/**
 * Thrown when an x402 HTTP payment fails.
 */
export class X402PaymentError extends XOneError {
  readonly status?: number;

  /**
   * @param message - Detail
   * @param status - HTTP status when relevant
   */
  constructor(message: string, status?: number) {
    super(message, "X402_PAYMENT_FAILED");
    this.name = "X402PaymentError";
    this.status = status;
  }
}

type AcceptRequirement = {
  scheme?: string;
  network?: string;
  amount?: string;
  maxAmountRequired?: string;
  asset?: string;
  payTo?: string;
  extra?: { name?: string; decimals?: number };
};

type PaymentRequiredLike = {
  x402Version?: number;
  error?: string;
  accepts?: AcceptRequirement[];
};

/**
 * Fetches a URL and settles a real x402 v2 payment with the agent wallet.
 * Ledger / reported `paid` is always the 402 quote (never a client override).
 *
 * @param params - URL, wallet key, chain, optional max ceiling
 * @returns Paid response payload
 */
export async function payX402Url(params: PayUrlParams): Promise<PayUrlResult> {
  const url = params.url?.trim();
  if (!url) throw new ValidationError("url is required");
  if (!/^https?:\/\//i.test(url)) {
    throw new ValidationError(`Invalid url: ${url}`);
  }
  if (!isEvmX402Chain(params.chain)) {
    throw new ValidationError(
      `x402 pay currently supports EVM chains only (got ${params.chain})`,
    );
  }
  if (!params.privateKey?.startsWith("0x")) {
    throw new ValidationError("EVM privateKey must be 0x-prefixed hex");
  }

  const account = privateKeyToAccount(params.privateKey as `0x${string}`);
  const network = chainToX402Network(params.chain);

  const probe = await fetch(url, { method: "GET" }).catch((err: unknown) => {
    throw new X402PaymentError(
      `Failed to reach ${url}: ${err instanceof Error ? err.message : String(err)}`,
    );
  });

  if (probe.status !== 402) {
    if (probe.ok) {
      const body = await readBody(probe);
      return {
        ok: true,
        mock: false,
        protocol: "x402",
        url,
        paid: 0,
        currency: "USDC",
        chain: params.chain,
        from: account.address,
        status: probe.status,
        body,
      };
    }
    throw new X402PaymentError(
      `Expected HTTP 402 Payment Required, got ${probe.status}`,
      probe.status,
    );
  }

  const required = await parsePaymentRequired(probe);
  const accept = selectAccept(required, network);
  assertPayeeAllowed(accept.payTo, params.allowedPayees);
  assertHostAllowed(url, params.allowedHosts);
  const quoted = atomicToHuman(accept);
  const paidMicros = parseMoney(quoted.amount);

  if (params.maxAmount !== undefined) {
    const maxMicros = parseMoney(params.maxAmount);
    if (paidMicros > maxMicros) {
      throw new ValidationError(
        `Quoted ${formatMoney(paidMicros)} exceeds maxAmount ${formatMoney(maxMicros)}`,
      );
    }
  }

  const paid = moneyToNumber(paidMicros);
  if (paidMicros > 0n) {
    assertPositiveMoney(paidMicros);
    await params.beforePay?.(paid, quoted.currency);
  }
  await params.onReadyToSettle?.();

  const fetchWithPay = wrapFetchWithPaymentFromConfig(fetch, {
    schemes: [
      {
        network: network as `${string}:${string}`,
        client: new ExactEvmScheme(account),
      },
    ],
  });

  const paidRes = await fetchWithPay(url, { method: "GET" }).catch(
    (err: unknown) => {
      throw new X402PaymentError(
        `x402 payment failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    },
  );

  if (!paidRes.ok) {
    const detail = await paidRes.text().catch(() => "");
    throw new X402PaymentError(
      `x402 payment rejected (${paidRes.status})${detail ? `: ${detail.slice(0, 200)}` : ""}`,
      paidRes.status,
    );
  }

  const paymentResponse = paidRes.headers.get("PAYMENT-RESPONSE");
  let settlement: unknown;
  if (paymentResponse) {
    try {
      settlement = decodePaymentResponseHeader(paymentResponse);
    } catch {
      settlement = paymentResponse;
    }
  }

  return {
    ok: true,
    mock: false,
    protocol: "x402",
    url,
    paid,
    currency: quoted.currency,
    chain: params.chain,
    from: account.address,
    status: paidRes.status,
    body: await readBody(paidRes),
    settlement,
    network: accept.network ?? network,
  };
}

/**
 * @param res - 402 response
 * @returns PaymentRequired object
 */
async function parsePaymentRequired(
  res: Response,
): Promise<PaymentRequiredLike> {
  const header =
    res.headers.get("PAYMENT-REQUIRED") ||
    res.headers.get("payment-required") ||
    res.headers.get("X-PAYMENT-REQUIRED");
  if (header) {
    try {
      const json = atob(header);
      return JSON.parse(json) as PaymentRequiredLike;
    } catch {
      // fall through to body
    }
  }
  const body = (await res.json().catch(() => null)) as PaymentRequiredLike | null;
  if (body?.accepts?.length) return body;
  throw new X402PaymentError(
    "402 response missing PAYMENT-REQUIRED / accepts",
    402,
  );
}

/**
 * @param required - PaymentRequired
 * @param preferredNetwork - Agent network
 * @returns Chosen accept entry
 */
function selectAccept(
  required: PaymentRequiredLike,
  preferredNetwork: string,
): AcceptRequirement {
  const accepts = required.accepts ?? [];
  if (!accepts.length) {
    throw new X402PaymentError("No payment options in 402 accepts");
  }
  const match = accepts.find((a) => a.network === preferredNetwork);
  if (!match) {
    const offered = accepts.map((a) => a.network ?? "?").join(", ");
    throw new X402PaymentError(
      `No x402 accept for ${preferredNetwork} (offered: ${offered})`,
    );
  }
  return match;
}

/**
 * @param accept - Selected requirement
 * @returns Human amount string + currency
 */
function atomicToHuman(accept: AcceptRequirement): {
  amount: string;
  currency: string;
} {
  const raw = accept.amount ?? accept.maxAmountRequired ?? "0";
  const decimals = accept.extra?.decimals ?? 6;
  let atomic: bigint;
  try {
    atomic = BigInt(raw);
  } catch {
    throw new X402PaymentError(`Invalid atomic amount: ${raw}`);
  }
  const scale = 10n ** BigInt(decimals);
  const whole = atomic / scale;
  const frac = (atomic % scale)
    .toString()
    .padStart(decimals, "0")
    .replace(/0+$/, "");
  return {
    amount: frac ? `${whole}.${frac}` : `${whole}`,
    currency: accept.extra?.name ?? "USDC",
  };
}

/**
 * @param res - HTTP response
 * @returns Parsed JSON or text
 */
async function readBody(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

/**
 * @param rawUrl - Resource URL
 * @param allowedHosts - Empty = any host
 */
function assertHostAllowed(rawUrl: string, allowedHosts?: string[]): void {
  if (!allowedHosts?.length) return;
  let host: string;
  try {
    host = new URL(rawUrl).hostname.toLowerCase();
  } catch {
    throw new ValidationError(`Invalid url: ${rawUrl}`);
  }
  const ok = allowedHosts.some((rule) => {
    const r = rule.toLowerCase();
    if (r.startsWith("*.")) {
      const suffix = r.slice(2);
      return host === suffix || host.endsWith(`.${suffix}`);
    }
    return host === r;
  });
  if (!ok) {
    throw new ValidationError(`Host is not on this agent's allowlist: ${host}`);
  }
}

/**
 * @param payTo - 402 payTo
 * @param allowedPayees - Empty = any payee
 */
function assertPayeeAllowed(
  payTo: string | undefined,
  allowedPayees?: string[],
): void {
  if (!allowedPayees?.length) return;
  const addr = payTo?.trim().toLowerCase() ?? "";
  if (!addr || !allowedPayees.includes(addr)) {
    throw new ValidationError(
      `Payee is not on this agent's allowlist${payTo ? `: ${payTo}` : ""}`,
    );
  }
}
