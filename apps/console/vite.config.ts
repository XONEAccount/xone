import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import { sharedFavicon } from "@xone/assets";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss(), sharedFavicon()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@xonepay/sdk/mock": path.resolve(__dirname, "../sdk/src/mock.ts"),
      "@xonepay/sdk": path.resolve(__dirname, "../sdk/src/index.ts"),
    },
  },
  server: {
    port: 5180,
    open: true,
  },
  optimizeDeps: {
    include: ["viem", "@solana/web3.js", "zod", "@langchain/core"],
  },
});
