import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useActiveAccount } from "thirdweb/react";
import { useA2AStore } from "@/stores/a2a";
import { fetchTokenBalances, findDisplayBalance } from "@/web3";

/**
 * Loads live token balances for the connected wallet.
 */
export function useWalletBalances() {
  const account = useActiveAccount();
  const address = account?.address;
  const syncWalletEth = useA2AStore((s) => s.syncWalletEth);

  const query = useQuery({
    queryKey: ["wallet-balances", address],
    enabled: Boolean(address),
    queryFn: () => fetchTokenBalances(address!),
    refetchInterval: 20_000,
  });

  const balances = query.data ?? [];
  const usdc = Number(findDisplayBalance(balances, "USDC")) || 0;
  const eth = Number(findDisplayBalance(balances, "ETH")) || 0;

  useEffect(() => {
    if (!query.isSuccess) return;
    syncWalletEth(eth);
  }, [query.isSuccess, eth, syncWalletEth]);

  return {
    address,
    balances,
    usdc,
    eth,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    refetch: query.refetch,
    error: query.error,
  };
}
