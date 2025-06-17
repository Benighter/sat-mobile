import path from 'path';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      },
      build: {
        outDir: 'dist',
        assetsDir: 'assets',
        sourcemap: false,
        minify: 'terser',
        target: 'es2020',
        cssCodeSplit: true,
        rollupOptions: {
          output: {
            manualChunks: {
              vendor: ['react', 'react-dom'],
              charts: ['chart.js', 'react-chartjs-2'],
              utils: ['xlsx', 'framer-motion'],
              icons: ['lucide-react']
            }
          }
        },
        terserOptions: {
          compress: {
            drop_console: true,
            drop_debugger: true,
            pure_funcs: ['console.log', 'console.info', 'console.debug', 'console.warn']
          }
        },
        chunkSizeWarningLimit: 1000
      },
      server: {
        port: 3000,
        host: true,
        strictPort: true
      },
      preview: {
        port: 3000,
        host: true,
        strictPort: true
      },
      optimizeDeps: {
        include: ['react', 'react-dom', 'chart.js', 'react-chartjs-2', 'xlsx', 'framer-motion', 'lucide-react'],
        force: true
      },
      esbuild: {
        target: 'es2020',
        logOverride: { 'this-is-undefined-in-esm': 'silent' }
      }
    };
});
