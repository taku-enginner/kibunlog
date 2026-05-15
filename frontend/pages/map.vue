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

    <!-- 詳細ボトムシート -->
    <Teleport to="body">
      <div v-if="showDetail" class="overlay" @click.self="showDetail = false">
        <div class="detail-sheet">
          <div class="sheet-header">
            <span class="sheet-title">この付近の記録（{{ nearbyMoods.length }}件）</span>
            <button class="close-btn" @click="showDetail = false">✕</button>
          </div>
          <div v-if="nearbyMoods.length === 0" class="detail-empty">付近に記録がありません</div>
          <div v-else class="detail-list">
            <div v-for="m in nearbyMoods" :key="m.id" class="detail-item">
              <div class="detail-header">
                <span class="detail-place">{{ m.place_name || '場所なし' }}</span>
                <span class="detail-mood" :style="{ color: moodColors[m.level] }">
                  {{ moodLabels[m.level] }}
                </span>
              </div>
              <div class="detail-meta">
                {{ m.date }}<span v-if="m.time"> {{ m.time }}</span>
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
const showDetail = ref(false)
const nearbyMoods = ref<Mood[]>([])
let mapInstance: google.maps.Map | null = null

function setZoom(level: number) {
  currentZoom.value = level
  if (mapInstance) mapInstance.setZoom(level)
}

// ズームレベルに応じた検索半径(メートル)
function getSearchRadius(zoom: number): number {
  if (zoom >= 16) return 100
  if (zoom >= 13) return 500
  if (zoom >= 11) return 2000
  if (zoom >= 8) return 10000
  return 50000
}

// 2点間の距離(メートル) - Haversine
function distanceM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function onMapClick(e: google.maps.MapMouseEvent) {
  if (!e.latLng) return
  const lat = e.latLng.lat()
  const lng = e.latLng.lng()
  const zoom = mapInstance?.getZoom() || 13
  const radius = getSearchRadius(zoom)

  const nearby = moods.value.filter((m) => {
    if (m.latitude == null || m.longitude == null) return false
    return distanceM(lat, lng, m.latitude, m.longitude) <= radius
  })

  if (nearby.length === 0) return

  // 新しい順にソート
  nearbyMoods.value = nearby.sort((a, b) => {
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

  mapInstance.addListener('click', onMapClick)

  // ヒートマップ
  const { HeatmapLayer } = await google.maps.importLibrary('visualization') as google.maps.VisualizationLibrary
  const heatmapData = moods.value
    .filter((m) => m.latitude != null && m.longitude != null)
    .map((m) => ({
      location: new google.maps.LatLng(m.latitude!, m.longitude!),
      weight: m.level, // 気分スコアをweightに
    }))

  new HeatmapLayer({
    data: heatmapData,
    map: mapInstance,
    radius: 40,
    opacity: 0.7,
    gradient: [
      'rgba(0, 0, 0, 0)',
      'rgba(73, 18, 23, 0.6)',   // 1: しんどい
      'rgba(220, 53, 69, 0.6)',  // 2: いまいち
      'rgba(255, 193, 7, 0.6)',  // 3: 普通
      'rgba(40, 167, 69, 0.6)',  // 4: 良い
      'rgba(27, 94, 32, 0.8)',   // 5: 最高
    ],
  })
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
  align-items: center;
  margin-bottom: 14px;
}

.sheet-title {
  font-size: 16px;
  font-weight: 700;
}

.close-btn {
  background: none;
  border: none;
  font-size: 18px;
  color: #6e6e73;
  cursor: pointer;
  padding: 8px;
}

.detail-empty {
  text-align: center;
  color: #6e6e73;
  padding: 20px 0;
}

.detail-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
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

.detail-place {
  font-size: 15px;
  font-weight: 600;
  color: #333;
}

.detail-mood {
  font-size: 14px;
  font-weight: 700;
}

.detail-meta {
  font-size: 12px;
  color: #6e6e73;
  margin-bottom: 4px;
}

.detail-memo {
  font-size: 13px;
  color: #555;
  white-space: pre-wrap;
  line-height: 1.5;
}
</style>
