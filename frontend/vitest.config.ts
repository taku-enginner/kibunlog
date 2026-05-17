import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import type { Plugin } from 'vite'

function nuxtImportMetaPlugin(): Plugin {
  return {
    name: 'nuxt-import-meta',
    transform(code, id) {
      if (id.includes('node_modules')) return
      return code.replace(/import\.meta\.client/g, 'true').replace(/import\.meta\.server/g, 'false')
    },
  }
}

export default defineConfig({
  plugins: [vue(), nuxtImportMetaPlugin()],
  test: {
    environment: 'happy-dom',
    coverage: {
      provider: 'v8',
      reporter: ['text'],
      thresholds: {
        statements: 90,
        branches: 80,
        functions: 90,
        lines: 90,
      },
      all: true,
      include: ['composables/useAuth.ts', 'composables/useToast.ts', 'composables/useDate.ts'],
    },
  },
})
