import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5280,
    strictPort: true,
    host: true,
    watch: {
      ignored: ['**/.tmp-*', '**/.tmp-xlsx/**'],
    },
  },
  preview: {
    port: 4280,
    strictPort: true,
  },
})
