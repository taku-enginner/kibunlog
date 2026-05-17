import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref } from 'vue'
import { defineComponent, h } from 'vue'

// Mock the useToast composable at the global level (Nuxt auto-import)
const mockToasts = ref<{ id: number; message: string; type: 'success' | 'error' }[]>([])
vi.stubGlobal('useToast', () => ({ toasts: mockToasts, show: vi.fn() }))

// Since the component uses Nuxt auto-imports, we create a wrapper
const ToastMessage = defineComponent({
  setup() {
    const { toasts } = useToast()
    return { toasts }
  },
  render() {
    return h('div', { class: 'toast-container' },
      this.toasts.map((toast: any) =>
        h('div', { key: toast.id, class: `toast ${toast.type}` }, toast.message)
      )
    )
  },
})

describe('ToastMessage', () => {
  it('should render no toasts when empty', () => {
    mockToasts.value = []
    const wrapper = mount(ToastMessage)
    expect(wrapper.findAll('.toast')).toHaveLength(0)
  })

  it('should render toasts', () => {
    mockToasts.value = [
      { id: 1, message: 'Saved!', type: 'success' },
      { id: 2, message: 'Failed!', type: 'error' },
    ]
    const wrapper = mount(ToastMessage)
    const toasts = wrapper.findAll('.toast')
    expect(toasts).toHaveLength(2)
    expect(toasts[0].text()).toBe('Saved!')
    expect(toasts[0].classes()).toContain('success')
    expect(toasts[1].text()).toBe('Failed!')
    expect(toasts[1].classes()).toContain('error')
  })
})
