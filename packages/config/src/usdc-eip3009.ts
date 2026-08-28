/** Base Sepolia chain id — kept local to avoid circular imports with `index.ts`. */
const BASE_SEPOLIA_CHAIN_ID = 84532;

/** Circle USDC on Base Sepolia (must match `SUPPORTED_ASSETS` in `index.ts`). */
export const USDC_CONTRACT_ADDRESS =
  "0x036CbD53842c5426634e7929541eC2318f3dCF7e" as `0x${string}`;

/** USDC decimals on Base Sepolia. */
export const USDC_DECIMALS = 6;

/** Circle USDC EIP-3009 typed-data field list. */
export const USDC_TRANSFER_AUTHORIZATION_TYPES = {
  TransferWithAuthorization: [
    { name: "from", type: "address" },
    { name: "to", type: "address" },
    { name: "value", type: "uint256" },
    { name: "validAfter", type: "uint256" },
    { name: "validBefore", type: "uint256" },
    { name: "nonce", type: "bytes32" },
  ],
} as const;

/**
 * EIP-712 domain for Circle USDC `TransferWithAuthorization` on Base Sepolia.
 * Domain `name` must match on-chain `name()` (`USDC`), not the display name "USD Coin".
 */
export function usdcTransferAuthorizationDomain(): {
  name: "USDC";
  version: "2";
  chainId: number;
  verifyingContract: `0x${string}`;
} {
  return {
    name: "USDC",
    version: "2",
    chainId: BASE_SEPOLIA_CHAIN_ID,
    verifyingContract: USDC_CONTRACT_ADDRESS,
  };
}

/** Minimal ABI for EIP-3009 relay reads/writes. */
export const usdcAuthorizationAbi = [
  {
    type: "function",
    name: "transferWithAuthorization",
    inputs: [
      { name: "from", type: "address" },
      { name: "to", type: "address" },
      { name: "value", type: "uint256" },
      { name: "validAfter", type: "uint256" },
      { name: "validBefore", type: "uint256" },
      { name: "nonce", type: "bytes32" },
      { name: "v", type: "uint8" },
      { name: "r", type: "bytes32" },
      { name: "s", type: "bytes32" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "authorizationState",
    inputs: [
      { name: "authorizer", type: "address" },
      { name: "nonce", type: "bytes32" },
    ],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
  },
] as const;

/**
 * Default authorization validity window (seconds from now).
 */
export const USDC_AUTHORIZATION_TTL_SECONDS = 3600;
