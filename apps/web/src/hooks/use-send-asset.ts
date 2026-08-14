import { useSendTransaction } from "@privy-io/react-auth";
import { buildSendTransaction } from "@/web3/transactions";
import { useWalletAccount } from "@/hooks/use-wallet-account";

/**
 * Sends ETH or ERC-20 from the connected Privy wallet.
 */
export function useSendAsset() {
  const { sendTransaction } = useSendTransaction();
  const { address } = useWalletAccount();

  /**
   * Builds, signs, and broadcasts a transfer.
   * @param to - Recipient address
   * @param amount - Decimal amount
   * @param asset - Asset symbol
   * @param chainSlug - Optional product chain slug
   * @returns Transaction hash
   * @throws When the wallet is missing or the chain rejects the tx
   */
  async function sendAsset(
    to: string,
    amount: string,
    asset: string,
    chainSlug?: string,
  ): Promise<string> {
    const tx = buildSendTransaction(to, amount, asset, chainSlug);
    const result = await sendTransaction(
      {
        to: tx.to,
        value: tx.value ?? 0n,
        data: tx.data,
        chainId: tx.chainId,
      },
      {
        address,
        uiOptions: { showWalletUIs: false },
      },
    );
    return result.hash;
  }

  return { sendAsset };
}
