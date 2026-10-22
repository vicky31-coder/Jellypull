import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { viteSingleFile } from 'vite-plugin-singlefile'

// https://vite.dev/config/
export default defineConfig({
  plugins: [svelte(), viteSingleFile()],
  build: {
    outDir: '../web',
    emptyOutDir: false,
  },
  server: {
    proxy: {
      '/api': 'http://localhost:8045',
      '/health': 'http://localhost:8045',
    }
  }
})
