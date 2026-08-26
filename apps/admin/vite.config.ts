import { sharedFavicon } from "@xone/assets";
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

export default defineConfig({
  plugins: [vue(), sharedFavicon()],
  server: {
    port: 5174,
  },
});
