import {
  USDC_AUTHORIZATION_TTL_SECONDS,
  USDC_DECIMALS,
  USDC_TRANSFER_AUTHORIZATION_TYPES,
  usdcTransferAuthorizationDomain,
} from "@xone/config";
import { parseUnits, type Hex } from "viem";

export type UsdcTransferAuthorizationMessage = {
  from: `0x${string}`;
  to: `0x${string}`;
  value: bigint;
  validAfter: bigint;
  validBefore: bigint;
  nonce: Hex;
};

/**
 * Generates a random bytes32 nonce for EIP-3009 authorization.
 * @returns 32-byte hex nonce
 */
export function randomAuthorizationNonce(): Hex {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return `0x${[...bytes].map((b) => b.toString(16).padStart(2, "0")).join("")}` as Hex;
}

/**
 * Builds EIP-712 typed data for Circle USDC `TransferWithAuthorization`.
 * @param input - Authorization fields
 * @returns Typed data payload for `signTypedData`
 */
export function buildUsdcTransferTypedData(input: {
  from: `0x${string}`;
  to: `0x${string}`;
  amount: string;
  nonce?: Hex;
  validBeforeSeconds?: number;
}) {
  const now = Math.floor(Date.now() / 1000);
  const message: UsdcTransferAuthorizationMessage = {
    from: input.from,
    to: input.to,
    value: parseUnits(input.amount.trim(), USDC_DECIMALS),
    validAfter: 0n,
    validBefore: BigInt(now + (input.validBeforeSeconds ?? USDC_AUTHORIZATION_TTL_SECONDS)),
    nonce: input.nonce ?? randomAuthorizationNonce(),
  };

  return {
    domain: usdcTransferAuthorizationDomain(),
    types: USDC_TRANSFER_AUTHORIZATION_TYPES,
    primaryType: "TransferWithAuthorization" as const,
    message,
  };
}

/**
 * Serializes authorization fields for the relay API (bigint → string).
 * @param message - Signed authorization message
 */
export function serializeUsdcAuthorizationMessage(message: UsdcTransferAuthorizationMessage) {
  return {
    from: message.from,
    to: message.to,
    value: message.value.toString(),
    validAfter: message.validAfter.toString(),
    validBefore: message.validBefore.toString(),
    nonce: message.nonce,
  };
}
