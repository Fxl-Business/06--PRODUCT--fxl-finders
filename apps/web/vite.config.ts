import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, __dirname);

  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      port: 8006,
      strictPort: true,
      host: true,
      proxy: {
        '/auth': {
          target: env.VITE_AUTH_PROXY_TARGET || env.VITE_API_URL || 'http://localhost:3006',
          changeOrigin: false,
        },
      },
    },
    build: {
      outDir: 'dist',
      sourcemap: true,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) return undefined;
            if (id.includes('/@tanstack/')) {
              return 'vendor-query';
            }
            if (id.includes('/@radix-ui/')) {
              return 'vendor-radix';
            }
            return 'vendor';
          },
        },
      },
    },
  };
});
