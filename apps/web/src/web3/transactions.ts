import {
  estimateGasCost,
  getContract,
  prepareTransaction,
  toEther,
  toWei,
} from "thirdweb";
import type { PreparedTransaction } from "thirdweb";
import type { Account } from "thirdweb/wallets";
import { transfer } from "thirdweb/extensions/erc20";
import { DEFAULT_CHAIN, SUPPORTED_ASSETS } from "@wallet/config";
import { thirdwebClient } from "@/web3/client";
import { appChain } from "@/web3/chains";

export interface PreparedSend {
  to: string;
  amount: string;
  asset: string;
  chain: string;
  estimatedFee: string;
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
 * Validates send inputs and builds a thirdweb PreparedTransaction.
 * @param to - Recipient address
 * @param amount - Decimal amount
 * @param asset - Asset symbol (ETH / USDC)
 * @returns Prepared transaction for TransactionButton / TransactionWidget
 * @throws When asset is unsupported or inputs are invalid
 */
export function buildSendTransaction(
  to: string,
  amount: string,
  asset: string,
): PreparedTransaction {
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

  if (!token.address) {
    return prepareTransaction({
      to,
      client: thirdwebClient,
      chain: appChain,
      value: toWei(amount),
    });
  }

  const contract = getContract({
    client: thirdwebClient,
    chain: appChain,
    address: token.address,
  });

  return transfer({
    contract,
    to,
    amount,
  });
}

/**
 * Estimates network fee for a prepared send transaction.
 * @param to - Recipient address
 * @param amount - Decimal amount
 * @param asset - Asset symbol
 * @param account - Optional connected account for better estimation
 * @returns Human-readable fee in ETH, e.g. "~0.000021 ETH"
 */
export async function estimateSendFee(
  to: string,
  amount: string,
  asset: string,
  account?: Account,
): Promise<string> {
  const transaction = buildSendTransaction(to, amount, asset);
  const cost = await estimateGasCost({
    transaction,
    account,
  });

  const ether = Number(toEther(cost.wei));
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
