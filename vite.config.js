import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const API_PORT = Number(process.env.API_PORT || 3001);
const WEB_PORT = Number(process.env.WEB_PORT || 3002);
const apiProxy = {
  '/api': {
    target: `http://127.0.0.1:${API_PORT}`,
    changeOrigin: true,
  },
};

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/recharts') || id.includes('node_modules/d3-')) return 'charts';
          if (id.includes('node_modules/react') || id.includes('node_modules/scheduler')) return 'react-vendor';
          if (id.includes('node_modules/lucide-react')) return 'icons';
          return undefined;
        },
      },
    },
  },
  server: {
    host: '0.0.0.0',
    port: WEB_PORT,
    strictPort: true,
    allowedHosts: true,
    proxy: apiProxy,
  },
  preview: {
    host: '0.0.0.0',
    port: WEB_PORT,
    strictPort: true,
    allowedHosts: true,
    proxy: apiProxy,
  },
});
