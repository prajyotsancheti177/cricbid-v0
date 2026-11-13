import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        /**
         * Split the big, stable libraries into their own chunks.
         *
         * Only libraries the entry chunk genuinely needs are named here. Anything
         * left unnamed is placed by Rollup next to whichever route imports it, so
         * recharts, leaflet, jspdf and html2canvas ride along with the lazy
         * chunks for analytics, the geo map and the player card rather than
         * being hoisted into a shared bundle every visitor downloads.
         *
         * These are content-hashed and served with a one-year immutable
         * Cache-Control, so keeping React and the router in a chunk of their own
         * means an app-code deploy no longer invalidates them.
         */
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          if (/[\\/]node_modules[\\/](react|react-dom|scheduler|react-router|react-router-dom)[\\/]/.test(id)) {
            return "react";
          }
          if (id.includes("framer-motion") || id.includes("motion-dom") || id.includes("motion-utils")) {
            return "motion";
          }
          return undefined;
        },
      },
    },
  },
}));
