<template>
  <Landing v-if="!isLoggedIn" />
  <div v-else class="record-page">
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
              :style="{ height: `${(d.avg / 10) * 100}%`, background: moodLevelColor(d.avg) }"
            ></div>
            <span class="chart-day">{{ d.dayLabel }}</span>
          </div>
        </div>
      </div>

      <!-- 今日の記録一覧 -->
      <div v-if="todayMoods.length > 0" class="today-list">
        <div v-for="m in todayMoodsSorted" :key="m.id" class="today-card">
          <span class="today-card-emoji">{{ moodConfig[m.level]?.emoji }}</span>
          <span class="today-card-time">{{ m.time || '--:--' }}</span>
          <span class="today-card-memo">{{ m.memo || '' }}</span>
        </div>
      </div>

      <!-- 記録ボタン -->
      <button class="add-btn" @click="startAdd">＋ 記録する</button>
    </template>

    <Teleport to="body">
      <MoodForm
        v-if="showMoodForm"
        :initial-level="editingMood?.level"
        :initial-memo="editingMood?.memo"
        :initial-place-id="editingMood?.place_id"
        :initial-has-image="editingMood?.has_image"
        :mood-id="editingMood?.id"
        :saving="saving"
        @submit="onMoodSubmit"
        @close="cancelForm"
      />
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { moodConfig } from '~/composables/useMoodConfig'

interface Mood {
  id: number
  date: string
  time?: string | null
  level: number
  memo?: string | null
  place_id?: number | null
  place_name?: string | null
  has_image?: boolean
}

const config = useRuntimeConfig()
const apiBase = config.public.apiBase
const { getHeaders, isLoggedIn } = useAuth()
const { show: showToast } = useToast()
const { formatWithDay, getDateColor, toLocalDateStr } = useDate()

const today = new Date()
const todayStr = toLocalDateStr(today)
const todayLabel = formatWithDay(today)
const todayColor = getDateColor(today)

const todayMoods = ref<Mood[]>([])
const weekData = ref<{ date: string; avg: number; dayLabel: string }[]>([])
const loading = ref(true)
const saving = ref(false)

const showMoodForm = ref(false)
const editingMood = ref<Mood | null>(null)

const todayMoodsSorted = computed(() => {
  return [...todayMoods.value].sort((a, b) => (b.time ?? '').localeCompare(a.time ?? ''))
})

const avgScore = computed(() => {
  if (todayMoods.value.length === 0) return '0'
  const avg = todayMoods.value.reduce((s, m) => s + m.level, 0) / todayMoods.value.length
  return avg.toFixed(1)
})

const avgMoodConfig = computed(() => {
  const avg = parseFloat(avgScore.value)
  if (avg >= 9) return moodConfig[10]
  if (avg >= 7) return moodConfig[8]
  if (avg >= 5) return moodConfig[6]
  if (avg >= 3) return moodConfig[4]
  if (avg > 0) return moodConfig[2]
  return { emoji: '📝', label: '', bg: '#e0e0e0', color: '#6e6e73' }
})


onMounted(async () => {
  // 未ログイン時はランディングを出すだけなので API リクエストを送らない
  if (!isLoggedIn.value) {
    loading.value = false
    return
  }
  // 直近7日分のデータ取得
  const weekAgo = new Date(today)
  weekAgo.setDate(weekAgo.getDate() - 6)
  const fromDate = toLocalDateStr(weekAgo)

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
      const ds = toLocalDateStr(d)
      const levels = byDate.get(ds)
      if (levels && levels.length > 0) {
        const avg = levels.reduce((s, v) => s + v, 0) / levels.length
        days.push({ date: ds, avg, dayLabel: DAY_NAMES[d.getDay()] })
      } else {
        days.push({ date: ds, avg: 0, dayLabel: DAY_NAMES[d.getDay()] })
      }
    }
    weekData.value = days
  } catch {}
  loading.value = false
})

function startAdd() {
  editingMood.value = null
  showMoodForm.value = true
}

function cancelForm() {
  showMoodForm.value = false
  editingMood.value = null
}

async function onMoodSubmit(data: { level: number; memo: string | null; placeId: number | null; image: File | null }) {
  saving.value = true
  const isEdit = !!editingMood.value
  try {
    let moodId: number | null = null
    if (editingMood.value) {
      const updated = await $fetch<Mood>(`${apiBase}/moods/${editingMood.value.id}`, {
        method: 'PUT',
        body: {
          date: editingMood.value.date,
          time: editingMood.value.time,
          level: data.level,
          memo: data.memo,
          place_id: data.placeId,
        },
        headers: getHeaders(),
      })
      moodId = updated.id
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
          place_id: data.placeId,
        },
        headers: getHeaders(),
      })
      moodId = created.id
      todayMoods.value.push(created)
    }

    showToast(isEdit ? '更新しました' : '記録しました')
    cancelForm()

    // Upload image async (after form closes)
    if (data.image && moodId) {
      const imageId = moodId
      const formData = new FormData()
      formData.append('file', data.image)
      $fetch(`${apiBase}/moods/${imageId}/image`, {
        method: 'POST',
        body: formData,
        headers: getHeaders(),
      }).then(() => {
        const idx = todayMoods.value.findIndex((m) => m.id === imageId)
        if (idx >= 0) todayMoods.value[idx] = { ...todayMoods.value[idx], has_image: true }
        showToast('画像を保存しました')
      }).catch(() => {
        showToast('画像の保存に失敗しました', 'error')
      })
    }
  } catch {
    showToast('保存に失敗しました', 'error')
  }
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

/* 今日の記録一覧 */
.today-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 20px;
}

.today-card {
  display: flex;
  align-items: center;
  gap: 10px;
  background: #fff;
  border-radius: 10px;
  padding: 10px 14px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.05);
}

.today-card-emoji {
  font-size: 20px;
  flex-shrink: 0;
}

.today-card-time {
  font-size: 13px;
  color: #6e6e73;
  flex-shrink: 0;
  min-width: 40px;
}

.today-card-memo {
  font-size: 13px;
  color: #333;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
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
