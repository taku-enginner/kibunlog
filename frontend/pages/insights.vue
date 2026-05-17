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

      <!-- マップ -->
      <section class="section">
        <NuxtLink to="/map" class="map-link-btn">
          <svg class="map-link-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/></svg>
          マップで見る
        </NuxtLink>
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

      <!-- 曜日×時間帯クロス分析 -->
      <section class="section">
        <h2 class="section-title">曜日 × 時間帯クロス分析</h2>
        <p class="section-sub">曜日と時間帯ごとの平均気分</p>
        <div class="cross-table-wrapper">
          <table class="cross-table">
            <thead>
              <tr>
                <th></th>
                <th v-for="slot in timeSlotLabels" :key="slot">{{ slot }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in dayTimeMatrix" :key="row.day">
                <td class="cross-day" :style="{ color: row.dayColor }">{{ row.day }}</td>
                <td
                  v-for="(cell, idx) in row.cells"
                  :key="idx"
                  class="cross-cell"
                  :style="{ background: cell.bg }"
                >
                  <span v-if="cell.avg > 0" class="cross-val">{{ cell.avg.toFixed(1) }}</span>
                  <span v-else class="cross-val cross-empty">-</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <!-- 場所×曜日分析 -->
      <section v-if="placeDayMatrix.length > 0" class="section">
        <h2 class="section-title">場所 × 曜日分析</h2>
        <p class="section-sub">場所と曜日ごとの平均気分</p>
        <div class="cross-table-wrapper">
          <table class="cross-table">
            <thead>
              <tr>
                <th></th>
                <th v-for="d in dayNamesOrdered" :key="d">{{ d }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in placeDayMatrix" :key="row.place">
                <td class="cross-place">{{ row.place }}</td>
                <td
                  v-for="(cell, idx) in row.cells"
                  :key="idx"
                  class="cross-cell"
                  :style="{ background: cell.bg }"
                >
                  <span v-if="cell.avg > 0" class="cross-val">{{ cell.avg.toFixed(1) }}</span>
                  <span v-else class="cross-val cross-empty">-</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <!-- 気分の変動パターン -->
      <section v-if="intradayPattern.hasBoth" class="section">
        <h2 class="section-title">気分の変動パターン</h2>
        <p class="section-sub">同じ日の朝と夜でどう変わるか</p>
        <div class="intraday-summary">
          <div class="intraday-card">
            <span class="intraday-label">午前の平均</span>
            <span class="intraday-score" :style="{ color: scoreColor(intradayPattern.morningAvg) }">
              {{ intradayPattern.morningAvg.toFixed(1) }}
            </span>
          </div>
          <div class="intraday-arrow">
            {{ intradayPattern.trend > 0 ? '↑' : intradayPattern.trend < 0 ? '↓' : '→' }}
          </div>
          <div class="intraday-card">
            <span class="intraday-label">午後〜夜の平均</span>
            <span class="intraday-score" :style="{ color: scoreColor(intradayPattern.eveningAvg) }">
              {{ intradayPattern.eveningAvg.toFixed(1) }}
            </span>
          </div>
        </div>
        <p class="intraday-desc">
          {{ intradayPattern.trend > 0 ? '1日の中で気分が上がる傾向があります' : intradayPattern.trend < 0 ? '1日の中で気分が下がる傾向があります' : '1日の中での気分変動は少ないです' }}
          <span class="intraday-diff">(差: {{ intradayPattern.trend > 0 ? '+' : '' }}{{ intradayPattern.trend.toFixed(1) }})</span>
        </p>
        <div class="intraday-days">
          <span class="intraday-daycount">対象: {{ intradayPattern.dayCount }}日分</span>
        </div>
      </section>

      <!-- 記録頻度と気分の関係 -->
      <section class="section">
        <h2 class="section-title">記録頻度と気分の関係</h2>
        <p class="section-sub">1日の記録件数が多い日と少ない日の気分比較</p>
        <div class="freq-bars">
          <div v-for="f in frequencyMoodStats" :key="f.label" class="freq-col">
            <div class="freq-bar-wrapper">
              <div
                class="freq-bar"
                :style="{ height: f.avg > 0 ? `${(f.avg / 5) * 100}%` : '2px', background: scoreColor(f.avg) }"
              ></div>
            </div>
            <span class="freq-avg">{{ f.avg > 0 ? f.avg.toFixed(1) : '—' }}</span>
            <span class="freq-label">{{ f.label }}</span>
            <span class="freq-count">{{ f.dayCount }}日</span>
          </div>
        </div>
      </section>

      <!-- 連続低スコア検出 -->
      <section v-if="lowScoreStreaks.length > 0" class="section section-alert">
        <h2 class="section-title section-title-alert">連続低スコア検出</h2>
        <p class="section-sub">スコア2以下が3件以上連続した期間</p>
        <div class="alert-list">
          <div v-for="(streak, i) in lowScoreStreaks" :key="i" class="alert-item">
            <span class="alert-icon">&#9888;</span>
            <div class="alert-body">
              <span class="alert-range">{{ streak.from }} 〜 {{ streak.to }}</span>
              <span class="alert-detail">{{ streak.count }}件連続 / 平均 {{ streak.avg.toFixed(1) }}</span>
            </div>
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

    <!-- ヒートマップ -->
    <section class="section">
      <h2 class="section-title">タップヒートマップ</h2>
      <div class="heatmap-controls">
        <select v-model="heatmapPage" class="heatmap-select">
          <option value="">全ページ</option>
          <option value="/">記録</option>
          <option value="/graph">グラフ</option>
          <option value="/timeline">履歴</option>
          <option value="/map">マップ</option>
          <option value="/insights">+α</option>
        </select>
        <button class="heatmap-btn" @click="loadHeatmap">表示</button>
      </div>
      <div class="heatmap-canvas-wrapper">
        <canvas ref="heatmapCanvas" class="heatmap-canvas" width="320" height="568"></canvas>
        <p v-if="heatmapCount === 0 && heatmapLoaded" class="heatmap-empty">データがまだありません</p>
      </div>
      <p v-if="heatmapCount > 0" class="heatmap-count">{{ heatmapCount }}件のイベント</p>
    </section>

    <!-- ログアウト -->
    <div class="logout-area">
      <button class="logout-link" @click="handleLogout">ログアウト</button>
    </div>
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
const router = useRouter()
const { getHeaders, logout } = useAuth()

function handleLogout() {
  logout()
  router.push('/login')
}
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

// --- 曜日×時間帯クロス分析 ---
const timeSlotLabels = ['朝', '昼', '夕', '夜', '深夜']
const timeSlotDefs = [
  { from: 5, to: 10 },
  { from: 10, to: 14 },
  { from: 14, to: 18 },
  { from: 18, to: 24 },
  { from: 0, to: 5 },
]
const dayNamesOrdered = ['月', '火', '水', '木', '金', '土', '日']
const dayOrderIndices = [1, 2, 3, 4, 5, 6, 0] // JS getDay() indices

function getTimeSlotIndex(time: string | null | undefined): number {
  if (!time) return -1
  const h = parseInt(time.split(':')[0])
  if (h >= 5 && h < 10) return 0
  if (h >= 10 && h < 14) return 1
  if (h >= 14 && h < 18) return 2
  if (h >= 18 && h < 24) return 3
  return 4 // 0-4
}

function heatmapBg(avg: number): string {
  if (avg <= 0) return '#f5f5f7'
  if (avg >= 4.5) return '#c8e6c9'
  if (avg >= 3.5) return '#dcedc8'
  if (avg >= 2.5) return '#fff9c4'
  if (avg >= 1.5) return '#ffe0b2'
  return '#ffcdd2'
}

const dayTimeMatrix = computed(() => {
  // [dow][slotIdx] -> { total, count }
  const grid: Record<number, Record<number, { total: number; count: number }>> = {}
  for (const dow of dayOrderIndices) {
    grid[dow] = {}
    for (let s = 0; s < 5; s++) grid[dow][s] = { total: 0, count: 0 }
  }
  for (const m of moods.value) {
    const slotIdx = getTimeSlotIndex(m.time)
    if (slotIdx < 0) continue
    const d = new Date(m.date + 'T00:00:00')
    const dow = d.getDay()
    grid[dow][slotIdx].total += m.level
    grid[dow][slotIdx].count++
  }
  return dayOrderIndices.map((dow) => ({
    day: dayNames[dow],
    dayColor: getDateColor((() => { const d = new Date(); d.setDate(d.getDate() - ((d.getDay() - dow + 7) % 7)); return d })()),
    cells: [0, 1, 2, 3, 4].map((s) => {
      const avg = grid[dow][s].count > 0 ? grid[dow][s].total / grid[dow][s].count : 0
      return { avg, bg: heatmapBg(avg) }
    }),
  }))
})

// --- 場所×曜日分析 ---
const placeDayMatrix = computed(() => {
  // place -> dow -> { total, count }
  const map = new Map<string, Record<number, { total: number; count: number }>>()
  for (const m of moods.value) {
    if (!m.place_name) continue
    if (!map.has(m.place_name)) {
      const rec: Record<number, { total: number; count: number }> = {}
      for (const dow of dayOrderIndices) rec[dow] = { total: 0, count: 0 }
      map.set(m.place_name, rec)
    }
    const d = new Date(m.date + 'T00:00:00')
    const dow = d.getDay()
    const entry = map.get(m.place_name)!
    if (entry[dow]) {
      entry[dow].total += m.level
      entry[dow].count++
    }
  }
  const all = Array.from(map.entries())
    .map(([place, rec]) => ({
      place,
      totalCount: dayOrderIndices.reduce((s, dow) => s + rec[dow].count, 0),
      rec,
    }))
    .sort((a, b) => b.totalCount - a.totalCount)
  // 20件以上の場所のみ、なければ最多1件
  const filtered = all.filter((p) => p.totalCount >= 20)
  const places = filtered.length > 0 ? filtered.slice(0, 5) : all.length > 0 ? [all[0]] : []

  return places.map(({ place, rec }) => ({
    place,
    cells: dayOrderIndices.map((dow) => {
      const avg = rec[dow].count > 0 ? rec[dow].total / rec[dow].count : 0
      return { avg, bg: heatmapBg(avg) }
    }),
  }))
})

// --- 気分の変動パターン ---
const intradayPattern = computed(() => {
  // For each day that has both morning (5-12) and evening (14-24) records, compute the difference
  const dayMap = new Map<string, { morning: number[]; evening: number[] }>()
  for (const m of moods.value) {
    if (!m.time) continue
    const h = parseInt(m.time.split(':')[0])
    if (!dayMap.has(m.date)) dayMap.set(m.date, { morning: [], evening: [] })
    const entry = dayMap.get(m.date)!
    if (h >= 5 && h < 12) entry.morning.push(m.level)
    else if (h >= 14) entry.evening.push(m.level)
  }
  let morningSum = 0, morningCount = 0
  let eveningSum = 0, eveningCount = 0
  let dayCount = 0
  for (const [, entry] of dayMap) {
    if (entry.morning.length > 0 && entry.evening.length > 0) {
      dayCount++
      const mAvg = entry.morning.reduce((s, v) => s + v, 0) / entry.morning.length
      const eAvg = entry.evening.reduce((s, v) => s + v, 0) / entry.evening.length
      morningSum += mAvg
      morningCount++
      eveningSum += eAvg
      eveningCount++
    }
  }
  const morningAvg = morningCount > 0 ? morningSum / morningCount : 0
  const eveningAvg = eveningCount > 0 ? eveningSum / eveningCount : 0
  const trend = morningAvg > 0 && eveningAvg > 0 ? eveningAvg - morningAvg : 0
  return {
    hasBoth: dayCount > 0,
    morningAvg,
    eveningAvg,
    trend,
    dayCount,
  }
})

// --- 記録頻度と気分の関係 ---
const frequencyMoodStats = computed(() => {
  // Group by date, count records per day, then bucket
  const dayMap = new Map<string, { total: number; count: number }>()
  for (const m of moods.value) {
    const entry = dayMap.get(m.date) || { total: 0, count: 0 }
    entry.total += m.level
    entry.count++
    dayMap.set(m.date, entry)
  }
  const buckets = [
    { label: '1件', min: 1, max: 1, totalLevel: 0, dayCount: 0 },
    { label: '2件', min: 2, max: 2, totalLevel: 0, dayCount: 0 },
    { label: '3件', min: 3, max: 3, totalLevel: 0, dayCount: 0 },
    { label: '4件+', min: 4, max: Infinity, totalLevel: 0, dayCount: 0 },
  ]
  for (const [, entry] of dayMap) {
    const bucket = buckets.find((b) => entry.count >= b.min && entry.count <= b.max)
    if (bucket) {
      bucket.totalLevel += entry.total / entry.count // average per day
      bucket.dayCount++
    }
  }
  return buckets.map((b) => ({
    label: b.label,
    avg: b.dayCount > 0 ? b.totalLevel / b.dayCount : 0,
    dayCount: b.dayCount,
  }))
})

// --- 連続低スコア検出 ---
const lowScoreStreaks = computed(() => {
  // Sort all moods by date+time, find 3+ consecutive with level <= 2
  const sorted = [...moods.value].sort((a, b) => {
    const cmp = a.date.localeCompare(b.date)
    if (cmp !== 0) return cmp
    return (a.time || '').localeCompare(b.time || '')
  })

  const streaks: { from: string; to: string; count: number; avg: number }[] = []
  let current: typeof sorted = []

  for (const m of sorted) {
    if (m.level <= 2) {
      current.push(m)
    } else {
      if (current.length >= 3) {
        const avg = current.reduce((s, c) => s + c.level, 0) / current.length
        streaks.push({
          from: current[0].date,
          to: current[current.length - 1].date,
          count: current.length,
          avg,
        })
      }
      current = []
    }
  }
  // Final check
  if (current.length >= 3) {
    const avg = current.reduce((s, c) => s + c.level, 0) / current.length
    streaks.push({
      from: current[0].date,
      to: current[current.length - 1].date,
      count: current.length,
      avg,
    })
  }
  return streaks
})

// --- ヒートマップ ---
const heatmapPage = ref('')
const heatmapCanvas = ref<HTMLCanvasElement | null>(null)
const heatmapCount = ref(0)
const heatmapLoaded = ref(false)

async function loadHeatmap() {
  heatmapLoaded.value = false
  const params = heatmapPage.value ? `?page=${encodeURIComponent(heatmapPage.value)}` : ''
  try {
    const data = await $fetch<Array<{ x_pct: number; y_pct: number }>>(`${apiBase}/heatmap${params}`, {
      headers: getHeaders(),
    })
    heatmapCount.value = data.length
    heatmapLoaded.value = true
    drawHeatmap(data)
  } catch {
    heatmapCount.value = 0
    heatmapLoaded.value = true
  }
}

function drawHeatmap(events: Array<{ x_pct: number; y_pct: number }>) {
  const canvas = heatmapCanvas.value
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const w = canvas.width
  const h = canvas.height

  ctx.clearRect(0, 0, w, h)

  // Draw background grid
  ctx.fillStyle = '#f9f9f9'
  ctx.fillRect(0, 0, w, h)
  ctx.strokeStyle = '#e0e0e0'
  ctx.lineWidth = 0.5
  for (let i = 0; i <= 10; i++) {
    ctx.beginPath()
    ctx.moveTo((w / 10) * i, 0)
    ctx.lineTo((w / 10) * i, h)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(0, (h / 10) * i)
    ctx.lineTo(w, (h / 10) * i)
    ctx.stroke()
  }

  if (events.length === 0) return

  // Build density grid
  const gridSize = 16
  const cols = Math.ceil(w / gridSize)
  const rows = Math.ceil(h / gridSize)
  const grid = new Array(cols * rows).fill(0)

  for (const ev of events) {
    const px = (ev.x_pct / 100) * w
    const py = (ev.y_pct / 100) * h
    const col = Math.min(Math.floor(px / gridSize), cols - 1)
    const row = Math.min(Math.floor(py / gridSize), rows - 1)
    grid[row * cols + col]++
  }

  const maxDensity = Math.max(...grid)
  if (maxDensity === 0) return

  // Draw heatmap cells
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const val = grid[row * cols + col]
      if (val === 0) continue
      const intensity = val / maxDensity
      const alpha = Math.min(0.1 + intensity * 0.7, 0.8)
      // Color: blue(low) -> red(high)
      const r = Math.round(255 * intensity)
      const g = Math.round(80 * (1 - intensity))
      const b = Math.round(200 * (1 - intensity))
      ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`
      ctx.fillRect(col * gridSize, row * gridSize, gridSize, gridSize)
    }
  }

  // Draw individual points as small dots on top
  ctx.fillStyle = 'rgba(255, 50, 50, 0.3)'
  for (const ev of events) {
    const px = (ev.x_pct / 100) * w
    const py = (ev.y_pct / 100) * h
    ctx.beginPath()
    ctx.arc(px, py, 3, 0, Math.PI * 2)
    ctx.fill()
  }
}
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

/* マップリンク */
.map-link-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  padding: 14px;
  background: #f0f4ff;
  border: 1px solid #d0d8f0;
  border-radius: 12px;
  font-size: 15px;
  font-weight: 600;
  color: #007aff;
  text-decoration: none;
  cursor: pointer;
}

.map-link-btn:active {
  background: #dce4f8;
}

.map-link-icon {
  width: 20px;
  height: 20px;
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

/* セクション補足テキスト */
.section-sub {
  font-size: 11px;
  color: #aaa;
  margin: -8px 0 12px;
}

/* クロス分析テーブル */
.cross-table-wrapper {
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}

.cross-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}

.cross-table th {
  font-size: 11px;
  font-weight: 600;
  color: #6e6e73;
  padding: 4px 6px;
  text-align: center;
}

.cross-table td {
  padding: 6px 4px;
  text-align: center;
}

.cross-day,
.cross-place {
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
  text-align: left;
  padding-right: 8px;
}

.cross-place {
  color: #333;
  max-width: 60px;
  overflow: hidden;
  text-overflow: ellipsis;
}

.cross-cell {
  border-radius: 6px;
  min-width: 36px;
}

.cross-val {
  font-size: 11px;
  font-weight: 700;
  color: #333;
}

.cross-empty {
  color: #ccc;
}

/* 気分の変動パターン */
.intraday-summary {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  margin-bottom: 8px;
}

.intraday-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  flex: 1;
  padding: 10px 0;
  background: #f5f5f7;
  border-radius: 10px;
}

.intraday-label {
  font-size: 11px;
  color: #6e6e73;
  font-weight: 600;
}

.intraday-score {
  font-size: 24px;
  font-weight: 800;
  line-height: 1;
}

.intraday-arrow {
  font-size: 24px;
  color: #6e6e73;
}

.intraday-desc {
  font-size: 13px;
  color: #333;
  text-align: center;
  margin-top: 4px;
}

.intraday-diff {
  color: #6e6e73;
  font-size: 12px;
}

.intraday-days {
  text-align: center;
  margin-top: 4px;
}

.intraday-daycount {
  font-size: 11px;
  color: #aaa;
}

/* 記録頻度と気分の関係 */
.freq-bars {
  display: flex;
  justify-content: space-around;
  align-items: flex-end;
  gap: 4px;
}

.freq-col {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.freq-bar-wrapper {
  width: 100%;
  height: 80px;
  display: flex;
  align-items: flex-end;
  justify-content: center;
}

.freq-bar {
  width: 100%;
  max-width: 32px;
  border-radius: 6px 6px 0 0;
  min-height: 2px;
}

.freq-avg {
  font-size: 11px;
  font-weight: 700;
  color: #333;
  margin-top: 4px;
}

.freq-label {
  font-size: 12px;
  font-weight: 600;
  color: #6e6e73;
  margin-top: 2px;
}

.freq-count {
  font-size: 10px;
  color: #aaa;
}

/* 連続低スコア検出 */
.section-alert {
  border: 1.5px solid #ffcc80;
  background: #fff8e1;
}

.section-title-alert {
  color: #e65100;
}

.alert-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.alert-item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 8px 0;
  border-bottom: 1px solid #ffe0b2;
}

.alert-item:last-child {
  border-bottom: none;
}

.alert-icon {
  font-size: 18px;
  line-height: 1;
  color: #e65100;
}

.alert-body {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.alert-range {
  font-size: 13px;
  font-weight: 600;
  color: #333;
}

.alert-detail {
  font-size: 11px;
  color: #6e6e73;
}

/* ログアウト */
.logout-area {
  padding: 32px 0 16px;
  text-align: center;
}

.logout-link {
  background: none;
  border: none;
  color: #8e8e93;
  font-size: 13px;
  cursor: pointer;
  padding: 8px 16px;
  min-height: 44px;
}

/* ヒートマップ */
.heatmap-controls {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}

.heatmap-select {
  flex: 1;
  padding: 8px 12px;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  font-size: 14px;
  background: #fff;
  color: #333;
}

.heatmap-btn {
  padding: 8px 16px;
  background: #007aff;
  color: #fff;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  min-height: 44px;
}

.heatmap-canvas-wrapper {
  position: relative;
  width: 100%;
  display: flex;
  justify-content: center;
}

.heatmap-canvas {
  border-radius: 10px;
  border: 1px solid #e0e0e0;
  max-width: 100%;
  height: auto;
}

.heatmap-empty {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  color: #8e8e93;
  font-size: 13px;
}

.heatmap-count {
  text-align: center;
  font-size: 12px;
  color: #6e6e73;
  margin-top: 8px;
}
</style>
