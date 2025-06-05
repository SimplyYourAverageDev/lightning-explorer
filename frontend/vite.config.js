import {defineConfig} from 'vite'
import preact from '@preact/preset-vite'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [preact()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('@msgpack/msgpack')) return 'vendor-msgpack';
            if (id.includes('preact')) return 'vendor-preact';
            return 'vendor-other';
          }
        }
      }
    }
  }
})
