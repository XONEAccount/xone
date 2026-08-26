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
    },
  },
  server: {
    port: 5190,
    open: true,
  },
});
