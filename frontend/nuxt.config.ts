export default defineNuxtConfig({
  compatibilityDate: '2025-01-01',
  css: ['~/assets/css/global.css'],

  runtimeConfig: {
    public: {
      apiBase: process.env.NUXT_PUBLIC_API_BASE || 'http://localhost:8000',
      googleMapsApiKey: process.env.NUXT_PUBLIC_GOOGLE_MAPS_API_KEY || '',
    },
  },

  routeRules: {
    '/api/**': {
      proxy: `${process.env.NUXT_PUBLIC_API_BASE || 'http://localhost:8000'}/**`,
    },
  },

  app: {
    head: {
      title: 'きぶんログ',
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      ],
    },
  },
})
