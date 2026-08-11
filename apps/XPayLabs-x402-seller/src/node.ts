import { serve } from "@hono/node-server";
import { createApp } from "./app.js";

const port = Number(process.env.PORT ?? "4021");
const app = createApp();

serve(
  {
    fetch: app.fetch,
    port: Number.isFinite(port) ? port : 4021,
  },
  (info) => {
    const evm = process.env.EVM_ADDRESS || "0xYourEvmWalletAddress";
    const facilitator =
      process.env.FACILITATOR_URL || "https://x402.org/facilitator";
    const network = process.env.NETWORK || "eip155:84532";
    console.log(`XPayLabs x402 seller (Hono) at http://localhost:${info.port}`);
    console.log(`  EVM Address: ${evm}`);
    console.log(`  Facilitator: ${facilitator}`);
    console.log(`  Network: ${network}`);
    console.log("");
    console.log("  Endpoints:");
    console.log(`    GET /weather       — exact payment $0.001 (${network})`);
    console.log(`    GET /api/generate  — upto payment $0.10 max (${network})`);
    console.log("    GET /public        — free, no payment");
    console.log("    GET /health        — health check");
  },
);
