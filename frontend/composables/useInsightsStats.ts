import { computed, type Ref } from 'vue'
import { DAY_NAMES } from './useDate'
import { MOOD_THRESHOLDS } from './useMoodConfig'

export interface InsightMood {
  id: number
  date: string
  time?: string | null
  level: number
  memo?: string | null
  place_name?: string | null
}

export const TIME_SLOTS = [
  { label: '朝', from: 5, to: 10 },
  { label: '昼', from: 10, to: 14 },
  { label: '夕', from: 14, to: 18 },
  { label: '夜', from: 18, to: 5 },
]

function toLocalDateStr(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function getDateColor(date: Date): string {
  const { getDateColor: _getDateColor } = useDate()
  return _getDateColor(date)
}

function getTimeSlotIndex(time: string | null | undefined): number {
  if (!time) return -1
  const h = parseInt(time.split(':')[0])
  for (let i = 0; i < TIME_SLOTS.length - 1; i++) {
    const { from, to } = TIME_SLOTS[i]
    if (h >= from && h < to) return i
  }
  return TIME_SLOTS.length - 1
}

function heatmapBg(avg: number): string {
  if (avg <= 0) return '#f5f5f7'
  const { best, good, neutral, bad } = MOOD_THRESHOLDS
  if (avg >= best) return '#c8e6c9'
  if (avg >= good) return '#dcedc8'
  if (avg >= neutral) return '#fff9c4'
  if (avg >= bad) return '#ffe0b2'
  return '#ffcdd2'
}

function getMondayOfWeek(date: Date): Date {
  const d = new Date(date)
  d.setDate(date.getDate() - ((date.getDay() + 6) % 7))
  return d
}

export function useInsightsStats(moods: Ref<InsightMood[]>) {
  // --- 週次サマリー ---
  const thisWeekAvg = computed(() => {
    const from = toLocalDateStr(getMondayOfWeek(new Date()))
    const items = moods.value.filter((m) => m.date >= from)
    if (items.length === 0) return 0
    return items.reduce((s, m) => s + m.level, 0) / items.length
  })

  const thisWeekCount = computed(() => {
    const from = toLocalDateStr(getMondayOfWeek(new Date()))
    return moods.value.filter((m) => m.date >= from).length
  })

  const lastWeekAvg = computed(() => {
    const thisMonday = getMondayOfWeek(new Date())
    const lastMonday = new Date(thisMonday)
    lastMonday.setDate(thisMonday.getDate() - 7)
    const from = toLocalDateStr(lastMonday)
    const to = toLocalDateStr(thisMonday)
    const items = moods.value.filter((m) => m.date >= from && m.date < to)
    if (items.length === 0) return 0
    return items.reduce((s, m) => s + m.level, 0) / items.length
  })

  const lastWeekCount = computed(() => {
    const thisMonday = getMondayOfWeek(new Date())
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
      const dow = new Date(m.date + 'T00:00:00').getDay()
      sums[dow].total += m.level
      sums[dow].count++
    }
    return [1, 2, 3, 4, 5, 6, 0].map((dow) => ({
      day: DAY_NAMES[dow],
      avg: sums[dow].count > 0 ? sums[dow].total / sums[dow].count : 0,
      dayColor: getDateColor((() => { const d = new Date(); d.setDate(d.getDate() - ((d.getDay() - dow + 7) % 7)); return d })()),
    }))
  })

  // --- 時間帯別平均 ---
  const timeSlotStats = computed(() =>
    TIME_SLOTS.map((slot) => {
      const items = moods.value.filter((m) => {
        if (!m.time) return false
        const h = parseInt(m.time.split(':')[0])
        if (slot.from < slot.to) return h >= slot.from && h < slot.to
        return h >= slot.from || h < slot.to
      })
      const avg = items.length > 0 ? items.reduce((s, m) => s + m.level, 0) / items.length : 0
      return { label: slot.label, avg }
    })
  )

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
    if (!dates.has(toLocalDateStr(d))) d.setDate(d.getDate() - 1)
    while (dates.has(toLocalDateStr(d))) {
      streak++
      d.setDate(d.getDate() - 1)
    }
    return streak
  })

  const maxStreak = computed(() => {
    const dates = [...new Set(moods.value.map((m) => m.date))].sort()
    let max = 0, current = 1
    for (let i = 1; i < dates.length; i++) {
      const diff = (new Date(dates[i] + 'T00:00:00').getTime() - new Date(dates[i - 1] + 'T00:00:00').getTime()) / 86400000
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
  const dayOrderIndices = [1, 2, 3, 4, 5, 6, 0]

  const dayTimeMatrix = computed(() => {
    const grid: Record<number, Record<number, { total: number; count: number }>> = {}
    for (const dow of dayOrderIndices) {
      grid[dow] = {}
      for (let s = 0; s < TIME_SLOTS.length; s++) grid[dow][s] = { total: 0, count: 0 }
    }
    for (const m of moods.value) {
      const slotIdx = getTimeSlotIndex(m.time)
      if (slotIdx < 0) continue
      const dow = new Date(m.date + 'T00:00:00').getDay()
      grid[dow][slotIdx].total += m.level
      grid[dow][slotIdx].count++
    }
    return dayOrderIndices.map((dow) => ({
      day: DAY_NAMES[dow],
      dayColor: getDateColor((() => { const d = new Date(); d.setDate(d.getDate() - ((d.getDay() - dow + 7) % 7)); return d })()),
      cells: TIME_SLOTS.map((_, s) => {
        const avg = grid[dow][s].count > 0 ? grid[dow][s].total / grid[dow][s].count : 0
        return { avg, bg: heatmapBg(avg) }
      }),
    }))
  })

  // --- 場所×曜日分析 ---
  const placeDayMatrix = computed(() => {
    const map = new Map<string, Record<number, { total: number; count: number }>>()
    for (const m of moods.value) {
      if (!m.place_name) continue
      if (!map.has(m.place_name)) {
        const rec: Record<number, { total: number; count: number }> = {}
        for (const dow of dayOrderIndices) rec[dow] = { total: 0, count: 0 }
        map.set(m.place_name, rec)
      }
      const dow = new Date(m.date + 'T00:00:00').getDay()
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
    const dayMap = new Map<string, { morning: number[]; evening: number[] }>()
    for (const m of moods.value) {
      if (!m.time) continue
      const h = parseInt(m.time.split(':')[0])
      if (!dayMap.has(m.date)) dayMap.set(m.date, { morning: [], evening: [] })
      const entry = dayMap.get(m.date)!
      if (h >= 5 && h < 12) entry.morning.push(m.level)
      else if (h >= 14) entry.evening.push(m.level)
    }
    let morningSum = 0, morningCount = 0, eveningSum = 0, eveningCount = 0, dayCount = 0
    for (const [, entry] of dayMap) {
      if (entry.morning.length > 0 && entry.evening.length > 0) {
        dayCount++
        morningSum += entry.morning.reduce((s, v) => s + v, 0) / entry.morning.length
        morningCount++
        eveningSum += entry.evening.reduce((s, v) => s + v, 0) / entry.evening.length
        eveningCount++
      }
    }
    const morningAvg = morningCount > 0 ? morningSum / morningCount : 0
    const eveningAvg = eveningCount > 0 ? eveningSum / eveningCount : 0
    return {
      hasBoth: dayCount > 0,
      morningAvg,
      eveningAvg,
      trend: morningAvg > 0 && eveningAvg > 0 ? eveningAvg - morningAvg : 0,
      dayCount,
    }
  })

  // --- 記録頻度と気分の関係 ---
  const frequencyMoodStats = computed(() => {
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
        bucket.totalLevel += entry.total / entry.count
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
    const sorted = [...moods.value].sort((a, b) => {
      const cmp = a.date.localeCompare(b.date)
      return cmp !== 0 ? cmp : (a.time || '').localeCompare(b.time || '')
    })
    const streaks: { from: string; to: string; count: number; avg: number }[] = []
    let current: typeof sorted = []
    for (const m of sorted) {
      if (m.level <= MOOD_THRESHOLDS.neutral - 1) {
        current.push(m)
      } else {
        if (current.length >= 3) {
          streaks.push({ from: current[0].date, to: current[current.length - 1].date, count: current.length, avg: current.reduce((s, c) => s + c.level, 0) / current.length })
        }
        current = []
      }
    }
    if (current.length >= 3) {
      streaks.push({ from: current[0].date, to: current[current.length - 1].date, count: current.length, avg: current.reduce((s, c) => s + c.level, 0) / current.length })
    }
    return streaks
  })

  return {
    thisWeekAvg, thisWeekCount, lastWeekAvg, lastWeekCount,
    dayOfWeekStats, timeSlotStats,
    placeRanking,
    currentStreak, maxStreak, missedDays,
    dayTimeMatrix, placeDayMatrix,
    intradayPattern, frequencyMoodStats, lowScoreStreaks,
  }
}
