import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    // The service worker consumes this public manifest to install one complete,
    // version-matched app shell, including lazy feature chunks. Keeping the
    // manifest outside Vite's dot-directory also lets the production static
    // server expose it without enabling dotfile serving.
    manifest: "asset-manifest.json",
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules")) {
            if (id.includes("lucide-react")) return "icons";
            if (id.includes("/react-dom/") || id.includes("/react/") || id.includes("/scheduler/")) return "react-vendor";
          }
          return undefined;
        },
      },
    },
  },
  server: {
    host: "127.0.0.1",
    proxy: {
      "/api": "http://127.0.0.1:8787",
    },
  },
});
