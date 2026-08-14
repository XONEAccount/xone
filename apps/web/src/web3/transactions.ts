import {
  encodeFunctionData,
  erc20Abi,
  formatEther,
  parseEther,
  parseUnits,
  type Hex,
} from "viem";
import { DEFAULT_CHAIN, SUPPORTED_ASSETS } from "@wallet/config";
import { chainFromSlug } from "@/web3/chains";
import { getPublicClientBySlug } from "@/web3/client";

export interface PreparedSend {
  to: string;
  amount: string;
  asset: string;
  chain: string;
  estimatedFee: string;
}

export interface PreparedTxRequest {
  to: Hex;
  value?: bigint;
  data?: Hex;
  chainId: number;
}

/**
 * Builds a human-readable preview for a send flow. Does not broadcast.
 * @param to - Recipient address
 * @param amount - Decimal amount string
 * @param asset - Asset symbol
 * @param estimatedFee - Formatted fee string
 */
export function prepareSendPreview(
  to: string,
  amount: string,
  asset: string,
  estimatedFee = "估算中…",
): PreparedSend {
  return {
    to,
    amount,
    asset,
    chain: DEFAULT_CHAIN.name,
    estimatedFee,
  };
}

/**
 * Validates send inputs and builds an unsigned EVM transaction request.
 * @param to - Recipient address
 * @param amount - Decimal amount
 * @param asset - Asset symbol (ETH / USDC)
 * @param chainSlug - Optional product chain slug
 * @returns Unsigned tx for Privy `sendTransaction`
 * @throws When asset is unsupported or inputs are invalid
 */
export function buildSendTransaction(
  to: string,
  amount: string,
  asset: string,
  chainSlug?: string,
): PreparedTxRequest {
  const parsed = Number(amount);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error("请输入有效金额");
  }

  if (!/^0x[a-fA-F0-9]{40}$/.test(to)) {
    throw new Error("收款地址格式不正确");
  }

  const token = SUPPORTED_ASSETS.find((item) => item.symbol === asset);
  if (!token) {
    throw new Error("暂不支持该资产");
  }

  const chain = chainFromSlug(chainSlug);
  const recipient = to as Hex;

  if (!token.address) {
    return {
      to: recipient,
      value: parseEther(amount),
      chainId: chain.id,
    };
  }

  return {
    to: token.address as Hex,
    data: encodeFunctionData({
      abi: erc20Abi,
      functionName: "transfer",
      args: [recipient, parseUnits(amount, token.decimals)],
    }),
    value: 0n,
    chainId: chain.id,
  };
}

/**
 * Estimates network fee for a prepared send transaction.
 * @param to - Recipient address
 * @param amount - Decimal amount
 * @param asset - Asset symbol
 * @param from - Optional sender for more accurate estimation
 * @param chainSlug - Optional product chain slug
 * @returns Human-readable fee in ETH, e.g. "~0.000021 ETH"
 */
export async function estimateSendFee(
  to: string,
  amount: string,
  asset: string,
  from?: string,
  chainSlug?: string,
): Promise<string> {
  const tx = buildSendTransaction(to, amount, asset, chainSlug);
  const client = getPublicClientBySlug(chainSlug);
  const account = from && /^0x[a-fA-F0-9]{40}$/.test(from) ? (from as Hex) : undefined;

  const [gas, gasPrice] = await Promise.all([
    client.estimateGas({
      account,
      to: tx.to,
      value: tx.value,
      data: tx.data,
    }),
    client.getGasPrice(),
  ]);

  const ether = Number(formatEther(gas * gasPrice));
  if (!Number.isFinite(ether) || ether <= 0) {
    return "< 0.000001 ETH";
  }

  const formatted = ether.toLocaleString("en-US", {
    useGrouping: false,
    maximumFractionDigits: 6,
  });
  return `~${formatted} ETH`;
}

/**
 * USDC contract token address on the active app chain.
 */
export const USDC_ADDRESS = SUPPORTED_ASSETS.find((a) => a.symbol === "USDC")?.address ?? undefined;
