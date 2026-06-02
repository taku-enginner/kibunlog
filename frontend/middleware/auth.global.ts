// 未ログインでもアクセス可能なルート。
// `/` は components/Landing.vue を出す入口として開放する (Phase 2)。
const PUBLIC_ROUTES = new Set(['/login', '/'])

export default defineNuxtRouteMiddleware((to) => {
  if (import.meta.server) return

  const { isLoggedIn, init } = useAuth()
  init()

  if (!PUBLIC_ROUTES.has(to.path) && !isLoggedIn.value) {
    return navigateTo('/login')
  }
  if (to.path === '/login' && isLoggedIn.value) {
    return navigateTo('/')
  }
})
