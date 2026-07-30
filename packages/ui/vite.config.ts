import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { resolve } from 'node:path'

/**
 * Fail the production build when VITE_API_URL is missing.
 *
 * Without it the value compiles to '' and every API call resolves against the
 * Pages origin, where the /* -> /index.html SPA rule answers 200 with HTML. The
 * app then parses HTML as JSON and every rail renders empty — a site that looks
 * up but has no content, and nothing in the build output hints at it. That
 * shipped to production once already (a build on a checkout with no .env).
 * Cheaper to refuse to build than to discover it live.
 */
function requireApiUrl() {
  return {
    name: 'spiflix:require-api-url',
    apply: 'build' as const,
    config(_config: unknown, { mode }: { mode: string }) {
      if (mode !== 'production') return
      // loadEnv, not process.env: Vite reads .env files into import.meta.env
      // itself and does not put them on process.env at config time, so checking
      // process.env alone would fail the build even with .env.production present.
      // Inline `VITE_API_URL=... npm run build` still works — loadEnv merges it.
      const loaded = loadEnv(mode, __dirname, 'VITE_')
      if ((loaded.VITE_API_URL ?? process.env.VITE_API_URL)?.trim()) return
      throw new Error(
        'VITE_API_URL is empty — the production bundle would call the Pages origin instead of the backend.\n' +
        'Set it in packages/ui/.env.production (committed) or pass it inline:\n' +
        '  VITE_API_URL=https://api.spiflix.online npm run build',
      )
    },
  }
}

export default defineConfig({
  plugins: [
    requireApiUrl(),
    react(),
    tailwindcss(),
    VitePWA({
      // 'prompt' (not autoUpdate): a new deploy surfaces a "refresh" toast the
      // user controls, instead of silently serving the old shell until the
      // next navigation. See PwaUpdatePrompt.
      registerType: 'prompt',
      workbox: {
        // Include the locale JSON — without it an offline launch renders raw
        // i18n keys (nav.home, drawer.play) because the strings never cached.
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}', 'locales/**/*.json'],
        cleanupOutdatedCaches: true,
      },
      manifest: {
        name: 'Spiflix',
        short_name: 'Spiflix',
        description: 'Thousands of movies and TV shows, streamed free. Watch together in sync with friends.',
        theme_color: '#e92a34',
        background_color: '#000000',
        display: 'standalone',
        icons: [
          // Real PNGs (rasterized from icon.svg) — installability requires a
          // 192px+ raster icon; the SVG stays as a scalable fallback.
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3000',
      '/v1': 'http://localhost:3000',
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          hls: ['hls.js'],
        },
      },
    },
  },
})
