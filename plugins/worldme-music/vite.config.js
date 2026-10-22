import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [vue()],
  base: './',
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  build: {
    outDir: fileURLToPath(new URL('./src-ztools/dist', import.meta.url)),
    emptyOutDir: true,
    target: 'chrome110',
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        lyrics: fileURLToPath(new URL('./lyrics.html', import.meta.url))
      },
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('hls.js')) return 'hls'
            return 'vendor'
          }
        }
      }
    }
  },
  server: {
    port: 5173,
    strictPort: false
  }
})
