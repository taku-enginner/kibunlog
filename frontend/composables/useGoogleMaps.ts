import { APILoader } from '@googlemaps/js-api-loader'

let loaded = false

export function useGoogleMaps() {
  const config = useRuntimeConfig()

  async function load(): Promise<void> {
    if (loaded) return
    if (typeof google !== 'undefined' && google.maps) {
      loaded = true
      return
    }

    const script = document.createElement('script')
    script.src = `https://maps.googleapis.com/maps/api/js?key=${config.public.googleMapsApiKey}&libraries=places,marker,visualization&language=ja&region=JP&loading=async`
    script.async = true
    script.defer = true

    await new Promise<void>((resolve, reject) => {
      script.onload = () => {
        loaded = true
        resolve()
      }
      script.onerror = reject
      document.head.appendChild(script)
    })
  }

  return { load }
}
