<template>
  <div class="record-page">
    <h1 class="page-title">きぶんログ</h1>
    <p class="today-date" :style="{ color: todayColor }">{{ todayLabel }}</p>

    <div v-if="loading" class="loading">読み込み中...</div>
    <template v-else>
      <div v-if="todayMoods.length > 0" class="mood-cards">
        <div
          v-for="mood in todayMoods"
          :key="mood.id"
          class="mood-card"
          :style="{ borderLeftColor: moodConfig[mood.level]?.bg }"
          @click="startEdit(mood)"
        >
          <div class="card-header">
            <span class="card-place">{{ mood.place_name || '場所なし' }}</span>
            <span class="card-mood" :style="{ color: moodConfig[mood.level]?.color }">
              {{ moodConfig[mood.level]?.emoji }} {{ moodConfig[mood.level]?.label }}
            </span>
          </div>
          <p v-if="mood.memo" class="card-memo">{{ mood.memo }}</p>
        </div>
      </div>
      <p v-else class="empty-hint">まだ記録がありません</p>

      <button class="add-btn" @click="startAdd">＋ 記録を追加</button>
    </template>

    <Teleport to="body">
      <PlaceSelector
        v-if="showPlaceSelector"
        @select="onPlaceSelected"
        @close="showPlaceSelector = false"
      />
    </Teleport>

    <Teleport to="body">
      <MoodForm
        v-if="showMoodForm"
        :place-name="selectedPlace?.name"
        :initial-level="editingMood?.level"
        :initial-memo="editingMood?.memo"
        :saving="saving"
        @submit="onMoodSubmit"
        @close="cancelForm"
      />
    </Teleport>
  </div>
</template>

<script setup lang="ts">
interface Mood {
  id: number
  date: string
  level: number
  memo?: string | null
  place_id?: number | null
  place_name?: string | null
}

interface Place {
  id: number
  name: string
  latitude: number | null
  longitude: number | null
}

const config = useRuntimeConfig()
const apiBase = config.public.apiBase
const { getHeaders } = useAuth()
const { formatWithDay, getDateColor } = useDate()

const moodConfig: Record<number, { emoji: string; label: string; bg: string; color: string }> = {
  5: { emoji: '😆', label: '最高', bg: '#c8e6c9', color: '#1b5e20' },
  4: { emoji: '😊', label: '良い', bg: '#d4edda', color: '#155724' },
  3: { emoji: '😐', label: '普通', bg: '#fff3cd', color: '#856404' },
  2: { emoji: '😣', label: 'いまいち', bg: '#f8d7da', color: '#721c24' },
  1: { emoji: '😵', label: 'しんどい', bg: '#f5c6cb', color: '#491217' },
}

const today = new Date()
const todayStr = today.toISOString().slice(0, 10)
const todayLabel = formatWithDay(today)
const todayColor = getDateColor(today)

const todayMoods = ref<Mood[]>([])
const loading = ref(true)
const saving = ref(false)

const showPlaceSelector = ref(false)
const showMoodForm = ref(false)
const selectedPlace = ref<Place | null>(null)
const editingMood = ref<Mood | null>(null)

onMounted(async () => {
  try {
    const result = await $fetch<Mood[]>(`${apiBase}/moods`, {
      params: { from_date: todayStr, to_date: todayStr },
      headers: getHeaders(),
    })
    todayMoods.value = result
  } catch {}
  loading.value = false
})

function startAdd() {
  editingMood.value = null
  selectedPlace.value = null
  showPlaceSelector.value = true
}

function onPlaceSelected(place: Place) {
  selectedPlace.value = place
  showPlaceSelector.value = false
  showMoodForm.value = true
}

function startEdit(mood: Mood) {
  editingMood.value = mood
  selectedPlace.value = mood.place_id
    ? { id: mood.place_id, name: mood.place_name || '', latitude: null, longitude: null }
    : null
  showMoodForm.value = true
}

function cancelForm() {
  showMoodForm.value = false
  editingMood.value = null
  selectedPlace.value = null
}

async function onMoodSubmit(data: { level: number; memo: string | null }) {
  saving.value = true
  try {
    if (editingMood.value) {
      const updated = await $fetch<Mood>(`${apiBase}/moods/${editingMood.value.id}`, {
        method: 'PUT',
        body: {
          date: editingMood.value.date,
          level: data.level,
          memo: data.memo,
          place_id: editingMood.value.place_id,
        },
        headers: getHeaders(),
      })
      const idx = todayMoods.value.findIndex((m) => m.id === editingMood.value!.id)
      if (idx >= 0) todayMoods.value[idx] = updated
    } else {
      const created = await $fetch<Mood>(`${apiBase}/moods`, {
        method: 'POST',
        body: {
          date: todayStr,
          level: data.level,
          memo: data.memo,
          place_id: selectedPlace.value?.id ?? null,
        },
        headers: getHeaders(),
      })
      todayMoods.value.push(created)
    }
    cancelForm()
  } catch {}
  saving.value = false
}
</script>

<style scoped>
.record-page {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding-top: 8px;
}

.page-title {
  font-size: 24px;
  font-weight: 700;
  text-align: center;
  margin-bottom: 4px;
}

.today-date {
  font-size: 15px;
  text-align: center;
  margin-bottom: 20px;
  font-weight: 500;
}

.loading {
  text-align: center;
  padding: 40px 0;
  color: #6e6e73;
}

.empty-hint {
  text-align: center;
  color: #6e6e73;
  font-size: 15px;
  padding: 32px 0;
}

.mood-cards {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 16px;
}

.mood-card {
  background: #fff;
  border-radius: 14px;
  padding: 14px;
  border-left: 5px solid transparent;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  cursor: pointer;
  transition: transform 0.15s;
}

.mood-card:active {
  transform: scale(0.98);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
}

.card-place {
  font-size: 15px;
  font-weight: 600;
  color: #333;
}

.card-mood {
  font-size: 14px;
  font-weight: 700;
}

.card-memo {
  font-size: 14px;
  color: #6e6e73;
  white-space: pre-wrap;
  line-height: 1.5;
}

.add-btn {
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

.add-btn:active {
  background: #005ec4;
}
</style>
