import {createHtmlPlugin} from 'vite-plugin-html'
import {defineConfig} from 'vite'
import {resolve} from 'path'
import unocss from 'unocss/vite'
import vue from '@vitejs/plugin-vue'
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        assetFileNames: 'assets/[name].[ext]',
        chunkFileNames: 'chunks/[name].js',
        entryFileNames: 'entries/[name].js'
      }
    },
    sourcemap: true,
    target: 'esnext'
  },
  esbuild: {
    legalComments: 'none'
  },
  plugins: [createHtmlPlugin({
    minify: true
  }), unocss(), vue({
    reactivityTransform: true
  })],
  resolve: {
    alias: {
      '~/client': resolve(__dirname, './src')
    }
  }
})