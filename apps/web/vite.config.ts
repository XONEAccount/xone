import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

/** Required for thirdweb Google/GitHub OAuth popups to talk back to the opener. */
const oauthHeaders = {
  "Cross-Origin-Opener-Policy": "same-origin-allow-popups",
};

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5173,
    headers: oauthHeaders,
  },
  preview: {
    headers: oauthHeaders,
  },
});
