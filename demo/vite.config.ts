import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  root: fileURLToPath(new URL(".", import.meta.url)),
  resolve: {
    alias: {
      "modern-dt-pro": fileURLToPath(new URL("../src/index.ts", import.meta.url)),
    },
  },
  server: {
    port: 5174,
    open: true,
    fs: {
      allow: [".."],
    },
  },
});
