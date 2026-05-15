export default defineNuxtRouteMiddleware((to) => {
  if (import.meta.server) return

  const { isLoggedIn, init } = useAuth()
  init()

  if (to.path !== '/login' && !isLoggedIn.value) {
    return navigateTo('/login')
  }
  if (to.path === '/login' && isLoggedIn.value) {
    return navigateTo('/')
  }
})
