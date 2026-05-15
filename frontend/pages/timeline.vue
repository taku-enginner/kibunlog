<template>
  <div class="timeline-page">
    <h1 class="page-title">タイムライン</h1>

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
        :key="mood.date"
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
          <p v-if="mood.memo" class="timeline-memo">{{ mood.memo }}</p>
          <p v-else class="timeline-no-memo">メモなし</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
interface Mood {
  date: string
  level: number
  memo?: string | null
}

const config = useRuntimeConfig()
const apiBase = config.public.apiBase
const { getHeaders } = useAuth()
const { getDayName, getDateColor } = useDate()

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

const moods = ref<Mood[]>([])
const loading = ref(true)
const filterLevel = ref<number | null>(null)

onMounted(async () => {
  try {
    const result = await $fetch<Mood[]>(`${apiBase}/moods`, {
      headers: getHeaders(),
    })
    moods.value = result.slice().reverse()
  } catch (e) {
    // error
  } finally {
    loading.value = false
  }
})

const filteredMoods = computed(() => {
  if (filterLevel.value === null) return moods.value
  return moods.value.filter((m) => m.level === filterLevel.value)
})

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
}

.page-title {
  font-size: 20px;
  font-weight: 700;
  text-align: center;
  margin-bottom: 10px;
}

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

.timeline-no-memo {
  font-size: 14px;
  color: #bbb;
}
</style>
