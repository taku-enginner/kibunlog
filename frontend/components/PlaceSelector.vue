<template>
  <div class="overlay" @click.self="$emit('close')">
    <div class="sheet">
      <div class="sheet-header">
        <span class="sheet-title">場所を選択</span>
        <button class="close-btn" @click="$emit('close')">✕</button>
      </div>

      <button class="gps-btn" @click="useCurrentLocation" :disabled="gpsLoading">
        {{ gpsLoading ? '取得中...' : '📍 現在地を使う' }}
      </button>

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

function useCurrentLocation() {
  if (!navigator.geolocation) return
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
      } catch {}
      gpsLoading.value = false
    },
    () => {
      gpsLoading.value = false
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
  max-height: 80vh;
  overflow-y: auto;
  padding: 20px 16px;
}

.sheet-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
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
</style>
