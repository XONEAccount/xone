import { defineConfig } from "vite";
import path from "node:path";

export default defineConfig({
  root: path.resolve(__dirname, "demo"),
  server: {
    port: 5173,
    open: true,
  },
  define: {
    // SDK reads XONE_API_URL internally (not via constructor).
    "process.env.XONE_API_URL": JSON.stringify(
      process.env.XONE_API_URL || "http://127.0.0.1:8787",
    ),
  },
  resolve: {
    alias: {
      "@xonepay/sdk": path.resolve(__dirname, "src/index.ts"),
    },
  },
  optimizeDeps: {
    include: ["@langchain/core", "viem", "@solana/web3.js", "zod"],
  },
});
