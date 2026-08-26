import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import { sharedFavicon } from "@xone/assets";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

/** Required for Privy Google/GitHub OAuth popups to talk back to the opener. */
const oauthHeaders = {
  "Cross-Origin-Opener-Policy": "same-origin-allow-popups",
};

export default defineConfig({
  plugins: [react(), tailwindcss(), sharedFavicon()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  /**
   * Privy / Coinbase pull in eventemitter3@5 whose index.mjs does
   * `import … from './index.js'` (CJS). Vite serves that raw and browsers
   * reject the missing default export — force esbuild prebundle for interop.
   */
  optimizeDeps: {
    include: ["eventemitter3"],
  },
  server: {
    port: 5173,
    headers: oauthHeaders,
  },
  preview: {
    headers: oauthHeaders,
  },
});
