import {
  decodePaymentResponseHeader,
  wrapFetchWithPaymentFromConfig,
} from "@x402/fetch";
import { ExactEvmScheme } from "@x402/evm";
import { privateKeyToAccount } from "viem/accounts";
import { HttpError } from "./errors";
import { formatMoney, parseMoney } from "./money";
import {
  assertPayeeAllowed,
  assertSafePayUrl,
  createGuardedPayFetch,
  type PayUrlPolicy,
} from "./pay-url-guard";
import type { Chain } from "./wallet";
import { chainToX402Network, isEvmX402Chain } from "./x402-networks";

export type X402PayResult = {
  paid: number;
  paidMicros: bigint;
  currency: string;
  from: string;
  status: number;
  body: unknown;
  settlement?: unknown;
  network?: string;
};

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
  accepts?: AcceptRequirement[];
};

/**
 * Quotes then settles an x402 resource with a server-held EVM key.
 * Ledger amount is always the 402 quote (never a client override).
 *
 * @param params - URL, key, chain, optional max ceiling
 * @returns Settlement result
 */
export async function payX402WithKey(params: {
  url: string;
  privateKey: string;
  chain: Chain;
  /** Abort if quote exceeds this human amount. */
  maxAmount?: string | number;
  /** Host / payTo allowlists (empty = unrestricted aside from SSRF). */
  policy?: PayUrlPolicy;
  beforePay?: (paidMicros: bigint, currency: string) => void | Promise<void>;
  /** Called after limits reserve and immediately before on-chain settlement. */
  onReadyToSettle?: () => void | Promise<void>;
}): Promise<X402PayResult> {
  const policy: PayUrlPolicy = params.policy ?? {
    allowedHosts: [],
    allowedPayees: [],
  };
  const url = (await assertSafePayUrl(params.url, policy)).href;
  if (!isEvmX402Chain(params.chain)) {
    throw new HttpError(
      400,
      `x402 pay currently supports EVM chains only (got ${params.chain})`,
      "validation_error",
    );
  }
  if (!params.privateKey?.startsWith("0x")) {
    throw new HttpError(400, "EVM privateKey must be 0x-prefixed hex", "validation_error");
  }

  const account = privateKeyToAccount(params.privateKey as `0x${string}`);
  const network = chainToX402Network(params.chain);
  const guardedFetch = createGuardedPayFetch(policy);

  const probe = await guardedFetch(url, { method: "GET" }).catch((err: unknown) => {
    throw new HttpError(
      502,
      `Failed to reach ${url}: ${err instanceof Error ? err.message : String(err)}`,
      "x402_payment_failed",
    );
  });

  if (probe.status !== 402) {
    if (probe.ok) {
      const body = await readBody(probe);
      return {
        paid: 0,
        paidMicros: 0n,
        currency: "USDC",
        from: account.address,
        status: probe.status,
        body,
      };
    }
    throw new HttpError(
      502,
      `Expected HTTP 402 Payment Required, got ${probe.status}`,
      "x402_payment_failed",
    );
  }

  const required = await parsePaymentRequired(probe);
  const accept = selectAccept(required, network);
  assertPayeeAllowed(accept.payTo, policy);
  const quoted = atomicToHuman(accept);
  const paidMicros = parseMoney(quoted.amount);

  if (params.maxAmount !== undefined) {
    const maxMicros = parseMoney(params.maxAmount);
    if (paidMicros > maxMicros) {
      throw new HttpError(
        400,
        `Quoted ${formatMoney(paidMicros)} exceeds maxAmount ${formatMoney(maxMicros)}`,
        "limit_exceeded",
      );
    }
  }

  await params.beforePay?.(paidMicros, quoted.currency);
  await params.onReadyToSettle?.();

  const fetchWithPay = wrapFetchWithPaymentFromConfig(guardedFetch, {
    schemes: [
      {
        network: network as `${string}:${string}`,
        client: new ExactEvmScheme(account),
      },
    ],
  });

  const paidRes = await fetchWithPay(url, { method: "GET" }).catch(
    (err: unknown) => {
      throw new HttpError(
        502,
        `x402 payment failed: ${err instanceof Error ? err.message : String(err)}`,
        "x402_payment_failed",
      );
    },
  );

  if (!paidRes.ok) {
    const detail = await paidRes.text().catch(() => "");
    throw new HttpError(
      502,
      `x402 payment rejected (${paidRes.status})${detail ? `: ${detail.slice(0, 200)}` : ""}`,
      "x402_payment_failed",
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
    paid: Number(formatMoney(paidMicros)),
    paidMicros,
    currency: quoted.currency,
    from: account.address,
    status: paidRes.status,
    body: await readBody(paidRes),
    settlement,
    network: accept.network ?? network,
  };
}

/**
 * @param res - 402 response
 * @returns PaymentRequired
 */
async function parsePaymentRequired(res: Response): Promise<PaymentRequiredLike> {
  const header =
    res.headers.get("PAYMENT-REQUIRED") ||
    res.headers.get("payment-required") ||
    res.headers.get("X-PAYMENT-REQUIRED");
  if (header) {
    try {
      const json =
        typeof atob === "function"
          ? atob(header)
          : Buffer.from(header, "base64").toString("utf8");
      return JSON.parse(json) as PaymentRequiredLike;
    } catch {
      // fall through
    }
  }
  const body = (await res.json().catch(() => null)) as PaymentRequiredLike | null;
  if (body?.accepts?.length) return body;
  throw new HttpError(502, "402 response missing PAYMENT-REQUIRED / accepts", "x402_payment_failed");
}

/**
 * @param required - PaymentRequired
 * @param preferredNetwork - Agent network
 * @returns Accept entry
 */
function selectAccept(
  required: PaymentRequiredLike,
  preferredNetwork: string,
): AcceptRequirement {
  const accepts = required.accepts ?? [];
  if (!accepts.length) {
    throw new HttpError(502, "No payment options in 402 accepts", "x402_payment_failed");
  }
  const match = accepts.find((a) => a.network === preferredNetwork);
  if (!match) {
    const offered = accepts.map((a) => a.network ?? "?").join(", ");
    throw new HttpError(
      400,
      `No x402 accept for ${preferredNetwork} (offered: ${offered})`,
      "x402_network_mismatch",
    );
  }
  return match;
}

/**
 * @param accept - Requirement
 * @returns Human amount string + currency
 */
function atomicToHuman(accept: AcceptRequirement): { amount: string; currency: string } {
  const raw = accept.amount ?? accept.maxAmountRequired ?? "0";
  const decimals = accept.extra?.decimals ?? 6;
  let atomic: bigint;
  try {
    atomic = BigInt(raw);
  } catch {
    throw new HttpError(502, `Invalid atomic amount: ${raw}`, "x402_payment_failed");
  }
  const scale = 10n ** BigInt(decimals);
  const whole = atomic / scale;
  const frac = (atomic % scale).toString().padStart(decimals, "0").replace(/0+$/, "");
  return {
    amount: frac ? `${whole}.${frac}` : `${whole}`,
    currency: accept.extra?.name ?? "USDC",
  };
}

/**
 * @param res - Response
 * @returns JSON or text
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
