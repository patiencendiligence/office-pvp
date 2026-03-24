import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/** Render / single host: default `/`. GitHub Pages subpath: `VITE_BASE=/office-pvp/ npm run build` */
const base = process.env.VITE_BASE ?? '/';

export default defineConfig({
  plugins: [react()],
  base,
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
