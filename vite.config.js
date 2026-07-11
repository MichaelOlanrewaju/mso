import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"

/* ── Service-worker cache-busting ────────────────────────────
   public/sw.js is copied verbatim into the build output by Vite (files
   in public/ are not processed). This plugin post-processes the emitted
   sw.js and swaps the "__SW_BUILD_ID__" token for a unique per-build id,
   so CACHE_NAME changes on every production build. That is what forces
   returning users onto the fresh JS bundle instead of a stale cached one
   — the root cause of "I deployed the fix but the app still runs old code
   (phantom session-expired)". No manual version bump ever needed again. */
function swVersionPlugin() {
  const buildId = Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8)
  return {
    name: "mso-sw-version",
    apply: "build",
    // Runs after all files (including the copied public/sw.js) are written.
    async writeBundle(options) {
      const { readFile, writeFile } = await import("node:fs/promises")
      const { join } = await import("node:path")
      const outDir = options.dir || "dist"
      const swPath = join(outDir, "sw.js")
      try {
        let src = await readFile(swPath, "utf8")
        if (src.includes("__SW_BUILD_ID__")) {
          src = src.replaceAll("__SW_BUILD_ID__", buildId)
          await writeFile(swPath, src)
          console.log(`[mso-sw-version] stamped sw.js cache name → mso-${buildId}`)
        } else {
          console.warn("[mso-sw-version] __SW_BUILD_ID__ token not found in sw.js — cache name NOT bumped")
        }
      } catch (e) {
        console.warn("[mso-sw-version] could not stamp sw.js:", e.message)
      }
    },
  }
}

export default defineConfig({
  plugins: [react(), swVersionPlugin()],
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
