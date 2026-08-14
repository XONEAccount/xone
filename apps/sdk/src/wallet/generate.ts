import { Keypair } from "@solana/web3.js";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { ValidationError } from "../errors.js";
import type { XOneChain, WalletInfo } from "../types.js";
import { bytesToHex } from "../utils/id.js";

/** Chains that use EVM addresses / secp256k1 keys. */
const EVM_CHAINS: ReadonlySet<XOneChain> = new Set([
  "base",
  "base-sepolia",
  "polygon",
  "arbitrum",
]);

/**
 * Returns whether the chain uses an EVM wallet.
 * @param chain - Target settlement chain
 * @returns `true` for supported EVM chains
 */
export function isEvmChain(chain: XOneChain): boolean {
  return EVM_CHAINS.has(chain);
}

/**
 * Generates a local wallet for the given chain.
 * Solana is rejected until x402 + tooling are complete.
 *
 * @param chain - Settlement chain
 * @returns Wallet address + private key material
 */
export function createLocalWallet(chain: XOneChain): WalletInfo {
  if (chain === "solana") {
    throw new ValidationError(
      "Solana agents are not supported yet — use base-sepolia / base / polygon / arbitrum",
    );
  }

  if (isEvmChain(chain)) {
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
