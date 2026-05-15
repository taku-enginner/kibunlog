interface HeatmapEvent {
  x_pct: number
  y_pct: number
  page: string
  event_type: 'click' | 'touch'
  timestamp: string
}

const BUFFER_KEY = 'kibunrogu_heatmap_buffer'
const FLUSH_INTERVAL = 30000

export function useHeatmap() {
  if (!import.meta.client) return

  const config = useRuntimeConfig()
  const apiBase = config.public.apiBase
  const { getHeaders } = useAuth()

  let buffer: HeatmapEvent[] = []
  let timer: ReturnType<typeof setInterval> | null = null

  function loadBuffer() {
    try {
      const stored = localStorage.getItem(BUFFER_KEY)
      if (stored) {
        buffer = JSON.parse(stored)
      }
    } catch {
      buffer = []
    }
  }

  function saveBuffer() {
    try {
      localStorage.setItem(BUFFER_KEY, JSON.stringify(buffer))
    } catch {}
  }

  function recordEvent(e: MouseEvent | TouchEvent) {
    let x: number
    let y: number
    let eventType: 'click' | 'touch'

    if (e.type === 'touchstart') {
      const touch = (e as TouchEvent).touches[0]
      if (!touch) return
      x = touch.clientX
      y = touch.clientY
      eventType = 'touch'
    } else {
      const mouse = e as MouseEvent
      x = mouse.clientX
      y = mouse.clientY
      eventType = 'click'
    }

    const xPct = (x / window.innerWidth) * 100
    const yPct = (y / window.innerHeight) * 100

    buffer.push({
      x_pct: Math.round(xPct * 100) / 100,
      y_pct: Math.round(yPct * 100) / 100,
      page: window.location.pathname,
      event_type: eventType,
      timestamp: new Date().toISOString(),
    })

    saveBuffer()
  }

  async function flush() {
    if (buffer.length === 0) return

    const toSend = [...buffer]
    buffer = []
    saveBuffer()

    try {
      await $fetch(`${apiBase}/heatmap`, {
        method: 'POST',
        headers: { ...getHeaders(), 'Content-Type': 'application/json' },
        body: toSend,
      })
    } catch {
      // Put back on failure
      buffer = [...toSend, ...buffer]
      saveBuffer()
    }
  }

  function start() {
    loadBuffer()

    document.addEventListener('click', recordEvent, { passive: true })
    document.addEventListener('touchstart', recordEvent, { passive: true })

    timer = setInterval(flush, FLUSH_INTERVAL)

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        flush()
      }
    })

    window.addEventListener('beforeunload', () => {
      flush()
    })
  }

  function stop() {
    document.removeEventListener('click', recordEvent)
    document.removeEventListener('touchstart', recordEvent)
    if (timer) {
      clearInterval(timer)
      timer = null
    }
  }

  onMounted(start)
  onUnmounted(stop)
}
