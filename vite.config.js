import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"

export default defineConfig({
  plugins: [react()],
  server: { port: 5173 },
  esbuild: {
    drop: ["console", "debugger"],
  },
  build: {
    target: "es2015",
    minify: "esbuild",
    rollupOptions: {
      output: {
        /* Split vendor chunks for better caching */
        manualChunks: {
          "react-core":   ["react", "react-dom"],
          "react-router": ["react-router-dom"],
        },
        /* Hash filenames for cache busting */
        chunkFileNames:  "assets/[name]-[hash].js",
        entryFileNames:  "assets/[name]-[hash].js",
        assetFileNames:  "assets/[name]-[hash][extname]",
      },
    },
    /* Increase chunk size warning limit */
    chunkSizeWarningLimit: 600,
    /* Generate source maps for production debugging */
    sourcemap: false,
  },
  /* Preload directives */
  optimizeDeps: {
    include: ["react", "react-dom", "react-router-dom"],
  },
})
