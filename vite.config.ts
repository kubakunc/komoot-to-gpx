import { sveltekit } from '@sveltejs/kit/vite';
import { SvelteKitPWA } from '@vite-pwa/sveltekit';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [
    sveltekit(),
    SvelteKitPWA({
      strategies: 'generateSW',
      registerType: 'autoUpdate',
      manifest: false,
      workbox: {
        globPatterns: ['client/**/*.{js,css,html,ico,png,svg,webmanifest}'],
        navigateFallback: null
      }
    })
  ],
  server: {
    port: 5173
  }
});
