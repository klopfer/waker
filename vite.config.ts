import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  server: {
    port: 5173,
    open: true,
    // Don't watch the read-only legacy archive or the JPEXS-dump intermediates;
    // both are large and never change at dev time, so file-watcher init was
    // adding several seconds to cold starts on Windows.
    watch: {
      ignored: ['**/legacy/**', '**/src/assets/_extracted/**'],
    },
  },
  // Ensure these get pre-bundled deterministically so the first dev-server
  // hit doesn't trigger a long mid-page-load optimization pass.
  optimizeDeps: {
    include: ['pixi.js', 'pixi-filters', 'howler', 'gsap'],
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    target: 'es2022',
  },
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['tests/**/*.test.ts', 'src/**/*.test.ts'],
  },
});
