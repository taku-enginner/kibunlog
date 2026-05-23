<template>
  <div class="graph-page">
    <h1 class="page-title">きぶんグラフ</h1>

    <div class="range-selector">
      <button
        v-for="opt in rangeOptions"
        :key="opt.key"
        class="range-btn"
        :class="{ active: selectedRange === opt.key }"
        @click="selectRange(opt.key)"
      >
        {{ opt.label }}
      </button>
    </div>

    <div v-if="loading" class="loading">読み込み中...</div>
    <div v-else-if="fetchError" class="error-msg">データの取得に失敗しました。</div>
    <div v-else class="chart-wrapper">
      <Line :key="selectedRange" :data="chartData" :options="chartOptions" :plugins="chartPlugins" />
    </div>

    <div v-if="warningRanges.length > 0" class="warnings">
      <p class="warning-title">⚠ 注意シグナル</p>
      <p class="warning-desc">2日以上連続で「普通」以下の期間:</p>
      <ul>
        <li v-for="(range, i) in warningRanges" :key="i">
          {{ range.start }} 〜 {{ range.end }}（{{ range.days }}日間）
        </li>
      </ul>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Line } from 'vue-chartjs'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  TimeScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js'
import type { ChartData, ChartOptions } from 'chart.js'
import 'chartjs-adapter-date-fns'

ChartJS.register(CategoryScale, LinearScale, TimeScale, PointElement, LineElement, Title, Tooltip, Legend, Filler)

interface Mood {
  date: string
  time: string | null
  level: number
}

interface WarningRange {
  start: string
  end: string
  days: number
}

interface RangeOption {
  key: string
  label: string
  days: number
}

const config = useRuntimeConfig()
const apiBase = config.public.apiBase
const { getHeaders } = useAuth()
const { getDayName, getDateColor, toLocalDateStr } = useDate()

const rangeOptions: RangeOption[] = [
  { key: '1d', label: '1日', days: 1 },
  { key: '1w', label: '1週間', days: 7 },
  { key: '1m', label: '1ヶ月', days: 30 },
]

const selectedRange = ref('1d')
const moods = ref<Mood[]>([])
const loading = ref(true)
const fetchError = ref(false)

const currentDays = computed(() => {
  return rangeOptions.find((o) => o.key === selectedRange.value)?.days ?? 30
})

async function fetchMoods() {
  loading.value = true
  fetchError.value = false
  try {
    const today = new Date()
    const from = new Date(today)
    // 1日モード: 昨日、1週間モード: 前週のデータも取得（背景表示用）
    const extraDays = selectedRange.value === '1d' ? 1 : selectedRange.value === '1w' ? 7 : 0
    from.setDate(from.getDate() - (currentDays.value - 1) - extraDays)
    const result = await $fetch<Mood[]>(`${apiBase}/moods`, {
      params: {
        from_date: toLocalDateStr(from),
        to_date: toLocalDateStr(today),
      },
      headers: getHeaders(),
    })
    moods.value = result
  } catch (e) {
    fetchError.value = true
  } finally {
    loading.value = false
  }
}

function selectRange(key: string) {
  selectedRange.value = key
  fetchMoods()
}

onMounted(() => fetchMoods())

const is1dMode = computed(() => selectedRange.value === '1d')
const is1wMode = computed(() => selectedRange.value === '1w')

const moodMap = computed(() => {
  const sums: Record<string, { total: number; count: number }> = {}
  for (const m of moods.value) {
    if (!sums[m.date]) sums[m.date] = { total: 0, count: 0 }
    sums[m.date].total += m.level
    sums[m.date].count++
  }
  const map: Record<string, number | null> = {}
  for (const [date, s] of Object.entries(sums)) {
    map[date] = s.total / s.count
  }
  return map
})

const allDates = computed(() => {
  const dates: string[] = []
  const today = new Date()
  const from = new Date(today)
  from.setDate(from.getDate() - (currentDays.value - 1))
  const d = new Date(from)
  for (let i = 0; i < currentDays.value; i++) {
    dates.push(toLocalDateStr(d))
    d.setDate(d.getDate() + 1)
  }
  return dates
})

// 1日モード: 今日の日付文字列
const todayStr = computed(() => toLocalDateStr(new Date()))

// 1日モード: 個別エントリを時刻順にプロット（今日分のみ）
const sortedMoods1d = computed(() => {
  if (!is1dMode.value) return []
  return [...moods.value]
    .filter((m) => m.date === todayStr.value)
    .map((m) => ({
      ...m,
      sortKey: `${m.date} ${m.time ?? '00:00'}`,
    }))
    .sort((a, b) => a.sortKey.localeCompare(b.sortKey))
})

// 1日モード: 昨日のエントリ（背景表示用）
const yesterdayMoods1d = computed(() => {
  if (!is1dMode.value) return []
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayStr = toLocalDateStr(yesterday)
  return [...moods.value]
    .filter((m) => m.date === yesterdayStr)
    .map((m) => ({
      ...m,
      sortKey: `${m.date} ${m.time ?? '00:00'}`,
    }))
    .sort((a, b) => a.sortKey.localeCompare(b.sortKey))
})

// 移動平均（windowサイズ分の平均。端はそのまま）
const movingAvgWindow = computed(() => selectedRange.value === '1m' ? 7 : 3)

const movingAvgData = computed(() => {
  const dates = allDates.value
  const map = moodMap.value
  const w = movingAvgWindow.value
  return dates.map((_, i) => {
    const slice = dates.slice(Math.max(0, i - w + 1), i + 1)
    const vals = slice.map((d) => map[d]).filter((v): v is number => v != null)
    if (vals.length === 0) return null
    return vals.reduce((a, b) => a + b, 0) / vals.length
  })
})

const warningRanges = computed<WarningRange[]>(() => {
  const ranges: WarningRange[] = []
  const dates = allDates.value
  const map = moodMap.value

  let start: string | null = null
  let count = 0

  for (const date of dates) {
    const level = map[date]
    if (level !== null && level !== undefined && level <= 6) {
      if (!start) start = date
      count++
    } else {
      if (count >= 2 && start) {
        const prevDate = new Date(date)
        prevDate.setDate(prevDate.getDate() - 1)
        ranges.push({
          start: formatLabel(start),
          end: formatLabel(toLocalDateStr(prevDate)),
          days: count,
        })
      }
      start = null
      count = 0
    }
  }
  if (count >= 2 && start) {
    ranges.push({
      start: formatLabel(start),
      end: formatLabel(dates[dates.length - 1]),
      days: count,
    })
  }
  return ranges
})

function formatLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  const days = currentDays.value
  if (days <= 30) {
    return `${d.getMonth() + 1}/${d.getDate()}`
  }
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`
}

function formatTickLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  const days = currentDays.value
  const day = getDayName(d)
  if (days <= 30) {
    return `${d.getMonth() + 1}/${d.getDate()}(${day})`
  }
  if (days <= 365) {
    return `${d.getMonth() + 1}/${d.getDate()}`
  }
  return `${d.getFullYear()}/${d.getMonth() + 1}`
}

function format2dLabel(date: string, time: string | null): string {
  const d = new Date(date + 'T00:00:00')
  const day = getDayName(d)
  const timeStr = time ?? ''
  return `${d.getMonth() + 1}/${d.getDate()}(${day}) ${timeStr}`
}

const warningBackgroundColors = computed(() => {
  const dates = allDates.value
  const map = moodMap.value
  const isWarning = new Array(dates.length).fill(false)
  let runStart = -1

  for (let i = 0; i < dates.length; i++) {
    const level = map[dates[i]]
    if (level !== null && level !== undefined && level <= 6) {
      if (runStart === -1) runStart = i
    } else {
      if (runStart !== -1 && i - runStart >= 2) {
        for (let j = runStart; j < i; j++) isWarning[j] = true
      }
      runStart = -1
    }
  }
  if (runStart !== -1 && dates.length - runStart >= 2) {
    for (let j = runStart; j < dates.length; j++) isWarning[j] = true
  }
  return isWarning
})

// For long ranges, show fewer x-axis labels
const tickStepSize = computed(() => {
  const days = currentDays.value
  if (days <= 14) return 1
  if (days <= 30) return 2
  if (days <= 183) return 14
  if (days <= 365) return 30
  return 90
})

// For long ranges, reduce point size
const pointSize = computed(() => {
  const days = currentDays.value
  if (days <= 30) return 4
  if (days <= 183) return 3
  return 0
})


const chartData = computed<ChartData<'line'>>(() => {
  // 1日モード: 個別エントリを時刻ベースの軸でプロット
  if (is1dMode.value) {
    const entries = sortedMoods1d.value
    const yesterdayEntries = yesterdayMoods1d.value
    const datasets: any[] = []

    // 昨日のデータ（薄く背景に表示）
    if (yesterdayEntries.length > 0) {
      datasets.push({
        label: '昨日',
        data: yesterdayEntries.map((m) => ({
          // 時刻だけ使い、日付を今日に揃えてx軸上に重ねる
          x: new Date(`${todayStr.value}T${m.time ?? '00:00'}:00`).getTime(),
          y: m.level,
        })),
        borderColor: '#007aff33',
        backgroundColor: 'transparent',
        tension: 0.3,
        pointRadius: 3,
        pointBackgroundColor: '#007aff33',
        pointBorderColor: 'transparent',
        pointBorderWidth: 0,
        borderDash: [4, 4],
        spanGaps: true,
        fill: false,
      })
    }

    // 今日のデータ
    datasets.push({
      label: '今日',
      data: entries.map((m) => ({
        x: new Date(`${m.date}T${m.time ?? '00:00'}:00`).getTime(),
        y: m.level,
      })),
      borderColor: '#007aff',
      backgroundColor: '#007aff22',
      tension: 0.3,
      pointRadius: 5,
      pointBackgroundColor: entries.map((m) => moodLevelColor(m.level)),
      pointBorderColor: '#fff',
      pointBorderWidth: 2,
      spanGaps: true,
      fill: false,
    })

    return { datasets } as any
  }

  // 1週間モード: 今週の日平均 + 前週の日平均を薄く重ねる
  if (is1wMode.value) {
    const dates = allDates.value
    const map = moodMap.value
    const datasets: any[] = []

    // 前週のデータ（日平均を計算して今週の日付に揃える）
    const prevWeekMap: Record<string, number | null> = {}
    for (let i = 0; i < dates.length; i++) {
      const prevDate = new Date(dates[i] + 'T00:00:00')
      prevDate.setDate(prevDate.getDate() - 7)
      const prevDateStr = toLocalDateStr(prevDate)
      // moodMapには前週分も含まれている
      prevWeekMap[dates[i]] = map[prevDateStr] ?? null
    }

    const hasPrevWeek = Object.values(prevWeekMap).some((v) => v != null)
    if (hasPrevWeek) {
      datasets.push({
        label: '前週',
        data: dates.map((d) => ({
          x: new Date(d + 'T12:00:00').getTime(),
          y: prevWeekMap[d],
        })),
        borderColor: '#007aff33',
        backgroundColor: 'transparent',
        tension: 0.3,
        pointRadius: 3,
        pointBackgroundColor: '#007aff33',
        pointBorderColor: 'transparent',
        pointBorderWidth: 0,
        borderDash: [4, 4],
        spanGaps: true,
        fill: false,
      })
    }

    // 今週のデータ
    datasets.push({
      label: '今週',
      data: dates.map((d) => ({
        x: new Date(d + 'T12:00:00').getTime(),
        y: map[d] ?? null,
      })),
      borderColor: '#007aff',
      backgroundColor: 'transparent',
      tension: 0.3,
      pointRadius: 5,
      pointBackgroundColor: dates.map((d) => moodLevelColor(map[d])),
      pointBorderColor: '#fff',
      pointBorderWidth: 2,
      spanGaps: true,
      fill: false,
      borderWidth: 2.5,
    })

    return { datasets } as any
  }

  const dates = allDates.value
  const map = moodMap.value
  const warnings = warningBackgroundColors.value
  const mavg = movingAvgData.value

  return {
    labels: dates.map(formatTickLabel),
    datasets: [
      {
        label: '気分',
        data: dates.map((d) => map[d] ?? null) as (number | null)[],
        borderColor: '#007aff44',
        backgroundColor: 'transparent',
        tension: 0.3,
        pointRadius: pointSize.value,
        pointBackgroundColor: dates.map((d) => moodLevelColor(map[d])),
        pointBorderColor: '#fff',
        pointBorderWidth: pointSize.value > 0 ? 2 : 0,
        spanGaps: true,
        fill: false,
      },
      {
        label: '移動平均',
        data: mavg as (number | null)[],
        borderColor: '#007aff',
        backgroundColor: 'transparent',
        tension: 0.4,
        pointRadius: 0,
        spanGaps: true,
        fill: false,
        borderWidth: 2.5,
      },
      {
        label: '注意区間',
        data: dates.map(() => 10.4),
        backgroundColor: dates.map((_, i) =>
          warnings[i] ? 'rgba(255, 235, 59, 0.25)' : 'transparent'
        ),
        borderColor: 'transparent',
        pointRadius: 0,
        fill: {
          target: { value: 0.8 },
        },
      },
    ],
  }
})

// 1週間モード: 日ごとの背景ストライプ
const dayStripePlugin = {
  id: 'dayStripe',
  beforeDraw(chart: any) {
    const xScale = chart.scales.x
    if (!xScale || xScale.type !== 'time') return

    const ctx = chart.ctx
    const { top, bottom } = chart.chartArea
    const dates = allDates.value

    for (let i = 0; i < dates.length; i++) {
      const dayStart = new Date(dates[i] + 'T00:00:00').getTime()
      const dayEnd = new Date(dates[i] + 'T23:59:59').getTime()
      const x1 = xScale.getPixelForValue(dayStart)
      const x2 = xScale.getPixelForValue(dayEnd)

      if (i % 2 === 0) {
        ctx.fillStyle = 'rgba(0, 122, 255, 0.04)'
        ctx.fillRect(x1, top, x2 - x1, bottom - top)
      }
    }
  },
}

// 1日モード: 朝昼夕夜の背景色分け
const timeZonePlugin = {
  id: 'timeZone',
  beforeDraw(chart: any) {
    const xScale = chart.scales.x
    if (!xScale || xScale.type !== 'time') return

    const ctx = chart.ctx
    const { top, bottom } = chart.chartArea
    const base = todayStr.value

    const zones = [
      { start: '06:00', end: '10:00', color: 'rgba(255, 200, 50, 0.08)' },  // 朝
      { start: '10:00', end: '14:00', color: 'rgba(255, 150, 0, 0.08)' },   // 昼
      { start: '14:00', end: '18:00', color: 'rgba(200, 100, 50, 0.08)' },  // 夕
      { start: '18:00', end: '24:00', color: 'rgba(80, 80, 160, 0.08)' },   // 夜
    ]

    for (const zone of zones) {
      const endTime = zone.end === '24:00' ? '23:59:59' : zone.start
      const x1 = xScale.getPixelForValue(new Date(`${base}T${zone.start}:00`).getTime())
      const x2 = zone.end === '24:00'
        ? xScale.getPixelForValue(new Date(`${base}T23:59:59`).getTime())
        : xScale.getPixelForValue(new Date(`${base}T${zone.end}:00`).getTime())
      ctx.fillStyle = zone.color
      ctx.fillRect(x1, top, x2 - x1, bottom - top)
    }
  },
}

const chartPlugins = computed(() => {
  if (is1dMode.value) return [timeZonePlugin]
  if (is1wMode.value) return [dayStripePlugin]
  return []
})

const chartOptions = computed<ChartOptions<'line'>>(() => ({
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    tooltip: {
      callbacks: {
        label: (ctx: any) => {
          const dsLabel = ctx.dataset.label
          // 週/月モードでは注意区間・移動平均のtooltipを非表示
          if (!is1dMode.value && ctx.datasetIndex !== 0) return ''
          const level = ctx.parsed.y
          const rounded = Math.round(level)
          const labelMap: Record<number, string> = { 10: '最高', 9: '最高', 8: '良い', 7: '良い', 6: '普通', 5: '普通', 4: 'いまいち', 3: 'いまいち', 2: 'しんどい', 1: 'しんどい' }
          const moodLabel = labelMap[rounded] ?? ''
          const prefix = is1dMode.value ? `${dsLabel}: ` : ''
          return Number.isInteger(level) ? `${prefix}${level} ${moodLabel}` : `${prefix}${level.toFixed(1)} (${moodLabel})`
        },
      },
      filter: (item: any) => {
        if (is1dMode.value || is1wMode.value) return item.datasetIndex === 0
        return item.datasetIndex === 0
      },
    },
    legend: {
      display: false,
    },
  },
  scales: {
    y: {
      min: 1,
      max: 10,
      ticks: {
        stepSize: 1,
        display: true,
        font: { size: 11 },
        callback: (value: any) => {
          const labels: Record<number, string> = {
            10: '10 最高',
            8: '8 良い',
            6: '6 普通',
            4: '4 いまいち',
            2: '2 しんどい',
          }
          return labels[Number(value)] ?? ''
        },
      },
      grid: {
        color: '#e0e0e0',
      },
    },
    x: is1dMode.value
      ? {
          type: 'time' as const,
          time: {
            unit: 'hour' as const,
            displayFormats: { hour: 'H時' },
            tooltipFormat: 'H:mm',
          },
          min: new Date(todayStr.value + 'T06:00:00').getTime(),
          max: new Date(todayStr.value + 'T00:00:00').getTime() + 24 * 60 * 60 * 1000,
          afterBuildTicks: (axis: any) => {
            const base = todayStr.value
            axis.ticks = [6, 10, 14, 18, 22].map((h) => ({
              value: new Date(`${base}T${String(h).padStart(2, '0')}:00:00`).getTime(),
            }))
          },
          ticks: {
            font: { size: 10 },
          },
          grid: { display: false },
        }
      : is1wMode.value
        ? {
            type: 'time' as const,
            time: {
              unit: 'day' as const,
              displayFormats: { day: 'M/d(eee)' },
              tooltipFormat: 'M/d(eee) H:mm',
            },
            min: new Date(allDates.value[0] + 'T00:00:00').getTime(),
            max: new Date(allDates.value[allDates.value.length - 1] + 'T23:59:59').getTime(),
            afterBuildTicks: (axis: any) => {
              // 各日の12:00にティックを配置してストライプ中央にラベルを置く
              axis.ticks = allDates.value.map((d: string) => ({
                value: new Date(d + 'T12:00:00').getTime(),
              }))
            },
            ticks: {
              maxRotation: 45,
              font: { size: 10 },
              color: (ctx: any) => {
                const d = new Date(ctx.tick.value)
                return getDateColor(d)
              },
            },
            grid: { display: false },
          }
        : {
            ticks: {
              maxRotation: 45,
              font: { size: 10 },
              autoSkip: true,
              maxTicksLimit: Math.ceil(currentDays.value / tickStepSize.value),
              color: (ctx: any) => {
                const dateStr = allDates.value[ctx.index]
                if (!dateStr) return '#6e6e73'
                const d = new Date(dateStr + 'T00:00:00')
                return getDateColor(d)
              },
            },
            grid: { display: false },
          },
  },
}))
</script>

<style scoped>
.graph-page {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.page-title {
  font-size: 20px;
  font-weight: 700;
  text-align: center;
  margin-bottom: 12px;
}

.range-selector {
  display: flex;
  gap: 6px;
  justify-content: center;
  margin-bottom: 16px;
}

.range-btn {
  padding: 8px 14px;
  border: 2px solid #e0e0e0;
  border-radius: 20px;
  background: #fff;
  font-size: 13px;
  font-weight: 500;
  color: #6e6e73;
  cursor: pointer;
  transition: all 0.2s;
  min-height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.range-btn.active {
  background: #007aff;
  color: #fff;
  border-color: #007aff;
}

.range-btn:active {
  transform: scale(0.95);
}

.chart-wrapper {
  width: 100%;
  height: 260px;
  background: #fff;
  border-radius: 16px;
  padding: 16px 8px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
}

.loading,
.error-msg {
  text-align: center;
  padding: 40px 0;
  color: #6e6e73;
}

.error-msg {
  color: #d32f2f;
}

.warnings {
  margin-top: 24px;
  background: #fff8e1;
  border-radius: 12px;
  padding: 16px;
}

.warning-title {
  font-size: 16px;
  font-weight: 700;
  margin-bottom: 4px;
}

.warning-desc {
  font-size: 13px;
  color: #6e6e73;
  margin-bottom: 8px;
}

.warnings ul {
  list-style: none;
  padding: 0;
}

.warnings li {
  font-size: 14px;
  padding: 4px 0;
  color: #856404;
}

.warnings li::before {
  content: '• ';
}
</style>
