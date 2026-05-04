import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['consumd-icon.jpg'],
      manifest: {
        name: 'Consumd',
        short_name: 'Consumd',
        description: 'Your personal media archive — movies, shows, books, games.',
        theme_color: '#07070f',
        background_color: '#07070f',
        display: 'standalone',
        icons: [
          {
            src: 'consumd-icon.jpg',
            sizes: '192x192',
            type: 'image/jpeg'
          },
          {
            src: 'consumd-icon.jpg',
            sizes: '512x512',
            type: 'image/jpeg'
          }
        ]
      }
    })
  ],
  root: './',
  esbuild: {
    drop: ['console', 'debugger'],
  },
});