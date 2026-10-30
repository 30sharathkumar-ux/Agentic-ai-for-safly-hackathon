import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  // Target injected by Vercel service binding (BACKEND_URL or APP_URL) during `vercel dev`, or local backend
  const backendTarget =
    env.BACKEND_URL ||
    env.APP_URL ||
    process.env.BACKEND_URL ||
    process.env.APP_URL ||
    'http://127.0.0.1:8000';

  return {
    plugins: [react(), tailwindcss()],
    server: {
      host: true,
      port: 5173,
      proxy: {
        '/api': {
          target: backendTarget,
          changeOrigin: true,
        },
      },
    },
    build: {
      outDir: 'dist',
      emptyOutDir: true,
    },
  };
});
