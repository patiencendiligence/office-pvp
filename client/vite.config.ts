import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/** Relative base so `/assets/...` works on Render root and GitHub Pages `/repo/` without wrong absolute URLs. */
export default defineConfig({
  plugins: [react()],
  base: './',
  server: {
    port: 5180,
    proxy: {
      '/socket.io': {
        target: 'http://localhost:3001',
        ws: true,
      },
    },
  },
});
