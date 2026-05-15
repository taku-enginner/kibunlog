<template>
  <div class="insights-page">
    <h1 class="page-title">プラスα</h1>

    <div v-if="loading" class="loading">読み込み中...</div>
    <template v-else-if="moods.length === 0">
      <p class="empty">記録がまだありません</p>
    </template>
    <template v-else>
      <!-- 週次サマリー -->
      <section class="section">
        <h2 class="section-title">週次サマリー</h2>
        <div class="week-compare">
          <div class="week-card">
            <span class="week-label">今週</span>
            <span class="week-score" :style="{ color: scoreColor(thisWeekAvg) }">
              {{ thisWeekAvg > 0 ? thisWeekAvg.toFixed(1) : '—' }}
            </span>
            <span class="week-count">{{ thisWeekCount }}件</span>
          </div>
          <div class="week-arrow">
            <span v-if="thisWeekAvg > 0 && lastWeekAvg > 0">
              {{ thisWeekAvg > lastWeekAvg ? '↑' : thisWeekAvg < lastWeekAvg ? '↓' : '→' }}
            </span>
          </div>
          <div class="week-card">
            <span class="week-label">先週</span>
            <span class="week-score" :style="{ color: scoreColor(lastWeekAvg) }">
              {{ lastWeekAvg > 0 ? lastWeekAvg.toFixed(1) : '—' }}
            </span>
            <span class="week-count">{{ lastWeekCount }}件</span>
          </div>
        </div>
      </section>

      <!-- 曜日別平均 -->
      <section class="section">
        <h2 class="section-title">曜日別の気分</h2>
        <div class="day-bars">
          <div v-for="d in dayOfWeekStats" :key="d.day" class="day-col">
            <div class="day-bar-wrapper">
              <div
                class="day-bar"
                :style="{ height: d.avg > 0 ? `${(d.avg / 5) * 100}%` : '2px', background: scoreColor(d.avg) }"
              ></div>
            </div>
            <span class="day-avg">{{ d.avg > 0 ? d.avg.toFixed(1) : '—' }}</span>
            <span class="day-name" :style="{ color: d.dayColor }">{{ d.day }}</span>
          </div>
        </div>
      </section>

      <!-- 時間帯別平均 -->
      <section class="section">
        <h2 class="section-title">時間帯別の気分</h2>
        <div class="time-bars">
          <div v-for="t in timeSlotStats" :key="t.label" class="time-col">
            <div class="time-bar-wrapper">
              <div
                class="time-bar"
                :style="{ height: t.avg > 0 ? `${(t.avg / 5) * 100}%` : '2px', background: scoreColor(t.avg) }"
              ></div>
            </div>
            <span class="time-avg">{{ t.avg > 0 ? t.avg.toFixed(1) : '—' }}</span>
            <span class="time-label">{{ t.label }}</span>
          </div>
        </div>
      </section>

      <!-- 場所ランキング -->
      <section v-if="placeRanking.length > 0" class="section">
        <h2 class="section-title">気分が良い場所 TOP5</h2>
        <div class="ranking">
          <div v-for="(p, i) in placeRanking" :key="p.name" class="ranking-item">
            <span class="ranking-num">{{ i + 1 }}</span>
            <span class="ranking-name">{{ p.name }}</span>
            <span class="ranking-score" :style="{ color: scoreColor(p.avg) }">{{ p.avg.toFixed(1) }}</span>
            <span class="ranking-count">{{ p.count }}件</span>
          </div>
        </div>
      </section>

      <!-- 記録ストリーク -->
      <section class="section">
        <h2 class="section-title">記録の継続</h2>
        <div class="streak-row">
          <div class="streak-card">
            <span class="streak-num">{{ currentStreak }}</span>
            <span class="streak-unit">日連続</span>
          </div>
          <div class="streak-card">
            <span class="streak-num">{{ maxStreak }}</span>
            <span class="streak-unit">最長記録</span>
          </div>
          <div class="streak-card">
            <span class="streak-num">{{ missedDays }}</span>
            <span class="streak-unit">未記録日<br>(30日中)</span>
          </div>
        </div>
      </section>
    </template>
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
}

const config = useRuntimeConfig()
const apiBase = config.public.apiBase
const { getHeaders } = useAuth()
const { getDateColor, toLocalDateStr } = useDate()

const dayNames = ['日', '月', '火', '水', '木', '金', '土']

const moods = ref<Mood[]>([])
const loading = ref(true)

function scoreColor(avg: number): string {
  if (avg >= 4.5) return '#1b5e20'
  if (avg >= 3.5) return '#28a745'
  if (avg >= 2.5) return '#ffc107'
  if (avg > 0) return '#b0b0b0'
  return '#d5d5d5'
}

onMounted(async () => {
  try {
    const result = await $fetch<Mood[]>(`${apiBase}/moods`, {
      headers: getHeaders(),
    })
    moods.value = result
  } catch {}
  loading.value = false
})

// --- 週次サマリー ---
const thisWeekAvg = computed(() => {
  const now = new Date()
  const monday = new Date(now)
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7))
  const from = toLocalDateStr(monday)
  const items = moods.value.filter((m) => m.date >= from)
  if (items.length === 0) return 0
  return items.reduce((s, m) => s + m.level, 0) / items.length
})

const thisWeekCount = computed(() => {
  const now = new Date()
  const monday = new Date(now)
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7))
  const from = toLocalDateStr(monday)
  return moods.value.filter((m) => m.date >= from).length
})

const lastWeekAvg = computed(() => {
  const now = new Date()
  const thisMonday = new Date(now)
  thisMonday.setDate(now.getDate() - ((now.getDay() + 6) % 7))
  const lastMonday = new Date(thisMonday)
  lastMonday.setDate(thisMonday.getDate() - 7)
  const from = toLocalDateStr(lastMonday)
  const to = toLocalDateStr(thisMonday)
  const items = moods.value.filter((m) => m.date >= from && m.date < to)
  if (items.length === 0) return 0
  return items.reduce((s, m) => s + m.level, 0) / items.length
})

const lastWeekCount = computed(() => {
  const now = new Date()
  const thisMonday = new Date(now)
  thisMonday.setDate(now.getDate() - ((now.getDay() + 6) % 7))
  const lastMonday = new Date(thisMonday)
  lastMonday.setDate(thisMonday.getDate() - 7)
  const from = toLocalDateStr(lastMonday)
  const to = toLocalDateStr(thisMonday)
  return moods.value.filter((m) => m.date >= from && m.date < to).length
})

// --- 曜日別平均 ---
const dayOfWeekStats = computed(() => {
  const sums: Record<number, { total: number; count: number }> = {}
  for (let i = 0; i < 7; i++) sums[i] = { total: 0, count: 0 }
  for (const m of moods.value) {
    const d = new Date(m.date + 'T00:00:00')
    const dow = d.getDay()
    sums[dow].total += m.level
    sums[dow].count++
  }
  return [1, 2, 3, 4, 5, 6, 0].map((dow) => ({
    day: dayNames[dow],
    avg: sums[dow].count > 0 ? sums[dow].total / sums[dow].count : 0,
    dayColor: getDateColor((() => { const d = new Date(); d.setDate(d.getDate() - ((d.getDay() - dow + 7) % 7)); return d })()),
  }))
})

// --- 時間帯別平均 ---
const timeSlotStats = computed(() => {
  const slots = [
    { label: '朝', from: 5, to: 10 },
    { label: '昼', from: 10, to: 14 },
    { label: '夕', from: 14, to: 18 },
    { label: '夜', from: 18, to: 24 },
    { label: '深夜', from: 0, to: 5 },
  ]
  return slots.map((slot) => {
    const items = moods.value.filter((m) => {
      if (!m.time) return false
      const h = parseInt(m.time.split(':')[0])
      if (slot.from < slot.to) return h >= slot.from && h < slot.to
      return h >= slot.from || h < slot.to
    })
    const avg = items.length > 0 ? items.reduce((s, m) => s + m.level, 0) / items.length : 0
    return { label: slot.label, avg }
  })
})

// --- 場所ランキング ---
const placeRanking = computed(() => {
  const map = new Map<string, { total: number; count: number }>()
  for (const m of moods.value) {
    if (!m.place_name) continue
    const entry = map.get(m.place_name) || { total: 0, count: 0 }
    entry.total += m.level
    entry.count++
    map.set(m.place_name, entry)
  }
  return Array.from(map.entries())
    .map(([name, { total, count }]) => ({ name, avg: total / count, count }))
    .sort((a, b) => b.avg - a.avg)
    .slice(0, 5)
})

// --- ストリーク ---
const currentStreak = computed(() => {
  const dates = new Set(moods.value.map((m) => m.date))
  let streak = 0
  const d = new Date()
  // 今日記録がなければ昨日から数える
  if (!dates.has(toLocalDateStr(d))) {
    d.setDate(d.getDate() - 1)
  }
  while (dates.has(toLocalDateStr(d))) {
    streak++
    d.setDate(d.getDate() - 1)
  }
  return streak
})

const maxStreak = computed(() => {
  const dates = [...new Set(moods.value.map((m) => m.date))].sort()
  let max = 0
  let current = 1
  for (let i = 1; i < dates.length; i++) {
    const prev = new Date(dates[i - 1] + 'T00:00:00')
    const curr = new Date(dates[i] + 'T00:00:00')
    const diff = (curr.getTime() - prev.getTime()) / 86400000
    if (diff === 1) {
      current++
    } else {
      max = Math.max(max, current)
      current = 1
    }
  }
  return Math.max(max, current)
})

const missedDays = computed(() => {
  const dates = new Set(moods.value.map((m) => m.date))
  const today = new Date()
  let missed = 0
  for (let i = 0; i < 30; i++) {
    const d = new Date(today)
    d.setDate(today.getDate() - i)
    if (!dates.has(toLocalDateStr(d))) missed++
  }
  return missed
})
</script>

<style scoped>
.insights-page {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.page-title {
  font-size: 20px;
  font-weight: 700;
  text-align: center;
  margin-bottom: 16px;
}

.loading,
.empty {
  text-align: center;
  padding: 40px 0;
  color: #6e6e73;
  font-size: 15px;
}

.section {
  background: #fff;
  border-radius: 14px;
  padding: 16px;
  margin-bottom: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}

.section-title {
  font-size: 14px;
  font-weight: 700;
  color: #6e6e73;
  margin-bottom: 12px;
}

/* 週次サマリー */
.week-compare {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
}

.week-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  flex: 1;
}

.week-label {
  font-size: 12px;
  color: #6e6e73;
  font-weight: 600;
}

.week-score {
  font-size: 28px;
  font-weight: 800;
  line-height: 1;
}

.week-count {
  font-size: 12px;
  color: #aaa;
}

.week-arrow {
  font-size: 24px;
  color: #6e6e73;
}

/* 曜日別・時間帯別バー */
.day-bars,
.time-bars {
  display: flex;
  justify-content: space-around;
  align-items: flex-end;
  gap: 4px;
}

.day-col,
.time-col {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.day-bar-wrapper,
.time-bar-wrapper {
  width: 100%;
  height: 80px;
  display: flex;
  align-items: flex-end;
  justify-content: center;
}

.day-bar,
.time-bar {
  width: 100%;
  max-width: 28px;
  border-radius: 6px 6px 0 0;
  min-height: 2px;
}

.day-avg,
.time-avg {
  font-size: 11px;
  font-weight: 700;
  color: #333;
  margin-top: 4px;
}

.day-name {
  font-size: 12px;
  font-weight: 600;
  margin-top: 2px;
}

.time-label {
  font-size: 12px;
  font-weight: 600;
  color: #6e6e73;
  margin-top: 2px;
}

/* 場所ランキング */
.ranking {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.ranking-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 0;
  border-bottom: 1px solid #f0f0f0;
}

.ranking-item:last-child {
  border-bottom: none;
}

.ranking-num {
  font-size: 16px;
  font-weight: 800;
  color: #b0b0b0;
  width: 24px;
  text-align: center;
}

.ranking-name {
  flex: 1;
  font-size: 14px;
  font-weight: 600;
  color: #333;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ranking-score {
  font-size: 16px;
  font-weight: 800;
}

.ranking-count {
  font-size: 12px;
  color: #aaa;
}

/* ストリーク */
.streak-row {
  display: flex;
  gap: 8px;
}

.streak-card {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 12px 0;
  background: #f5f5f7;
  border-radius: 10px;
}

.streak-num {
  font-size: 24px;
  font-weight: 800;
  color: #333;
}

.streak-unit {
  font-size: 11px;
  color: #6e6e73;
  font-weight: 600;
  text-align: center;
  line-height: 1.3;
}
</style>
