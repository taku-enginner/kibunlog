<template>
  <div class="map-page">
    <h1 class="page-title">きぶんマップ</h1>
<div v-if="loading" class="loading">読み込み中...</div>
    <div v-else-if="moods.length === 0" class="empty">位置情報付きの記録がありません</div>
    <div v-else class="map-wrapper">
      <div id="mood-map" ref="mapContainer" class="map-container"></div>
      <button class="gps-btn" @click="moveToCurrentLocation" :disabled="gpsLoading">
        <svg v-if="!gpsLoading" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/></svg>
        <span v-else>...</span>
      </button>
    </div>

    <!-- 詳細ボトムシート -->
    <Teleport to="body">
      <div v-if="showDetail" class="overlay" @click.self="showDetail = false">
        <div class="detail-sheet">
          <div class="sheet-header">
            <div>
              <span class="sheet-title">{{ detailPlaceName }}</span>
              <span class="sheet-avg" :style="{ color: moodColors[Math.round(detailAvg)] }">
                平均 {{ detailAvg.toFixed(1) }}
              </span>
            </div>
            <button class="close-btn" @click="showDetail = false">✕</button>
          </div>
          <div class="detail-list">
            <div v-for="m in detailMoods" :key="m.id" class="detail-item">
              <div class="detail-header">
                <span class="detail-date">
                  {{ m.date }}<span v-if="m.time"> {{ m.time }}</span>
                </span>
                <span class="detail-mood" :style="{ color: moodColors[m.level] }">
                  {{ moodLabels[m.level] }}
                </span>
              </div>
              <p v-if="m.memo" class="detail-memo">{{ m.memo }}</p>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
interface Mood {
  id: number
  date: string
  time?: string | null
  level: number
  memo?: string | null
  place_name?: string | null
  place_id?: number | null
  latitude?: number | null
  longitude?: number | null
}

interface PlaceGroup {
  placeId: number
  placeName: string
  lat: number
  lng: number
  avgLevel: number
  count: number
  moods: Mood[]
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

function avgColor(avg: number): string {
  if (avg >= 4.5) return '#1b5e20'
  if (avg >= 3.5) return '#28a745'
  if (avg >= 2.5) return '#ffc107'
  if (avg >= 1.5) return '#dc3545'
  return '#491217'
}

const config = useRuntimeConfig()
const apiBase = config.public.apiBase
const { getHeaders } = useAuth()
const { load: loadGoogleMaps } = useGoogleMaps()


const moods = ref<Mood[]>([])
const loading = ref(true)
const mapContainer = ref<HTMLElement | null>(null)
const currentZoom = ref(13)
const showDetail = ref(false)
const detailPlaceName = ref('')
const detailAvg = ref(0)
const detailMoods = ref<Mood[]>([])
let mapInstance: google.maps.Map | null = null
const gpsLoading = ref(false)

function moveToCurrentLocation() {
  if (!navigator.geolocation || !mapInstance) return
  gpsLoading.value = true
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      mapInstance?.setCenter({ lat: pos.coords.latitude, lng: pos.coords.longitude })
      mapInstance?.setZoom(15)
      gpsLoading.value = false
    },
    () => {
      gpsLoading.value = false
    },
    { enableHighAccuracy: true, timeout: 10000 }
  )
}

function groupByPlace(moodList: Mood[]): PlaceGroup[] {
  const map = new Map<number, PlaceGroup>()
  for (const m of moodList) {
    if (m.place_id == null || m.latitude == null || m.longitude == null) continue
    let group = map.get(m.place_id)
    if (!group) {
      group = {
        placeId: m.place_id,
        placeName: m.place_name || '場所なし',
        lat: m.latitude,
        lng: m.longitude,
        avgLevel: 0,
        count: 0,
        moods: [],
      }
      map.set(m.place_id, group)
    }
    group.moods.push(m)
    group.count++
  }
  for (const g of map.values()) {
    g.avgLevel = g.moods.reduce((s, m) => s + m.level, 0) / g.count
  }
  return Array.from(map.values())
}

function openDetail(group: PlaceGroup) {
  detailPlaceName.value = group.placeName
  detailAvg.value = group.avgLevel
  detailMoods.value = [...group.moods].sort((a, b) => {
    const da = `${a.date} ${a.time || ''}`.trim()
    const db = `${b.date} ${b.time || ''}`.trim()
    return db.localeCompare(da)
  })
  showDetail.value = true
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

  const groups = groupByPlace(moods.value)
  const first = groups[0]

  mapInstance = new google.maps.Map(mapContainer.value, {
    center: { lat: first.lat, lng: first.lng },
    zoom: currentZoom.value,
    mapId: 'kibunrogu-mood-map',
    disableDefaultUI: true,
    zoomControl: false,
  })

  mapInstance.addListener('zoom_changed', () => {
    if (mapInstance) currentZoom.value = mapInstance.getZoom() || 13
  })

  const { AdvancedMarkerElement } = await google.maps.importLibrary('marker') as google.maps.MarkerLibrary

  for (const group of groups) {
    const color = avgColor(group.avgLevel)
    const size = Math.min(20 + group.count * 4, 48)

    const el = document.createElement('div')
    el.style.display = 'flex'
    el.style.flexDirection = 'column'
    el.style.alignItems = 'center'
    el.style.cursor = 'pointer'

    const dot = document.createElement('div')
    dot.style.width = `${size}px`
    dot.style.height = `${size}px`
    dot.style.borderRadius = '50%'
    dot.style.backgroundColor = color
    dot.style.border = '3px solid #fff'
    dot.style.boxShadow = '0 2px 6px rgba(0,0,0,0.3)'
    dot.style.display = 'flex'
    dot.style.alignItems = 'center'
    dot.style.justifyContent = 'center'
    dot.style.color = '#fff'
    dot.style.fontSize = '12px'
    dot.style.fontWeight = '700'
    dot.textContent = group.avgLevel.toFixed(1)

    const label = document.createElement('div')
    label.style.marginTop = '2px'
    label.style.fontSize = '11px'
    label.style.fontWeight = '600'
    label.style.color = '#333'
    label.style.background = 'rgba(255,255,255,0.9)'
    label.style.padding = '1px 6px'
    label.style.borderRadius = '4px'
    label.style.whiteSpace = 'nowrap'
    label.style.maxWidth = '120px'
    label.style.overflow = 'hidden'
    label.style.textOverflow = 'ellipsis'
    label.textContent = group.placeName

    el.appendChild(dot)
    el.appendChild(label)

    const marker = new AdvancedMarkerElement({
      map: mapInstance,
      position: { lat: group.lat, lng: group.lng },
      content: el,
    })

    marker.addListener('click', () => openDetail(group))
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

.loading,
.empty {
  text-align: center;
  padding: 40px 0;
  color: #6e6e73;
  font-size: 15px;
}

.map-wrapper {
  flex: 1;
  min-height: 0;
  position: relative;
}

.map-container {
  width: 100%;
  height: 100%;
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
}

.gps-btn {
  position: absolute;
  bottom: 16px;
  right: 16px;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: #fff;
  border: none;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  color: #333;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10;
}

.gps-btn:active {
  background: #f0f0f0;
}

.gps-btn:disabled {
  opacity: 0.5;
}

/* ボトムシート */
.overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  z-index: 200;
  display: flex;
  align-items: flex-end;
  justify-content: center;
}

.detail-sheet {
  background: #fff;
  border-radius: 20px 20px 0 0;
  width: 100%;
  max-width: 480px;
  max-height: 60vh;
  overflow-y: auto;
  padding: 20px 16px;
  padding-bottom: max(20px, env(safe-area-inset-bottom));
}

.sheet-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 14px;
}

.sheet-title {
  font-size: 17px;
  font-weight: 700;
  display: block;
}

.sheet-avg {
  font-size: 13px;
  font-weight: 600;
}

.close-btn {
  background: none;
  border: none;
  font-size: 18px;
  color: #6e6e73;
  cursor: pointer;
  padding: 8px;
}

.detail-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.detail-item {
  background: #f5f5f7;
  border-radius: 12px;
  padding: 12px;
}

.detail-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
}

.detail-date {
  font-size: 13px;
  color: #6e6e73;
}

.detail-mood {
  font-size: 14px;
  font-weight: 700;
}

.detail-memo {
  font-size: 13px;
  color: #555;
  white-space: pre-wrap;
  line-height: 1.5;
}
</style>
