import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig(({ mode }) => ({
  plugins: [sveltekit()],
  server: { port: 5174 },
  build: { target: 'es2020' },
  define: {
    __DEV__: JSON.stringify(mode !== 'production')
  }
}));
