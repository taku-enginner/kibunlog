<template>
  <div class="timeline-page">
    <!-- タブ切替 -->
    <div class="tab-row">
      <button class="tab-btn" :class="{ active: activeTab === 'today' }" @click="activeTab = 'today'">
        今日
      </button>
      <button class="tab-btn" :class="{ active: activeTab === 'history' }" @click="activeTab = 'history'">
        履歴
      </button>
    </div>

    <!-- 今日タブ -->
    <template v-if="activeTab === 'today'">
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
              <span class="card-place">
                <span v-if="mood.time" class="card-time">{{ mood.time }}</span>
                {{ mood.place_name || '場所なし' }}
              </span>
              <span class="card-mood" :style="{ color: moodConfig[mood.level]?.color }">
                {{ moodConfig[mood.level]?.emoji }} {{ moodConfig[mood.level]?.label }}
              </span>
            </div>
            <p v-if="mood.memo" class="card-memo">{{ mood.memo }}</p>
          </div>
        </div>
        <p v-else class="empty">まだ記録がありません</p>

        <button class="delete-area" v-if="todayMoods.length > 0" @click="toggleDeleteMode">
          {{ deleteMode ? '完了' : '記録を削除' }}
        </button>
        <div v-if="deleteMode" class="delete-list">
          <div v-for="mood in todayMoods" :key="mood.id" class="delete-item">
            <span class="delete-label">
              {{ mood.time || '' }} {{ mood.place_name || '場所なし' }} — {{ moodConfig[mood.level]?.label }}
            </span>
            <button class="delete-btn" @click="deleteMood(mood.id)">削除</button>
          </div>
        </div>
      </template>
    </template>

    <!-- 履歴タブ -->
    <template v-if="activeTab === 'history'">
      <div class="filter-row">
        <button
          class="filter-btn"
          :class="{ active: filterLevel === null }"
          @click="filterLevel = null"
        >
          すべて
        </button>
        <button
          v-for="opt in moodOptions"
          :key="opt.level"
          class="filter-btn filter-emoji"
          :class="{ active: filterLevel === opt.level }"
          :style="filterLevel === opt.level ? { background: opt.bg, color: opt.color, borderColor: opt.bg } : {}"
          @click="filterLevel = opt.level"
        >
          {{ opt.emoji }}
        </button>
      </div>

      <div v-if="loading" class="loading">読み込み中...</div>
      <div v-else-if="filteredMoods.length === 0" class="empty">記録がありません</div>
      <div v-else class="timeline">
        <div
          v-for="mood in filteredMoods"
          :key="mood.id"
          class="timeline-item"
          :style="{ borderLeftColor: moodConfig[mood.level]?.bg }"
        >
          <div class="timeline-dot" :style="{ background: moodConfig[mood.level]?.bg }">
            <span class="dot-emoji">{{ moodConfig[mood.level]?.emoji }}</span>
          </div>
          <div class="timeline-content">
            <div class="timeline-header">
              <span class="timeline-date" :style="{ color: getDateColor(new Date(mood.date + 'T00:00:00')) }">
                {{ formatDate(mood.date) }}
              </span>
              <span class="timeline-level" :style="{ color: moodConfig[mood.level]?.color }">
                {{ moodConfig[mood.level]?.label }}
              </span>
            </div>
            <p v-if="mood.place_name" class="timeline-place">{{ mood.place_name }}</p>
            <p v-if="mood.memo" class="timeline-memo">{{ mood.memo }}</p>
            <p v-else class="timeline-no-memo">メモなし</p>
          </div>
        </div>
      </div>
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
        :initial-level="pendingLevel ?? editingMood?.level"
        :initial-memo="pendingMemo ?? editingMood?.memo"
        :saving="saving"
        @submit="onMoodSubmit"
        @close="cancelForm"
        @change-place="onChangePlace"
      />
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
const { getDayName, getDateColor, formatWithDay, toLocalDateStr } = useDate()

const moodConfig: Record<number, { emoji: string; label: string; bg: string; color: string }> = {
  5: { emoji: '😆', label: '最高', bg: '#c8e6c9', color: '#1b5e20' },
  4: { emoji: '😊', label: '良い', bg: '#d4edda', color: '#155724' },
  3: { emoji: '😐', label: '普通', bg: '#fff3cd', color: '#856404' },
  2: { emoji: '😣', label: 'いまいち', bg: '#f8d7da', color: '#721c24' },
  1: { emoji: '😵', label: 'しんどい', bg: '#f5c6cb', color: '#491217' },
}

const moodOptions = [
  { level: 5, ...moodConfig[5] },
  { level: 4, ...moodConfig[4] },
  { level: 3, ...moodConfig[3] },
  { level: 2, ...moodConfig[2] },
  { level: 1, ...moodConfig[1] },
]

const today = new Date()
const todayStr = toLocalDateStr(today)
const todayLabel = formatWithDay(today)
const todayColor = getDateColor(today)

const activeTab = ref<'today' | 'history'>('today')
const allMoods = ref<Mood[]>([])
const loading = ref(true)
const saving = ref(false)
const filterLevel = ref<number | null>(null)
const deleteMode = ref(false)

// Edit state
const showPlaceSelector = ref(false)
const showMoodForm = ref(false)
const selectedPlace = ref<Place | null>(null)
const editingMood = ref<Mood | null>(null)
const pendingLevel = ref<number | null>(null)
const pendingMemo = ref<string | null>(null)

const todayMoods = computed(() => allMoods.value.filter((m) => m.date === todayStr))

const historyMoods = computed(() =>
  allMoods.value.slice().sort((a, b) => {
    if (a.date !== b.date) return b.date.localeCompare(a.date)
    return (b.time || '').localeCompare(a.time || '')
  })
)

const filteredMoods = computed(() => {
  if (filterLevel.value === null) return historyMoods.value
  return historyMoods.value.filter((m) => m.level === filterLevel.value)
})

onMounted(async () => {
  try {
    const result = await $fetch<Mood[]>(`${apiBase}/moods`, {
      headers: getHeaders(),
    })
    allMoods.value = result
  } catch {}
  loading.value = false
})

// --- Today tab: edit/delete ---
function startEdit(mood: Mood) {
  if (deleteMode.value) return
  editingMood.value = mood
  selectedPlace.value = mood.place_id
    ? { id: mood.place_id, name: mood.place_name || '', latitude: null, longitude: null }
    : null
  showMoodForm.value = true
}

function onPlaceSelected(place: Place) {
  selectedPlace.value = place
  showPlaceSelector.value = false
  if (editingMood.value) {
    editingMood.value = { ...editingMood.value, place_id: place.id, place_name: place.name }
  }
  showMoodForm.value = true
}

function cancelForm() {
  showMoodForm.value = false
  editingMood.value = null
  selectedPlace.value = null
  pendingLevel.value = null
  pendingMemo.value = null
}

function onChangePlace(data: { level: number | null; memo: string | null }) {
  pendingLevel.value = data.level
  pendingMemo.value = data.memo
  showMoodForm.value = false
  showPlaceSelector.value = true
}

async function onMoodSubmit(data: { level: number; memo: string | null }) {
  saving.value = true
  try {
    if (editingMood.value) {
      const updated = await $fetch<Mood>(`${apiBase}/moods/${editingMood.value.id}`, {
        method: 'PUT',
        body: {
          date: editingMood.value.date,
          time: editingMood.value.time,
          level: data.level,
          memo: data.memo,
          place_id: selectedPlace.value?.id ?? editingMood.value.place_id,
        },
        headers: getHeaders(),
      })
      const idx = allMoods.value.findIndex((m) => m.id === editingMood.value!.id)
      if (idx >= 0) allMoods.value[idx] = updated
    }
    cancelForm()
  } catch {}
  saving.value = false
}

function toggleDeleteMode() {
  deleteMode.value = !deleteMode.value
}

async function deleteMood(id: number) {
  try {
    await $fetch(`${apiBase}/moods/${id}`, {
      method: 'DELETE',
      headers: getHeaders(),
    })
    allMoods.value = allMoods.value.filter((m) => m.id !== id)
  } catch {}
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  const y = d.getFullYear()
  const m = d.getMonth() + 1
  const day = d.getDate()
  const dayName = getDayName(d)
  return `${y}/${m}/${day}（${dayName}）`
}
</script>

<style scoped>
.timeline-page {
  display: flex;
  flex-direction: column;
  height: 100%;
}

/* タブ */
.tab-row {
  display: flex;
  gap: 0;
  margin-bottom: 12px;
  background: #e9e9ea;
  border-radius: 10px;
  padding: 2px;
}

.tab-btn {
  flex: 1;
  padding: 8px 0;
  border: none;
  border-radius: 8px;
  background: transparent;
  font-size: 14px;
  font-weight: 600;
  color: #6e6e73;
  cursor: pointer;
  transition: all 0.2s;
}

.tab-btn.active {
  background: #fff;
  color: #1d1d1f;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

/* 今日タブ */
.today-date {
  font-size: 15px;
  text-align: center;
  margin-bottom: 12px;
  font-weight: 500;
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

.card-time {
  font-size: 13px;
  font-weight: 500;
  color: #6e6e73;
  margin-right: 4px;
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

.delete-area {
  background: none;
  border: none;
  color: #d32f2f;
  font-size: 13px;
  cursor: pointer;
  padding: 8px;
  text-align: center;
}

.delete-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 8px;
}

.delete-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 12px;
  background: #fff5f5;
  border-radius: 10px;
}

.delete-label {
  font-size: 13px;
  color: #333;
}

.delete-btn {
  background: #d32f2f;
  color: #fff;
  border: none;
  border-radius: 8px;
  padding: 6px 12px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}

/* 履歴タブ */
.filter-row {
  display: flex;
  gap: 8px;
  justify-content: center;
  margin-bottom: 14px;
}

.filter-btn {
  padding: 6px 14px;
  border: 2px solid #e0e0e0;
  border-radius: 20px;
  background: #fff;
  font-size: 13px;
  font-weight: 500;
  color: #6e6e73;
  cursor: pointer;
  transition: all 0.2s;
  min-height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.filter-emoji {
  font-size: 20px;
  min-width: 40px;
  padding: 6px 8px;
}

.filter-btn.active {
  background: #007aff;
  color: #fff;
  border-color: #007aff;
}

.filter-btn:active {
  transform: scale(0.95);
}

.loading,
.empty {
  text-align: center;
  padding: 40px 0;
  color: #6e6e73;
  font-size: 15px;
}

.timeline {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.timeline-item {
  display: flex;
  gap: 12px;
  padding: 12px 0;
  border-bottom: 1px solid #f0f0f0;
  border-left: 4px solid transparent;
  padding-left: 10px;
}

.timeline-item:last-child {
  border-bottom: none;
}

.timeline-dot {
  flex-shrink: 0;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.08);
}

.dot-emoji {
  font-size: 20px;
}

.timeline-content {
  flex: 1;
  min-width: 0;
}

.timeline-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
}

.timeline-date {
  font-size: 15px;
  font-weight: 600;
}

.timeline-level {
  font-size: 14px;
  font-weight: 700;
}

.timeline-memo {
  font-size: 15px;
  color: #333;
  white-space: pre-wrap;
  line-height: 1.6;
}

.timeline-place {
  font-size: 13px;
  color: #007aff;
  font-weight: 500;
  margin-bottom: 2px;
}

.timeline-no-memo {
  font-size: 14px;
  color: #bbb;
}
</style>
