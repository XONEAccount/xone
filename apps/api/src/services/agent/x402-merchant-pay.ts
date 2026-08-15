import type { SupabaseClient } from "@supabase/supabase-js";
import { wrapFetchWithPayment, x402Client, x402HTTPClient } from "@x402/fetch";
import { ExactEvmScheme } from "@x402/evm/exact/client";
import type { PaymentRequirements } from "@x402/core/types";
import { privateKeyToAccount } from "viem/accounts";
import { decryptSecret } from "../../lib/crypto.js";
import { getEnv } from "../../lib/env.js";
import {
  toDeveloperAgent,
  type DeveloperAgentRow,
} from "./developer-agent.js";
import type { AgentPayment, DeveloperAgent, PaymentStatus } from "@wallet/types";

const USDC_DECIMALS = 6;

/** Allowed merchant origins to avoid open SSRF from agent keys. */
const ALLOWED_MERCHANT_ORIGINS = new Set([
  "https://xone-x402-seller.tskwangyi.workers.dev",
  "http://localhost:4021",
  "http://127.0.0.1:4021",
]);

export type MerchantPayResult =
  | {
      ok: true;
      payment: AgentPayment;
      agent: DeveloperAgent;
      receipt: {
        paymentId: string;
        amount: string;
        asset: "USDC";
        chain: string;
        recipient: string;
        provider: "x402-merchant";
        status: PaymentStatus;
        merchantUrl: string;
        merchantBody: unknown;
        settlementTx?: string;
      };
    }
  | { ok: false; status: 400 | 402 | 403 | 502; error: string };

/**
 * Converts USDC atomic units (6 decimals) to a human decimal amount.
 * @param atomic - Atomic amount string
 */
function atomicUsdcToDecimal(atomic: string): number {
  const raw = Number(atomic);
  if (!Number.isFinite(raw) || raw < 0) return NaN;
  return raw / 10 ** USDC_DECIMALS;
}

export type X402Quote = {
  amount: number;
  asset: "USDC";
  payTo: string | null;
  network: string | null;
  merchantUrl: string;
};

/**
 * Probes a merchant URL for the x402 402 quote without settling.
 * @param merchantUrl - Absolute merchant resource URL
 * @returns Quote amount in human USDC, or null when free / unreachable
 */
export async function quoteX402Merchant(
  merchantUrl: string,
): Promise<X402Quote | null> {
  let url: URL;
  try {
    url = assertAllowedMerchantUrl(merchantUrl);
  } catch {
    return null;
  }

  let response: Response;
  try {
    response = await fetch(url.toString(), {
      method: "GET",
      signal: AbortSignal.timeout(12_000),
    });
  } catch {
    return null;
  }

  // Free resource — no payment needed.
  if (response.ok) {
    return {
      amount: 0,
      asset: "USDC",
      payTo: null,
      network: null,
      merchantUrl: url.toString(),
    };
  }

  if (response.status !== 402) return null;

  type Accept = {
    amount?: string;
    maxAmountRequired?: string;
    payTo?: string;
    network?: string;
    extra?: { decimals?: number };
  };
  type Required = { accepts?: Accept[] };

  let required: Required | null = null;
  const header =
    response.headers.get("PAYMENT-REQUIRED") ||
    response.headers.get("payment-required") ||
    response.headers.get("X-PAYMENT-REQUIRED");
  if (header) {
    try {
      required = JSON.parse(atob(header)) as Required;
    } catch {
      required = null;
    }
  }
  if (!required?.accepts?.length) {
    required = (await response.json().catch(() => null)) as Required | null;
  }
  const accept = required?.accepts?.[0];
  if (!accept) return null;

  const raw = accept.amount ?? accept.maxAmountRequired ?? "0";
  const decimals = accept.extra?.decimals ?? USDC_DECIMALS;
  const atomic = Number(raw);
  if (!Number.isFinite(atomic) || atomic < 0) return null;
  const amount = atomic / 10 ** decimals;
  if (!Number.isFinite(amount)) return null;

  return {
    amount,
    asset: "USDC",
    payTo: accept.payTo?.toLowerCase() ?? null,
    network: accept.network ?? null,
    merchantUrl: url.toString(),
  };
}

/**
 * Whether a quoted amount requires explicit user confirmation for this agent.
 * Within perTransaction + remaining dailyLimit → auto-pay; otherwise confirm.
 * @param amount - Quoted human USDC
 * @param agent - Agent policy snapshot
 */
export function paymentRequiresConfirmation(
  amount: number,
  agent: Pick<
    DeveloperAgent,
    "maxSinglePayment" | "maxAmount" | "spentAmount" | "perTransaction" | "dailyLimit"
  >,
): boolean {
  if (!Number.isFinite(amount) || amount < 0) return true;
  if (amount === 0) return false;
  const perTx = agent.perTransaction ?? agent.maxSinglePayment;
  const daily = agent.dailyLimit ?? agent.maxAmount;
  const remaining = Math.max(0, daily - agent.spentAmount);
  return amount > perTx || amount > remaining;
}

/**
 * Flattens undici/fetch errors into an actionable merchant connectivity message.
 * @param err - Thrown value from fetch / x402 wrap
 * @param merchantUrl - Requested merchant URL
 */
function formatMerchantFetchError(err: unknown, merchantUrl: string): string {
  const parts: string[] = [];
  let current: unknown = err;
  for (let i = 0; i < 4 && current; i += 1) {
    if (current instanceof Error) {
      if (current.message) parts.push(current.message);
      current = (current as Error & { cause?: unknown }).cause;
      continue;
    }
    parts.push(String(current));
    break;
  }
  const detail = parts.filter(Boolean).join(" ← ") || "unknown error";

  // Policy / settle failures bubble through wrapFetchWithPayment — do not label as "unreachable".
  if (/blocked by agent policy|allowance|insufficient|Payment blocked/i.test(detail)) {
    return `支付被策略拦截（${detail}）。请先给 Agent 钱包充值 USDC，并确认 allowance / 单笔与总额上限足够。`;
  }

  const isLocal =
    merchantUrl.includes("localhost") || merchantUrl.includes("127.0.0.1");
  const hint = isLocal
    ? "确认本地 seller 已启动：pnpm --filter @wallet/x402-seller dev"
    : "浏览器能打开 402 页只说明商家在线；若本机 API 仍超时，可改用 http://localhost:4021/weather 或检查本机到 workers.dev 的出站网络";
  return `无法完成对商家的请求 ${merchantUrl}（${detail}）。${hint}`;
}

/**
 * Validates merchant URL against an allowlist.
 * @param merchantUrl - Absolute URL
 */
function assertAllowedMerchantUrl(merchantUrl: string): URL {
  let url: URL;
  try {
    url = new URL(merchantUrl);
  } catch {
    throw new Error("Invalid merchantUrl");
  }
  const origin = url.origin;
  if (!ALLOWED_MERCHANT_ORIGINS.has(origin)) {
    throw new Error(`Merchant origin not allowed: ${origin}`);
  }
  if (url.protocol !== "https:" && url.hostname !== "localhost" && url.hostname !== "127.0.0.1") {
    throw new Error("Merchant URL must use https");
  }
  return url;
}

/**
 * Pays an external x402 resource using the agent's sealed EOA, then debits policy allowance.
 * @param admin - Supabase admin
 * @param agentRow - Authenticated agent row (includes encrypted key)
 * @param input - Merchant URL + optional idempotency key
 */
export async function payX402Merchant(
  admin: SupabaseClient,
  agentRow: DeveloperAgentRow,
  input: { merchantUrl: string; idempotencyKey?: string },
): Promise<MerchantPayResult> {
  const agent = toDeveloperAgent(agentRow);
  if (agent.asset !== "USDC" || agent.chain !== "base-sepolia") {
    return {
      ok: false,
      status: 400,
      error: "External x402 merchant pay requires Base Sepolia + USDC agent",
    };
  }

  let merchantUrl: URL;
  try {
    merchantUrl = assertAllowedMerchantUrl(input.merchantUrl);
  } catch (err) {
    return {
      ok: false,
      status: 400,
      error: err instanceof Error ? err.message : "Invalid merchantUrl",
    };
  }

  if (input.idempotencyKey) {
    const { data: existing } = await admin
      .from("agent_payments")
      .select("*")
      .eq("agent_id", agent.id)
      .eq("idempotency_key", input.idempotencyKey)
      .maybeSingle();
    if (existing) {
      const payment = existing as {
        id: string;
        amount: string | number;
        asset: string;
        chain: string;
        recipient: string;
        status: PaymentStatus;
        merchant: string | null;
        resource: string | null;
        provider: string;
        failure_reason: string | null;
        created_at: string;
      };
      return {
        ok: true,
        payment: {
          id: payment.id,
          agentId: agent.id,
          amount: Number(payment.amount),
          asset: payment.asset,
          chain: payment.chain,
          recipient: payment.recipient,
          merchant: payment.merchant,
          resource: payment.resource,
          status: payment.status,
          provider: payment.provider,
          failureReason: payment.failure_reason,
          createdAt: payment.created_at,
        },
        agent,
        receipt: {
          paymentId: payment.id,
          amount: String(payment.amount),
          asset: "USDC",
          chain: payment.chain,
          recipient: payment.recipient,
          provider: "x402-merchant",
          status: payment.status,
          merchantUrl: merchantUrl.toString(),
          merchantBody: null,
        },
      };
    }
  }

  const env = getEnv();
  const sealSecret = env.jwtSecret || env.supabaseServiceRoleKey;
  if (!sealSecret) {
    return { ok: false, status: 400, error: "Server cannot unseal agent key" };
  }

  let privateKey: `0x${string}`;
  try {
    privateKey = (await decryptSecret(
      agentRow.encrypted_private_key,
      sealSecret,
    )) as `0x${string}`;
  } catch {
    return { ok: false, status: 400, error: "Failed to unseal agent key" };
  }

  const signer = privateKeyToAccount(privateKey);
  if (signer.address.toLowerCase() !== agent.walletAddress.toLowerCase()) {
    return { ok: false, status: 400, error: "Agent key / address mismatch" };
  }

  if (agent.allowanceEth <= 0) {
    return {
      ok: false,
      status: 402,
      error:
        "Agent allowance 为 0：请先给该 Agent 充值 USDC（创建/充值流程），再发起 x402 支付。浏览器能打开商家 402 页不代表钱包已有额度。",
    };
  }

  const selectedRef: { current: PaymentRequirements | null } = { current: null };
  const client = new x402Client()
    .register("eip155:*", new ExactEvmScheme(signer))
    .registerPolicy((_version, requirements) => {
      const allowed = requirements.filter((req) => {
        const human = atomicUsdcToDecimal(req.amount);
        if (!Number.isFinite(human) || human <= 0) return false;
        // dailyLimit / allowance are hard caps; perTransaction only gates chat confirmation.
        if (agent.spentAmount + human > agent.maxAmount) return false;
        if (human > agent.allowanceEth) return false;
        // Accept Base Sepolia CAIP-2 only.
        return String(req.network).includes("84532");
      });
      if (allowed.length === 0) {
        throw new Error(
          "Payment blocked by agent policy (dailyLimit/allowance or network)",
        );
      }
      selectedRef.current = allowed[0] ?? null;
      return allowed;
    });

  const fetchWithPayment = wrapFetchWithPayment(fetch, client);

  let response: Response;
  try {
    response = await fetchWithPayment(merchantUrl.toString(), {
      method: "GET",
      signal: AbortSignal.timeout(25_000),
    });
  } catch (err) {
    return {
      ok: false,
      status: 502,
      error: formatMerchantFetchError(err, merchantUrl.toString()),
    };
  }

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    return {
      ok: false,
      status: 502,
      error: `Merchant returned ${response.status}: ${text.slice(0, 200)}`,
    };
  }

  const contentType = response.headers.get("content-type") ?? "";
  const merchantBody = contentType.includes("application/json")
    ? await response.json().catch(() => null)
    : await response.text().catch(() => null);

  let settlementTx: string | undefined;
  try {
    const settle = new x402HTTPClient(client).getPaymentSettleResponse((name) =>
      response.headers.get(name),
    );
    const tx =
      settle && typeof settle === "object" && "transaction" in settle
        ? String((settle as { transaction?: string }).transaction ?? "")
        : "";
    if (tx) settlementTx = tx;
  } catch {
    // Settlement header optional for bookkeeping.
  }

  const selected = selectedRef.current;
  const paidAtomic = selected?.amount ?? "1000";
  const amount = atomicUsdcToDecimal(paidAtomic);
  if (!Number.isFinite(amount) || amount <= 0) {
    return { ok: false, status: 400, error: "Could not determine payment amount" };
  }
  const recipient = (selected?.payTo ?? "").toLowerCase();
  if (!/^0x[a-f0-9]{40}$/.test(recipient)) {
    return { ok: false, status: 400, error: "Merchant payTo missing" };
  }

  const { data: paymentRow, error: payError } = await admin
    .from("agent_payments")
    .insert({
      agent_id: agent.id,
      idempotency_key: input.idempotencyKey ?? null,
      amount,
      asset: "USDC",
      chain: "base-sepolia",
      recipient,
      merchant: merchantUrl.host,
      resource: merchantUrl.toString(),
      status: "confirmed",
      provider: "x402-merchant",
      metadata: {
        rail: "external-x402",
        settlementTx: settlementTx ?? null,
        merchantBody,
      },
    })
    .select("*")
    .single();

  if (payError || !paymentRow) {
    return {
      ok: false,
      status: 400,
      error: payError?.message ?? "Payment insert failed",
    };
  }

  const { data: updated, error: updateError } = await admin
    .from("developer_agents")
    .update({
      allowance_eth: agent.allowanceEth - amount,
      spent_amount: agent.spentAmount + amount,
      updated_at: new Date().toISOString(),
    })
    .eq("id", agent.id)
    .select("*")
    .single();

  if (updateError || !updated) {
    return {
      ok: false,
      status: 400,
      error: updateError?.message ?? "Failed to update allowance",
    };
  }

  const payment = {
    id: paymentRow.id as string,
    agentId: agent.id,
    amount,
    asset: "USDC",
    chain: "base-sepolia",
    recipient,
    merchant: merchantUrl.host,
    resource: merchantUrl.toString(),
    status: "confirmed" as PaymentStatus,
    provider: "x402-merchant",
    failureReason: null,
    createdAt: paymentRow.created_at as string,
  };

  return {
    ok: true,
    payment,
    agent: toDeveloperAgent(updated as DeveloperAgentRow),
    receipt: {
      paymentId: payment.id,
      amount: String(amount),
      asset: "USDC",
      chain: "base-sepolia",
      recipient,
      provider: "x402-merchant",
      status: "confirmed",
      merchantUrl: merchantUrl.toString(),
      merchantBody,
      settlementTx,
    },
  };
}
