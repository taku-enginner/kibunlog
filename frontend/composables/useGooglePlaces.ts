interface PlaceResult {
  name: string
  address: string
  latitude: number
  longitude: number
}

export function useGooglePlaces() {
  const searching = ref(false)
  const results = ref<PlaceResult[]>([])
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
        const { Place } = await google.maps.importLibrary('places') as google.maps.PlacesLibrary
        const request = {
          textQuery: query,
          fields: ['displayName', 'formattedAddress', 'location'],
          language: 'ja',
          region: 'jp',
          maxResultCount: 5,
        }
        const { places } = await Place.searchByText(request)
        results.value = (places || []).map((p: google.maps.places.Place) => ({
          name: p.displayName || '',
          address: p.formattedAddress || '',
          latitude: p.location?.lat() || 0,
          longitude: p.location?.lng() || 0,
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
