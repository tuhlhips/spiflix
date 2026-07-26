import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { resolve } from 'node:path'

export default defineConfig({
  plugins: [
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
        description: 'Stream movies and TV shows',
        theme_color: '#dc2626',
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
