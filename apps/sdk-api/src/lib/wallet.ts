import { Keypair } from "@solana/web3.js";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { HttpError } from "./errors";
import { bytesToHex } from "./ids";

export type Chain = "base" | "base-sepolia" | "solana" | "polygon" | "arbitrum";

export type WalletInfo = {
  chain: Chain;
  address: string;
  privateKey: string;
  family: "evm" | "solana";
};

const EVM: ReadonlySet<Chain> = new Set([
  "base",
  "base-sepolia",
  "polygon",
  "arbitrum",
]);

/**
 * @param chain - Unknown chain string
 * @returns Normalized supported chain
 */
export function normalizeChain(chain: string | undefined): Chain {
  const value = (chain ?? "base-sepolia").toLowerCase() as Chain;
  const allowed: Chain[] = [
    "base",
    "base-sepolia",
    "polygon",
    "arbitrum",
    "solana",
  ];
  if (!allowed.includes(value)) {
    throw new HttpError(400, `Unsupported chain: ${chain}`, "validation_error");
  }
  if (value === "solana") {
    throw new HttpError(
      400,
      "Solana agents are not supported yet — use base-sepolia / base / polygon / arbitrum",
      "validation_error",
    );
  }
  return value;
}

/**
 * Generates a new wallet for the settlement chain.
 * @param chain - Settlement chain
 * @returns Wallet material
 */
export function createLocalWallet(chain: Chain): WalletInfo {
  if (EVM.has(chain)) {
    const key = generatePrivateKey() as `0x${string}`;
    const account = privateKeyToAccount(key);
    return {
      chain,
      address: account.address,
      privateKey: key,
      family: "evm",
    };
  }

  const keypair = Keypair.generate();
  return {
    chain,
    address: keypair.publicKey.toBase58(),
    privateKey: bytesToHex(keypair.secretKey),
    family: "solana",
  };
}
