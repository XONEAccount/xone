import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@xone/sdk/mock": path.resolve(__dirname, "../sdk/src/mock.ts"),
      "@xone/sdk": path.resolve(__dirname, "../sdk/src/index.ts"),
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
