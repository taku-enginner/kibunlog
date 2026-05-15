<template>
  <div class="record-page">
    <h1 class="page-title">きぶんログ</h1>
    <p class="today-date" :style="{ color: todayColor }">{{ todayLabel }}</p>

    <div v-if="loading" class="loading">読み込み中...</div>
    <template v-else>
      <!-- 今日のサマリー -->
      <div class="summary">
        <div v-if="todayMoods.length > 0" class="avg-section">
          <span class="avg-emoji">{{ avgMoodConfig.emoji }}</span>
          <span class="avg-score" :style="{ color: avgMoodConfig.color }">{{ avgScore }}</span>
          <span class="avg-label" :style="{ color: avgMoodConfig.color }">{{ avgMoodConfig.label }}</span>
        </div>
        <div v-else class="avg-section">
          <span class="avg-emoji">📝</span>
          <span class="avg-label no-data">まだ記録がありません</span>
        </div>
        <p v-if="todayMoods.length > 0" class="record-count">
          今日 {{ todayMoods.length }}件記録済み
        </p>
      </div>

      <!-- 直近7日ミニグラフ -->
      <div v-if="weekData.length > 0" class="mini-chart">
        <div class="chart-bars">
          <div v-for="d in weekData" :key="d.date" class="chart-col">
            <div
              class="chart-bar"
              :style="{ height: `${(d.avg / 5) * 100}%`, background: barColor(d.avg) }"
            ></div>
            <span class="chart-day">{{ d.dayLabel }}</span>
          </div>
        </div>
      </div>

      <!-- 記録ボタン -->
      <button class="add-btn" @click="startAdd">＋ 記録する</button>
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
const { formatWithDay, getDateColor } = useDate()

const moodConfig: Record<number, { emoji: string; label: string; bg: string; color: string }> = {
  5: { emoji: '😆', label: '最高', bg: '#c8e6c9', color: '#1b5e20' },
  4: { emoji: '😊', label: '良い', bg: '#d4edda', color: '#155724' },
  3: { emoji: '😐', label: '普通', bg: '#fff3cd', color: '#856404' },
  2: { emoji: '😣', label: 'いまいち', bg: '#f8d7da', color: '#721c24' },
  1: { emoji: '😵', label: 'しんどい', bg: '#f5c6cb', color: '#491217' },
}

const dayNames = ['日', '月', '火', '水', '木', '金', '土']

const today = new Date()
const todayStr = today.toISOString().slice(0, 10)
const todayLabel = formatWithDay(today)
const todayColor = getDateColor(today)

const todayMoods = ref<Mood[]>([])
const weekData = ref<{ date: string; avg: number; dayLabel: string }[]>([])
const loading = ref(true)
const saving = ref(false)

const showPlaceSelector = ref(false)
const showMoodForm = ref(false)
const selectedPlace = ref<Place | null>(null)
const editingMood = ref<Mood | null>(null)
const pendingLevel = ref<number | null>(null)
const pendingMemo = ref<string | null>(null)

const avgScore = computed(() => {
  if (todayMoods.value.length === 0) return '0'
  const avg = todayMoods.value.reduce((s, m) => s + m.level, 0) / todayMoods.value.length
  return avg.toFixed(1)
})

const avgMoodConfig = computed(() => {
  const avg = parseFloat(avgScore.value)
  if (avg >= 4.5) return moodConfig[5]
  if (avg >= 3.5) return moodConfig[4]
  if (avg >= 2.5) return moodConfig[3]
  if (avg >= 1.5) return moodConfig[2]
  if (avg > 0) return moodConfig[1]
  return { emoji: '📝', label: '', bg: '#e0e0e0', color: '#6e6e73' }
})

function barColor(avg: number): string {
  if (avg >= 4.5) return '#1b5e20'
  if (avg >= 3.5) return '#28a745'
  if (avg >= 2.5) return '#ffc107'
  if (avg >= 1.5) return '#dc3545'
  return '#491217'
}

onMounted(async () => {
  // 直近7日分のデータ取得
  const weekAgo = new Date(today)
  weekAgo.setDate(weekAgo.getDate() - 6)
  const fromDate = weekAgo.toISOString().slice(0, 10)

  try {
    const result = await $fetch<Mood[]>(`${apiBase}/moods`, {
      params: { from_date: fromDate, to_date: todayStr },
      headers: getHeaders(),
    })

    // 今日のデータを抽出
    todayMoods.value = result.filter((m) => m.date === todayStr)

    // 日ごとに集計
    const byDate = new Map<string, number[]>()
    for (const m of result) {
      const arr = byDate.get(m.date) || []
      arr.push(m.level)
      byDate.set(m.date, arr)
    }

    const days: { date: string; avg: number; dayLabel: string }[] = []
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekAgo)
      d.setDate(weekAgo.getDate() + i)
      const ds = d.toISOString().slice(0, 10)
      const levels = byDate.get(ds)
      if (levels && levels.length > 0) {
        const avg = levels.reduce((s, v) => s + v, 0) / levels.length
        days.push({ date: ds, avg, dayLabel: dayNames[d.getDay()] })
      } else {
        days.push({ date: ds, avg: 0, dayLabel: dayNames[d.getDay()] })
      }
    }
    weekData.value = days
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
      const idx = todayMoods.value.findIndex((m) => m.id === editingMood.value!.id)
      if (idx >= 0) todayMoods.value[idx] = updated
    } else {
      const now = new Date()
      const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
      const created = await $fetch<Mood>(`${apiBase}/moods`, {
        method: 'POST',
        body: {
          date: todayStr,
          time: timeStr,
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
  font-size: 20px;
  font-weight: 700;
  text-align: center;
  margin-bottom: 4px;
}

.today-date {
  font-size: 15px;
  text-align: center;
  margin-bottom: 24px;
  font-weight: 500;
}

.loading {
  text-align: center;
  padding: 40px 0;
  color: #6e6e73;
}

/* サマリー */
.summary {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 28px;
}

.avg-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.avg-emoji {
  font-size: 56px;
  line-height: 1;
}

.avg-score {
  font-size: 36px;
  font-weight: 800;
  line-height: 1;
  margin-top: 4px;
}

.avg-label {
  font-size: 16px;
  font-weight: 600;
}

.avg-label.no-data {
  color: #6e6e73;
  margin-top: 8px;
}

.record-count {
  font-size: 14px;
  color: #6e6e73;
  margin-top: 8px;
}

/* ミニグラフ */
.mini-chart {
  margin-bottom: 28px;
  padding: 12px 8px;
  background: #fff;
  border-radius: 14px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}

.chart-bars {
  display: flex;
  justify-content: space-around;
  align-items: flex-end;
  height: 80px;
  gap: 4px;
}

.chart-col {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  height: 100%;
  justify-content: flex-end;
}

.chart-bar {
  width: 100%;
  max-width: 28px;
  border-radius: 6px 6px 0 0;
  min-height: 2px;
  transition: height 0.3s;
}

.chart-day {
  font-size: 11px;
  color: #6e6e73;
  margin-top: 4px;
  font-weight: 500;
}

/* 記録ボタン */
.add-btn {
  width: 100%;
  padding: 16px;
  background: #007aff;
  color: #fff;
  border: none;
  border-radius: 14px;
  font-size: 18px;
  font-weight: 700;
  cursor: pointer;
  min-height: 56px;
  margin-top: auto;
}

.add-btn:active {
  background: #005ec4;
}
</style>
