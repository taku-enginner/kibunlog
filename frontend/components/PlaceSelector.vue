<template>
  <div class="overlay" @click.self="$emit('close')">
    <div class="sheet">
      <div class="sheet-header">
        <span class="sheet-title">場所を選択</span>
        <button class="close-btn" @click="$emit('close')">✕</button>
      </div>

      <div class="mode-tabs">
        <button class="mode-tab" :class="{ active: mode === 'search' }" @click="mode = 'search'">
          検索
        </button>
        <button class="mode-tab" :class="{ active: mode === 'map' }" @click="switchToMap">
          マップで選ぶ
        </button>
      </div>

      <!-- 検索モード -->
      <template v-if="mode === 'search'">
        <button class="gps-btn" @click="useCurrentLocation" :disabled="gpsLoading">
          {{ gpsLoading ? '取得中...' : '📍 現在地を使う' }}
        </button>
        <p v-if="gpsError" class="gps-error">{{ gpsError }}</p>

        <div class="search-box">
          <input
            v-model="query"
            type="text"
            placeholder="場所を検索..."
            class="search-input"
            @input="onSearch"
          />
        </div>

        <div v-if="searching" class="hint">検索中...</div>
        <div v-if="searchResults.length > 0" class="results">
          <button
            v-for="(r, i) in searchResults"
            :key="i"
            class="result-item"
            @click="selectSearchResult(r)"
          >
            <span class="result-name">{{ r.name }}</span>
          </button>
        </div>

        <div v-if="places.length > 0" class="registered">
          <p class="section-label">登録済みの場所</p>
          <button
            v-for="place in places"
            :key="place.id"
            class="place-item"
            @click="$emit('select', place)"
          >
            {{ place.name }}
          </button>
        </div>
      </template>

      <!-- マップモード -->
      <template v-if="mode === 'map'">
        <button class="gps-btn" @click="moveToCurrentLocation" :disabled="gpsLoading">
          {{ gpsLoading ? '取得中...' : '📍 現在地に移動' }}
        </button>
        <p v-if="gpsError" class="gps-error">{{ gpsError }}</p>
        <p class="hint">タップして場所を選んでください</p>
        <div ref="mapContainer" class="pin-map"></div>
        <div v-if="pinnedLocation" class="pin-confirm">
          <p class="pin-name">{{ pinnedName || '読み込み中...' }}</p>
          <button class="pin-select-btn" :disabled="!pinnedName" @click="confirmPin">
            この場所を選択
          </button>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
interface Place {
  id: number
  name: string
  latitude: number | null
  longitude: number | null
}

const emit = defineEmits<{
  select: [place: Place]
  close: []
}>()

const config = useRuntimeConfig()
const apiBase = config.public.apiBase
const { getHeaders } = useAuth()
const { searching, results: searchResults, search, clear } = useNominatim()

const places = ref<Place[]>([])
const query = ref('')
const gpsLoading = ref(false)
const gpsError = ref('')
const mode = ref<'search' | 'map'>('search')

const mapContainer = ref<HTMLElement | null>(null)
const pinnedLocation = ref<{ lat: number; lng: number } | null>(null)
const pinnedName = ref('')
let mapInstance: any = null
let pinMarker: any = null
let leafletLib: any = null

onMounted(async () => {
  try {
    places.value = await $fetch<Place[]>(`${apiBase}/places`, {
      headers: getHeaders(),
    })
  } catch {}
})

function onSearch() {
  search(query.value)
}

async function selectSearchResult(r: { name: string; latitude: number; longitude: number }) {
  try {
    const place = await $fetch<Place>(`${apiBase}/places`, {
      method: 'POST',
      body: { name: r.name, latitude: r.latitude, longitude: r.longitude },
      headers: getHeaders(),
    })
    emit('select', place)
  } catch {}
}

async function switchToMap() {
  mode.value = 'map'
  await nextTick()
  if (!mapContainer.value || mapInstance) return

  const L = await import('leaflet')
  await import('leaflet/dist/leaflet.css')
  leafletLib = L

  const center: [number, number] = [35.68, 139.77] // 東京デフォルト
  mapInstance = L.map(mapContainer.value).setView(center, 13)

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OSM',
  }).addTo(mapInstance)

  // GPS で現在地に移動を試みる
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        mapInstance?.setView([pos.coords.latitude, pos.coords.longitude], 15)
      },
      () => {},
      { enableHighAccuracy: false, timeout: 5000 }
    )
  }

  mapInstance.on('click', (e: any) => placePin(e.latlng.lat, e.latlng.lng))
}

async function placePin(lat: number, lng: number) {
  pinnedLocation.value = { lat, lng }
  pinnedName.value = ''

  if (!leafletLib || !mapInstance) return

  if (pinMarker) {
    pinMarker.setLatLng([lat, lng])
  } else {
    pinMarker = leafletLib.circleMarker([lat, lng], {
      radius: 12,
      fillColor: '#007aff',
      color: '#fff',
      weight: 3,
      fillOpacity: 0.9,
    }).addTo(mapInstance)
  }

  try {
    const data = await $fetch<any>('https://nominatim.openstreetmap.org/reverse', {
      params: { lat, lon: lng, format: 'json', 'accept-language': 'ja' },
      headers: { 'User-Agent': 'kibunrogu-app' },
    })
    pinnedName.value = data.display_name || `${lat.toFixed(4)}, ${lng.toFixed(4)}`
  } catch {
    pinnedName.value = `${lat.toFixed(4)}, ${lng.toFixed(4)}`
  }
}

function moveToCurrentLocation() {
  gpsError.value = ''
  if (!navigator.geolocation) {
    gpsError.value = 'このブラウザは位置情報に対応していません'
    return
  }
  gpsLoading.value = true
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const { latitude, longitude } = pos.coords
      mapInstance?.setView([latitude, longitude], 16)
      placePin(latitude, longitude)
      gpsLoading.value = false
    },
    (err) => {
      gpsLoading.value = false
      if (err.code === 1) {
        gpsError.value = '位置情報が許可されていません'
      } else {
        gpsError.value = '位置情報を取得できませんでした'
      }
    },
    { enableHighAccuracy: true, timeout: 10000 }
  )
}

async function confirmPin() {
  if (!pinnedLocation.value || !pinnedName.value) return
  try {
    const place = await $fetch<Place>(`${apiBase}/places`, {
      method: 'POST',
      body: {
        name: pinnedName.value,
        latitude: pinnedLocation.value.lat,
        longitude: pinnedLocation.value.lng,
      },
      headers: getHeaders(),
    })
    emit('select', place)
  } catch {}
}

function useCurrentLocation() {
  gpsError.value = ''
  if (!navigator.geolocation) {
    gpsError.value = 'このブラウザは位置情報に対応していません'
    return
  }
  gpsLoading.value = true
  navigator.geolocation.getCurrentPosition(
    async (pos) => {
      try {
        const data = await $fetch<any>('https://nominatim.openstreetmap.org/reverse', {
          params: {
            lat: pos.coords.latitude,
            lon: pos.coords.longitude,
            format: 'json',
            'accept-language': 'ja',
          },
          headers: { 'User-Agent': 'kibunrogu-app' },
        })
        const name = data.display_name || `${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}`
        const place = await $fetch<Place>(`${apiBase}/places`, {
          method: 'POST',
          body: { name, latitude: pos.coords.latitude, longitude: pos.coords.longitude },
          headers: getHeaders(),
        })
        emit('select', place)
      } catch (e) {
        gpsError.value = '場所の登録に失敗しました'
      }
      gpsLoading.value = false
    },
    (err) => {
      gpsLoading.value = false
      if (err.code === 1) {
        gpsError.value = '位置情報が許可されていません。ブラウザの設定を確認してください'
      } else if (err.code === 2) {
        gpsError.value = '位置情報を取得できませんでした'
      } else {
        gpsError.value = '位置情報の取得がタイムアウトしました'
      }
    },
    { enableHighAccuracy: false, timeout: 10000 }
  )
}
</script>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  z-index: 200;
  display: flex;
  align-items: flex-end;
  justify-content: center;
}

.sheet {
  background: #fff;
  border-radius: 20px 20px 0 0;
  width: 100%;
  max-width: 480px;
  max-height: 85vh;
  overflow-y: auto;
  padding: 20px 16px;
  padding-bottom: max(20px, env(safe-area-inset-bottom));
}

.sheet-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.sheet-title {
  font-size: 18px;
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

.mode-tabs {
  display: flex;
  gap: 0;
  margin-bottom: 14px;
  border: 2px solid #e0e0e0;
  border-radius: 10px;
  overflow: hidden;
}

.mode-tab {
  flex: 1;
  padding: 10px;
  border: none;
  background: #fff;
  font-size: 14px;
  font-weight: 600;
  color: #6e6e73;
  cursor: pointer;
  transition: all 0.2s;
}

.mode-tab.active {
  background: #007aff;
  color: #fff;
}

.gps-btn {
  width: 100%;
  padding: 12px;
  background: #e8f5e9;
  border: none;
  border-radius: 12px;
  font-size: 15px;
  font-weight: 600;
  color: #1b5e20;
  cursor: pointer;
  margin-bottom: 12px;
}

.gps-btn:disabled {
  opacity: 0.5;
}

.gps-error {
  font-size: 13px;
  color: #d32f2f;
  margin-bottom: 8px;
}

.search-box {
  margin-bottom: 12px;
}

.search-input {
  width: 100%;
  padding: 12px 14px;
  border: 1px solid #d1d1d6;
  border-radius: 12px;
  font-size: 15px;
  outline: none;
  background: #fff;
}

.search-input:focus {
  border-color: #007aff;
}

.hint {
  text-align: center;
  color: #6e6e73;
  font-size: 14px;
  padding: 8px 0;
}

.results {
  margin-bottom: 12px;
}

.result-item {
  display: block;
  width: 100%;
  text-align: left;
  padding: 10px 12px;
  background: #f5f5f7;
  border: none;
  border-radius: 8px;
  font-size: 13px;
  color: #333;
  cursor: pointer;
  margin-bottom: 6px;
  line-height: 1.4;
}

.result-item:active {
  background: #e0e0e0;
}

.section-label {
  font-size: 13px;
  font-weight: 600;
  color: #6e6e73;
  margin-bottom: 8px;
}

.registered {
  margin-top: 8px;
}

.place-item {
  display: block;
  width: 100%;
  text-align: left;
  padding: 12px;
  background: #fff;
  border: 1px solid #e0e0e0;
  border-radius: 10px;
  font-size: 15px;
  cursor: pointer;
  margin-bottom: 6px;
}

.place-item:active {
  background: #f0f0f0;
}

.pin-map {
  width: 100%;
  height: 300px;
  border-radius: 12px;
  overflow: hidden;
  margin-bottom: 12px;
}

.pin-confirm {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.pin-name {
  font-size: 13px;
  color: #333;
  line-height: 1.4;
  text-align: center;
}

.pin-select-btn {
  width: 100%;
  padding: 14px;
  background: #007aff;
  color: #fff;
  border: none;
  border-radius: 12px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  min-height: 48px;
}

.pin-select-btn:disabled {
  opacity: 0.5;
}
</style>
