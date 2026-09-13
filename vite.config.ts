import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Relative base: the build works from ANY path (GitHub Pages /selleros/,
// custom domains, local preview) without rebuilds. Hash routing avoids
// deep-link issues on static hosts.
export default defineConfig({
  base: './',
  plugins: [react()],
  build: { outDir: 'dist', sourcemap: false, chunkSizeWarningLimit: 900 },
  server: { host: '0.0.0.0', port: 5173, allowedHosts: true },
  preview: { host: '0.0.0.0', port: 4173 },
});
