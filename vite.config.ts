import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: "./",
  server: {
    proxy: { "/api": "http://127.0.0.1:3002" },
    watch: { ignored: ["**/playwright-report/**", "**/test-results/**", "**/artifacts/**"] },
  },
  preview: { proxy: { "/api": "http://127.0.0.1:3002" } },
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
});
