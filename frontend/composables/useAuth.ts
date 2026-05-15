interface AuthState {
  token: string | null
  username: string | null
}

const TOKEN_KEY = 'kibunrogu_token'
const USERNAME_KEY = 'kibunrogu_username'

const authState = reactive<AuthState>({
  token: null,
  username: null,
})

export function useAuth() {
  function init() {
    if (import.meta.client) {
      authState.token = localStorage.getItem(TOKEN_KEY)
      authState.username = localStorage.getItem(USERNAME_KEY)
    }
  }

  function setAuth(token: string, username: string) {
    authState.token = token
    authState.username = username
    if (import.meta.client) {
      localStorage.setItem(TOKEN_KEY, token)
      localStorage.setItem(USERNAME_KEY, username)
    }
  }

  function logout() {
    authState.token = null
    authState.username = null
    if (import.meta.client) {
      localStorage.removeItem(TOKEN_KEY)
      localStorage.removeItem(USERNAME_KEY)
    }
  }

  function getHeaders(): Record<string, string> {
    if (!authState.token && import.meta.client) {
      init()
    }
    if (authState.token) {
      return { Authorization: `Bearer ${authState.token}` }
    }
    return {}
  }

  const isLoggedIn = computed(() => !!authState.token)

  return { authState, init, setAuth, logout, getHeaders, isLoggedIn }
}
