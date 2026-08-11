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
  const isLocal =
    merchantUrl.includes("localhost") || merchantUrl.includes("127.0.0.1");
  const hint = isLocal
    ? "确认本地 seller 已启动：pnpm --filter @wallet/x402-seller dev"
    : "当前网络可能无法访问 workers.dev，可改用 http://localhost:4021/weather";
  return `无法连接商家 ${merchantUrl}（${detail}）。${hint}`;
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

  const selectedRef: { current: PaymentRequirements | null } = { current: null };
  const client = new x402Client()
    .register("eip155:*", new ExactEvmScheme(signer))
    .registerPolicy((_version, requirements) => {
      const allowed = requirements.filter((req) => {
        const human = atomicUsdcToDecimal(req.amount);
        if (!Number.isFinite(human) || human <= 0) return false;
        if (human > agent.maxSinglePayment) return false;
        if (agent.spentAmount + human > agent.maxAmount) return false;
        if (human > agent.allowanceEth) return false;
        // Accept Base Sepolia CAIP-2 only.
        return String(req.network).includes("84532");
      });
      if (allowed.length === 0) {
        throw new Error(
          "Payment blocked by agent policy (single/total/allowance or network)",
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
