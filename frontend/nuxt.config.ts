export default defineNuxtConfig({
  compatibilityDate: '2025-01-01',
  css: ['~/assets/css/global.css'],

  runtimeConfig: {
    public: {
      apiBase: process.env.NUXT_PUBLIC_API_BASE || 'http://localhost:8000',
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
        { name: 'viewport', content: 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no' },
        // 転職活動用ポートフォリオとして「リンク経由でのみ来てほしい」運用。検索エンジンは除外。
        { name: 'robots', content: 'noindex, nofollow' },
      ],
      script: [
        {
          src: 'https://static.cloudflareinsights.com/beacon.min.js',
          defer: true,
          'data-cf-beacon': '{"token": "3938880534044d83856c3c7a901b135e"}',
        },
      ],
    },
  },
})
