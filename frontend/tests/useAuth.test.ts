import { describe, it, expect, beforeEach, vi } from 'vitest'
import { reactive, computed } from 'vue'

// Mock import.meta.client
vi.stubGlobal('__NUXT__', {})

// Mock Nuxt auto-imports
vi.stubGlobal('reactive', reactive)
vi.stubGlobal('computed', computed)

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value },
    removeItem: (key: string) => { delete store[key] },
    clear: () => { store = {} },
  }
})()
Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock })

// We need to mock import.meta.client which is used in the composable
// Since happy-dom runs in a browser-like env, import.meta.client might be undefined
// Let's handle this by patching the module

const { useAuth } = await import('../composables/useAuth')

describe('useAuth', () => {
  beforeEach(() => {
    localStorageMock.clear()
    // Reset auth state
    const { logout } = useAuth()
    logout()
  })

  it('should start as not logged in', () => {
    const { isLoggedIn } = useAuth()
    expect(isLoggedIn.value).toBe(false)
  })

  it('should login with setAuth', () => {
    const { setAuth, authState, isLoggedIn } = useAuth()
    setAuth('test-token', 'testuser')
    expect(authState.token).toBe('test-token')
    expect(authState.username).toBe('testuser')
    expect(isLoggedIn.value).toBe(true)
  })

  it('should logout and clear state', () => {
    const { setAuth, logout, authState, isLoggedIn } = useAuth()
    setAuth('test-token', 'testuser')
    logout()
    expect(authState.token).toBeNull()
    expect(authState.username).toBeNull()
    expect(isLoggedIn.value).toBe(false)
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
})
