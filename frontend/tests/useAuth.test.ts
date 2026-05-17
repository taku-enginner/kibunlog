import { describe, it, expect, beforeEach, vi } from 'vitest'
import { reactive, computed } from 'vue'

// Mock Nuxt auto-imports
vi.stubGlobal('reactive', reactive)
vi.stubGlobal('computed', computed)

// Provide a proper localStorage mock since happy-dom's may not be complete
let store: Record<string, string> = {}
const localStorageMock = {
  getItem: (key: string) => store[key] ?? null,
  setItem: (key: string, value: string) => { store[key] = value },
  removeItem: (key: string) => { delete store[key] },
  clear: () => { store = {} },
  get length() { return Object.keys(store).length },
  key: (index: number) => Object.keys(store)[index] ?? null,
}
vi.stubGlobal('localStorage', localStorageMock)

const { useAuth } = await import('../composables/useAuth')

describe('useAuth', () => {
  beforeEach(() => {
    store = {}
    const { logout } = useAuth()
    logout()
  })

  it('should start as not logged in', () => {
    const { isLoggedIn, authState } = useAuth()
    expect(isLoggedIn.value).toBe(false)
    expect(authState.token).toBeNull()
    expect(authState.username).toBeNull()
  })

  it('should login with setAuth', () => {
    const { setAuth, authState, isLoggedIn } = useAuth()
    setAuth('test-token', 'testuser')
    expect(authState.token).toBe('test-token')
    expect(authState.username).toBe('testuser')
    expect(isLoggedIn.value).toBe(true)
  })

  it('setAuth should persist to localStorage', () => {
    const { setAuth } = useAuth()
    setAuth('test-token', 'testuser')
    expect(store['kibunrogu_token']).toBe('test-token')
    expect(store['kibunrogu_username']).toBe('testuser')
  })

  it('should logout and clear state', () => {
    const { setAuth, logout, authState, isLoggedIn } = useAuth()
    setAuth('test-token', 'testuser')
    logout()
    expect(authState.token).toBeNull()
    expect(authState.username).toBeNull()
    expect(isLoggedIn.value).toBe(false)
  })

  it('logout should clear localStorage', () => {
    const { setAuth, logout } = useAuth()
    setAuth('test-token', 'testuser')
    logout()
    expect(store['kibunrogu_token']).toBeUndefined()
    expect(store['kibunrogu_username']).toBeUndefined()
  })

  it('should return auth headers when logged in', () => {
    const { setAuth, getHeaders } = useAuth()
    setAuth('my-token', 'user1')
    expect(getHeaders()).toEqual({ Authorization: 'Bearer my-token' })
  })

  it('should return empty headers when not logged in', () => {
    const { getHeaders } = useAuth()
    expect(getHeaders()).toEqual({})
  })

  it('init should load from localStorage', () => {
    const { init, authState } = useAuth()
    store['kibunrogu_token'] = 'stored-token'
    store['kibunrogu_username'] = 'stored-user'
    // Clear in-memory state without clearing localStorage
    authState.token = null
    authState.username = null
    init()
    expect(authState.token).toBe('stored-token')
    expect(authState.username).toBe('stored-user')
  })

  it('getHeaders should call init when token is null', () => {
    const { authState, getHeaders } = useAuth()
    store['kibunrogu_token'] = 'lazy-token'
    store['kibunrogu_username'] = 'lazy-user'
    authState.token = null
    authState.username = null
    const headers = getHeaders()
    expect(headers).toEqual({ Authorization: 'Bearer lazy-token' })
  })

  it('isLoggedIn should be reactive', () => {
    const { setAuth, logout, isLoggedIn } = useAuth()
    expect(isLoggedIn.value).toBe(false)
    setAuth('token', 'user')
    expect(isLoggedIn.value).toBe(true)
    logout()
    expect(isLoggedIn.value).toBe(false)
  })
})
