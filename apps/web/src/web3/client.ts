import { createThirdwebClient } from "thirdweb";
import { getWebEnv } from "@/lib/env";

const env = getWebEnv();

if (!env.thirdwebClientId) {
  console.warn("[web3] VITE_THIRDWEB_CLIENT_ID is missing");
}

/**
 * Shared thirdweb client for the web app.
 */
export const thirdwebClient = createThirdwebClient({
  clientId: env.thirdwebClientId || "missing-client-id",
});
