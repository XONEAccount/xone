import { QueryClient } from "@tanstack/react-query";

/**
 * Shared TanStack Query client. Cleared on Privy logout so the next account
 * never inherits the previous wallet's balances or history.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15_000,
      retry: 1,
    },
  },
});
