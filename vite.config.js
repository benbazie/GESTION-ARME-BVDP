import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ command }) => ({
  base: command === 'build' ? './' : '/',
  plugins: [
    react(),
    {
      name: 'trace-active-config',
      apply: 'serve',
      configResolved(config) {
        console.log(`[vite] mode=${config.mode} base=${config.base} cssCodeSplit=${config.build.cssCodeSplit}`);
      }
    }
  ],
  resolve: {
    extensions: ['.jsx', '.js', '.json']
  },
  css: {
    devSourcemap: true,
    modules: {
      scopeBehaviour: "local",
      generateScopedName: "[name]__[local]__[hash:base64:5]"
    }
  },
  server: {
    port: 5173,
    open: true
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    emptyOutDir: true,
    assetsInlineLimit: 0,
    rollupOptions: {
      output: {
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]'
      }
    }
  },
}));
