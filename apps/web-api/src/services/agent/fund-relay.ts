import {
  USDC_CONTRACT_ADDRESS,
  USDC_TRANSFER_AUTHORIZATION_TYPES,
  usdcAuthorizationAbi,
  usdcTransferAuthorizationDomain,
} from "@xone/config";
import type { FundDeveloperAgentRelayInput } from "@xone/schemas";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { DeveloperAgent } from "@xone/types";
import {
  createWalletClient,
  erc20Abi,
  formatUnits,
  http,
  parseSignature,
  parseUnits,
  verifyTypedData,
  type Address,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";
import { getEnv } from "../../lib/env.js";
import { getPublicClient } from "../../lib/evm.js";
import { fundDeveloperAgent, getDeveloperAgentForOwner } from "./developer-agent.js";

/**
 * Returns whether gas-sponsored fund relay is configured.
 */
export function isFundRelayEnabled(): boolean {
  return /^0x[a-fA-F0-9]{64}$/.test(getEnv().relayerPrivateKey);
}

/**
 * Derives the relayer EVM address from `RELAYER_PRIVATE_KEY` (pays gas on-chain).
 * @returns Lowercase address, or null when relayer is not configured
 */
export function getRelayerAddress(): `0x${string}` | null {
  const key = getEnv().relayerPrivateKey.trim();
  if (!/^0x[a-fA-F0-9]{64}$/.test(key)) return null;
  return privateKeyToAccount(key as Hex).address.toLowerCase() as `0x${string}`;
}

/**
 * Builds a viem wallet client for the configured relayer hot wallet.
 * @throws When `RELAYER_PRIVATE_KEY` is missing or invalid
 */
function getRelayerWalletClient() {
  const key = getEnv().relayerPrivateKey.trim();
  if (!/^0x[a-fA-F0-9]{64}$/.test(key)) {
    throw new Error("Gas relayer is not configured (RELAYER_PRIVATE_KEY)");
  }

  const account = privateKeyToAccount(key as Hex);
  const rpcUrl = getEnv().rpcUrl.trim() || baseSepolia.rpcUrls.default.http[0]!;
  return createWalletClient({
    account,
    chain: baseSepolia,
    transport: http(rpcUrl),
  });
}

/**
 * Relays a USDC EIP-3009 transfer to fund an agent wallet, then credits allowance.
 * @param admin - Supabase admin client
 * @param agentId - Agent id
 * @param input - Owner, amount, and signed authorization
 * @returns Updated agent and settlement tx hash
 */
export async function relayFundDeveloperAgent(
  admin: SupabaseClient,
  agentId: string,
  input: FundDeveloperAgentRelayInput,
): Promise<{ agent: DeveloperAgent; txHash: Hex }> {
  const owner = input.ownerAddress.toLowerCase();
  const from = input.from.toLowerCase() as Address;
  const to = input.to.toLowerCase() as Address;

  if (from !== owner) {
    throw new Error("Authorization signer must match ownerAddress");
  }

  const agent = await getDeveloperAgentForOwner(admin, agentId, owner);
  if (!agent) {
    throw new Error("Agent not found");
  }
  if (agent.chain !== "base-sepolia" || agent.asset !== "USDC") {
    throw new Error("Gas-sponsored fund only supports base-sepolia USDC agents");
  }
  if (to !== agent.walletAddress.toLowerCase()) {
    throw new Error("Authorization recipient must be the agent wallet");
  }
  if (agent.allowanceEth + input.amount > agent.dailyLimit) {
    throw new Error("Allowance would exceed dailyLimit");
  }

  const value = BigInt(input.value);
  const validAfter = BigInt(input.validAfter);
  const validBefore = BigInt(input.validBefore);
  const nonce = input.nonce as Hex;
  const expectedValue = parseUnits(String(input.amount), 6);
  if (value !== expectedValue) {
    throw new Error("Signed USDC value does not match amount");
  }

  const now = BigInt(Math.floor(Date.now() / 1000));
  if (validAfter > now) {
    throw new Error("Authorization is not yet valid");
  }
  if (validBefore <= now) {
    throw new Error("Authorization has expired — please sign again");
  }

  const message = {
    from,
    to,
    value,
    validAfter,
    validBefore,
    nonce,
  };

  const valid = await verifyTypedData({
    address: from,
    domain: usdcTransferAuthorizationDomain(),
    types: USDC_TRANSFER_AUTHORIZATION_TYPES,
    primaryType: "TransferWithAuthorization",
    message,
    signature: input.signature as Hex,
  });
  if (!valid) {
    throw new Error("Invalid USDC authorization signature");
  }

  const publicClient = getPublicClient(baseSepolia);
  const [alreadyUsed, balance] = await Promise.all([
    publicClient.readContract({
      address: USDC_CONTRACT_ADDRESS,
      abi: usdcAuthorizationAbi,
      functionName: "authorizationState",
      args: [from, nonce],
    }),
    publicClient.readContract({
      address: USDC_CONTRACT_ADDRESS,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [from],
    }),
  ]);
  if (alreadyUsed) {
    throw new Error("Authorization nonce already used");
  }
  if (balance < value) {
    throw new Error(
      `Insufficient USDC balance (have ${formatUnits(balance, 6)}, need ${formatUnits(value, 6)})`,
    );
  }

  const { v, r, s } = parseSignature(input.signature as Hex);
  const vByte = Number(v);
  const walletClient = getRelayerWalletClient();
  const hash = await walletClient.writeContract({
    address: USDC_CONTRACT_ADDRESS,
    abi: usdcAuthorizationAbi,
    functionName: "transferWithAuthorization",
    args: [from, to, value, validAfter, validBefore, nonce, vByte, r, s],
    chain: baseSepolia,
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") {
    throw new Error("Relayer transaction failed on-chain");
  }

  const updated = await fundDeveloperAgent(admin, agentId, owner, input.amount, hash);
  return { agent: updated, txHash: hash };
}
