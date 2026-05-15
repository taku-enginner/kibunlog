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
      <Line :key="selectedRange" :data="chartData" :options="chartOptions" />
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
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Filler,
} from 'chart.js'
import type { ChartData, ChartOptions } from 'chart.js'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Filler)

interface Mood {
  date: string
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
  { key: '2w', label: '2週間', days: 14 },
  { key: '1m', label: '1ヶ月', days: 30 },
  { key: '6m', label: '半年', days: 183 },
  { key: '1y', label: '1年', days: 365 },
  { key: '3y', label: '3年', days: 1095 },
]

const selectedRange = ref('1m')
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
    from.setDate(from.getDate() - (currentDays.value - 1))
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

const moodMap = computed(() => {
  const sums: Record<string, { total: number; count: number }> = {}
  for (const m of moods.value) {
    if (!sums[m.date]) sums[m.date] = { total: 0, count: 0 }
    sums[m.date].total += m.level
    sums[m.date].count++
  }
  const map: Record<string, number | null> = {}
  for (const [date, s] of Object.entries(sums)) {
    map[date] = Math.round(s.total / s.count)
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

const warningRanges = computed<WarningRange[]>(() => {
  const ranges: WarningRange[] = []
  const dates = allDates.value
  const map = moodMap.value

  let start: string | null = null
  let count = 0

  for (const date of dates) {
    const level = map[date]
    if (level !== null && level !== undefined && level <= 3) {
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

const warningBackgroundColors = computed(() => {
  const dates = allDates.value
  const map = moodMap.value
  const isWarning = new Array(dates.length).fill(false)
  let runStart = -1

  for (let i = 0; i < dates.length; i++) {
    const level = map[dates[i]]
    if (level !== null && level !== undefined && level <= 3) {
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
  const dates = allDates.value
  const map = moodMap.value
  const warnings = warningBackgroundColors.value

  return {
    labels: dates.map(formatTickLabel),
    datasets: [
      {
        label: '気分',
        data: dates.map((d) => map[d] ?? null) as (number | null)[],
        borderColor: '#007aff',
        backgroundColor: '#007aff22',
        tension: 0.3,
        pointRadius: pointSize.value,
        pointBackgroundColor: dates.map((d) => {
          const level = map[d]
          if (level === 5) return '#1b5e20'
          if (level === 4) return '#28a745'
          if (level === 3) return '#ffc107'
          if (level === 2) return '#dc3545'
          if (level === 1) return '#491217'
          return '#ccc'
        }),
        pointBorderColor: '#fff',
        pointBorderWidth: pointSize.value > 0 ? 2 : 0,
        spanGaps: true,
        fill: false,
      },
      {
        label: '注意区間',
        data: dates.map(() => 5.2),
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

const chartOptions = computed<ChartOptions<'line'>>(() => ({
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    tooltip: {
      callbacks: {
        label: (ctx: any) => {
          if (ctx.datasetIndex === 1) return ''
          const level = ctx.parsed.y
          if (level === 5) return '最高'
          if (level === 4) return '良い'
          if (level === 3) return '普通'
          if (level === 2) return 'いまいち'
          if (level === 1) return 'しんどい'
          return ''
        },
      },
      filter: (item: any) => item.datasetIndex === 0,
    },
    legend: {
      display: false,
    },
  },
  scales: {
    y: {
      min: 0.5,
      max: 5.5,
      ticks: {
        stepSize: 1,
        callback: (value: any) => {
          if (value === 5) return '😆 最高'
          if (value === 4) return '😊 良い'
          if (value === 3) return '😐 普通'
          if (value === 2) return '😣 いまいち'
          if (value === 1) return '😵 しんどい'
          return ''
        },
      },
      grid: {
        color: '#e0e0e0',
      },
    },
    x: {
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
      grid: {
        display: false,
      },
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
  flex: 1;
  min-height: 0;
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
