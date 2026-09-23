import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  server: { port: 5180, open: false },
  preview: { port: 5181 },
  build: {
    target: 'es2022',
    sourcemap: true,
    chunkSizeWarningLimit: 1500,
  },
});
