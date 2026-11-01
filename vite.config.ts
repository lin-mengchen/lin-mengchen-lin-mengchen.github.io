import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  // Keep assets relative so GitHub Pages repository subpaths work without a rebuild.
  base: './',
  plugins: [react()],
  assetsInclude: ['**/*.xlsx', '**/*.xls'],
  server: {
    watch: {
      ignored: ['**/qa/**', '**/dist/**'],
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/xlsx')) return 'spreadsheet'
          if (id.includes('node_modules/three') || id.includes('node_modules/@react-three')) return 'three'
          if (id.includes('node_modules/react') || id.includes('node_modules/scheduler')) return 'react'
          return undefined
        },
      },
    },
    chunkSizeWarningLimit: 950,
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    coverage: {
      reporter: ['text', 'json-summary'],
    },
  },
})
