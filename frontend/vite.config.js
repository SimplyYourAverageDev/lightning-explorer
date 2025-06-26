import {defineConfig} from 'vite'
import preact from '@preact/preset-vite'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [preact()],
  build: {
    target: 'es2022',
    cssCodeSplit: true,
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
        pure_funcs: ['console.log', 'console.debug'],
        passes: 2,
      },
      mangle: {
        safari10: true,
      },
      format: {
        comments: false,
      },
    },
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/preact')) return 'vendor-preact';
          if (id.includes('node_modules/@msgpack/msgpack')) return 'vendor-msgpack';
          if (id.includes('node_modules/@phosphor-icons')) return 'vendor-icons';
          if (id.includes('node_modules')) return 'vendor';
          if (id.includes('/hooks/')) return 'hooks';
          if (id.includes('/utils/')) return 'utils';
        },
        chunkFileNames: (chunkInfo) => {
          const facadeModuleId = chunkInfo.facadeModuleId ? chunkInfo.facadeModuleId.split('/').pop() : 'chunk';
          return `${facadeModuleId}-[hash].js`;
        }
      }
    },
    chunkSizeWarningLimit: 1000,
  },
  resolve: {
    alias: {
      ...(process.env.NODE_ENV === 'production' ? {
        'preact/debug': 'preact/compat',
      } : {})
    }
  },
  optimizeDeps: {
    include: ['preact', '@msgpack/msgpack', '@phosphor-icons/react'],
    exclude: [],
  }
})
