interface NominatimResult {
  name: string
  latitude: number
  longitude: number
}

export function useNominatim() {
  const searching = ref(false)
  const results = ref<NominatimResult[]>([])

  let timer: ReturnType<typeof setTimeout> | null = null

  function search(query: string) {
    if (timer) clearTimeout(timer)
    if (!query.trim()) {
      results.value = []
      return
    }
    timer = setTimeout(async () => {
      searching.value = true
      try {
        const data = await $fetch<any[]>('https://nominatim.openstreetmap.org/search', {
          params: { q: query, format: 'json', limit: 5, 'accept-language': 'ja' },
          headers: { 'User-Agent': 'kibunrogu-app' },
        })
        results.value = data.map((r) => ({
          name: r.display_name,
          latitude: parseFloat(r.lat),
          longitude: parseFloat(r.lon),
        }))
      } catch {
        results.value = []
      } finally {
        searching.value = false
      }
    }, 400)
  }

  function clear() {
    results.value = []
  }

  return { searching, results, search, clear }
}
