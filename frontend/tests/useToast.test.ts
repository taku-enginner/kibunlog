import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ref } from 'vue'

// Mock Nuxt auto-imports
vi.stubGlobal('ref', ref)

// Import after stubbing
const { useToast } = await import('../composables/useToast')

describe('useToast', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    const { toasts } = useToast()
    toasts.value = []
  })

  afterEach(() => {
    vi.useRealTimers()
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

  it('should auto-remove toast after default duration (2000ms)', () => {
    const { toasts, show } = useToast()
    show('Temporary')
    expect(toasts.value).toHaveLength(1)

    vi.advanceTimersByTime(2000)
    expect(toasts.value).toHaveLength(0)
  })

  it('should auto-remove toast after custom duration', () => {
    const { toasts, show } = useToast()
    show('Custom', 'success', 5000)
    expect(toasts.value).toHaveLength(1)

    vi.advanceTimersByTime(4999)
    expect(toasts.value).toHaveLength(1)

    vi.advanceTimersByTime(1)
    expect(toasts.value).toHaveLength(0)
  })

  it('should handle multiple toasts with different durations', () => {
    const { toasts, show } = useToast()
    show('First', 'success', 1000)
    show('Second', 'error', 2000)
    show('Third', 'success', 3000)
    expect(toasts.value).toHaveLength(3)

    vi.advanceTimersByTime(1000)
    expect(toasts.value).toHaveLength(2)
    expect(toasts.value[0].message).toBe('Second')
    expect(toasts.value[1].message).toBe('Third')

    vi.advanceTimersByTime(1000)
    expect(toasts.value).toHaveLength(1)
    expect(toasts.value[0].message).toBe('Third')

    vi.advanceTimersByTime(1000)
    expect(toasts.value).toHaveLength(0)
  })

  it('should assign unique ids to each toast', () => {
    const { toasts, show } = useToast()
    show('A')
    show('B')
    expect(toasts.value[0].id).not.toBe(toasts.value[1].id)
  })

  it('should keep message and type as provided', () => {
    const { toasts, show } = useToast()
    show('Test message', 'error', 10000)
    expect(toasts.value[0].message).toBe('Test message')
    expect(toasts.value[0].type).toBe('error')
  })
})
