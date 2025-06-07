import {defineConfig} from 'vite'
import preact from '@preact/preset-vite'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [preact()],
  build: {
    target: 'es2022',
    cssCodeSplit: true,
    brotliSize: false,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/preact')) return 'vendor-preact';
          if (id.includes('node_modules/@msgpack/msgpack')) return 'vendor-msgpack';
          if (id.includes('node_modules')) return 'vendor';
        }
      }
    }
  }
})
