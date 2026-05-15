<template>
  <div class="map-page">
    <h1 class="page-title">きぶんマップ</h1>
    <div v-if="!loading && moods.length > 0" class="zoom-selector">
      <button
        v-for="opt in zoomOptions"
        :key="opt.level"
        class="zoom-btn"
        :class="{ active: currentZoom === opt.level }"
        @click="setZoom(opt.level)"
      >
        {{ opt.label }}
      </button>
    </div>
    <div v-if="loading" class="loading">読み込み中...</div>
    <div v-else-if="moods.length === 0" class="empty">位置情報付きの記録がありません</div>
    <div v-else id="mood-map" ref="mapContainer" class="map-container"></div>
  </div>
</template>

<script setup lang="ts">
interface Mood {
  id: number
  date: string
  level: number
  memo?: string | null
  place_name?: string | null
  latitude?: number | null
  longitude?: number | null
}

const moodColors: Record<number, string> = {
  5: '#1b5e20',
  4: '#28a745',
  3: '#ffc107',
  2: '#dc3545',
  1: '#491217',
}

const moodLabels: Record<number, string> = {
  5: '😆 最高',
  4: '😊 良い',
  3: '😐 普通',
  2: '😣 いまいち',
  1: '😵 しんどい',
}

const config = useRuntimeConfig()
const apiBase = config.public.apiBase
const { getHeaders } = useAuth()
const { load: loadGoogleMaps } = useGoogleMaps()

const zoomOptions = [
  { level: 5, label: '広域' },
  { level: 8, label: '市区' },
  { level: 11, label: '町' },
  { level: 13, label: '周辺' },
  { level: 16, label: '詳細' },
]

const moods = ref<Mood[]>([])
const loading = ref(true)
const mapContainer = ref<HTMLElement | null>(null)
const currentZoom = ref(13)
let mapInstance: google.maps.Map | null = null

function setZoom(level: number) {
  currentZoom.value = level
  if (mapInstance) mapInstance.setZoom(level)
}

onMounted(async () => {
  try {
    const result = await $fetch<Mood[]>(`${apiBase}/moods/with-location`, {
      headers: getHeaders(),
    })
    moods.value = result
  } catch {
    // ignore
  } finally {
    loading.value = false
  }

  await nextTick()
  if (moods.value.length === 0 || !mapContainer.value) return

  await loadGoogleMaps()

  const first = moods.value[0]
  mapInstance = new google.maps.Map(mapContainer.value, {
    center: { lat: first.latitude!, lng: first.longitude! },
    zoom: currentZoom.value,
    mapId: 'kibunrogu-mood-map',
    disableDefaultUI: true,
    zoomControl: true,
  })

  mapInstance.addListener('zoom_changed', () => {
    if (mapInstance) currentZoom.value = mapInstance.getZoom() || 13
  })

  for (const mood of moods.value) {
    if (mood.latitude == null || mood.longitude == null) continue

    const pin = document.createElement('div')
    pin.style.width = '20px'
    pin.style.height = '20px'
    pin.style.borderRadius = '50%'
    pin.style.backgroundColor = moodColors[mood.level] || '#999'
    pin.style.border = '2px solid #fff'
    pin.style.boxShadow = '0 2px 4px rgba(0,0,0,0.3)'

    const { AdvancedMarkerElement } = await google.maps.importLibrary('marker') as google.maps.MarkerLibrary
    const marker = new AdvancedMarkerElement({
      map: mapInstance,
      position: { lat: mood.latitude, lng: mood.longitude },
      content: pin,
    })

    const infoWindow = new google.maps.InfoWindow({
      content: `<b>${mood.place_name || mood.date}</b><br>${mood.date}<br>${moodLabels[mood.level] || ''}<br>${mood.memo || ''}`,
    })

    marker.addListener('click', () => {
      infoWindow.open({ anchor: marker, map: mapInstance })
    })
  }
})
</script>

<style scoped>
.map-page {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.page-title {
  font-size: 20px;
  font-weight: 700;
  text-align: center;
  margin-bottom: 8px;
  flex-shrink: 0;
}

.zoom-selector {
  display: flex;
  gap: 6px;
  justify-content: center;
  margin-bottom: 10px;
  flex-shrink: 0;
}

.zoom-btn {
  padding: 6px 12px;
  border: 2px solid #e0e0e0;
  border-radius: 20px;
  background: #fff;
  font-size: 12px;
  font-weight: 500;
  color: #6e6e73;
  cursor: pointer;
  transition: all 0.2s;
}

.zoom-btn.active {
  background: #007aff;
  color: #fff;
  border-color: #007aff;
}

.loading,
.empty {
  text-align: center;
  padding: 40px 0;
  color: #6e6e73;
  font-size: 15px;
}

.map-container {
  flex: 1;
  min-height: 0;
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
}
</style>
