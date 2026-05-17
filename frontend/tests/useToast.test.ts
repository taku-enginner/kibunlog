import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'

// Mock Nuxt auto-imports
vi.stubGlobal('ref', ref)

// Import after stubbing
const { useToast } = await import('../composables/useToast')

describe('useToast', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    // Clear toasts between tests
    const { toasts } = useToast()
    toasts.value = []
  })

  it('should show a toast with default type "success"', () => {
    const { toasts, show } = useToast()
    show('Hello')
    expect(toasts.value).toHaveLength(1)
    expect(toasts.value[0].message).toBe('Hello')
    expect(toasts.value[0].type).toBe('success')
  })

  it('should show a toast with type "error"', () => {
    const { toasts, show } = useToast()
    show('Error occurred', 'error')
    expect(toasts.value).toHaveLength(1)
    expect(toasts.value[0].type).toBe('error')
  })

  it('should auto-remove toast after duration', () => {
    const { toasts, show } = useToast()
    show('Temporary', 'success', 3000)
    expect(toasts.value).toHaveLength(1)

    vi.advanceTimersByTime(3000)
    expect(toasts.value).toHaveLength(0)
  })

  it('should handle multiple toasts', () => {
    const { toasts, show } = useToast()
    show('First', 'success', 1000)
    show('Second', 'error', 2000)
    expect(toasts.value).toHaveLength(2)

    vi.advanceTimersByTime(1000)
    expect(toasts.value).toHaveLength(1)
    expect(toasts.value[0].message).toBe('Second')

    vi.advanceTimersByTime(1000)
    expect(toasts.value).toHaveLength(0)
  })
})
