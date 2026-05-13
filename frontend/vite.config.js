import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react-swc';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [react()],
    resolve: {
      alias: {
        // Resolve the shared-core package locally without npm symlink dependency
        '@smart-airport/shared-core': path.resolve(__dirname, '../shared-core'),
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      port: 5173,
      proxy: {
        // All /api requests go to the backend — no hardcoded URLs in the app code
        '/api': {
          target: env.VITE_API_BASE_URL || 'http://127.0.0.1:8000',
          changeOrigin: true,
          secure: false,
          configure: (proxy) => {
            proxy.on('error', (err) => {
              console.error('[vite proxy] backend unreachable:', err.message);
            });
          },
        },
      },
    },
    build: {
      // Split vendor chunks to reduce initial bundle size
      rollupOptions: {
        output: {
          manualChunks: {
            'react-vendor': ['react', 'react-dom', 'react-router-dom'],
            'lucide':       ['lucide-react'],
          },
        },
      },
    },
  };
});
