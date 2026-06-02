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
                :style="{ height: d.avg > 0 ? `${(d.avg / 10) * 100}%` : '2px', background: scoreColor(d.avg) }"
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
                :style="{ height: t.avg > 0 ? `${(t.avg / 10) * 100}%` : '2px', background: scoreColor(t.avg) }"
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
          <div v-for="(p, i) in placeRanking" :key="p.name" class="ranking-item" @click="openPlaceHistory(p.name)">
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
                <th v-for="slot in TIME_SLOTS" :key="slot.label">{{ slot.label }}</th>
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
                :style="{ height: f.avg > 0 ? `${(f.avg / 10) * 100}%` : '2px', background: scoreColor(f.avg) }"
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

    <!-- ログアウト -->
    <div class="logout-area">
      <button class="logout-link" @click="handleLogout">ログアウト</button>
    </div>

    <!-- 場所別履歴モーダル -->
    <Teleport to="body">
      <div
        v-if="placeHistoryName"
        class="place-history-overlay"
        @click.self="closePlaceHistory"
      >
        <div class="place-history-modal">
          <div class="place-history-header">
            <button class="place-history-close" @click="closePlaceHistory">✕</button>
            <span class="place-history-title">「{{ placeHistoryName }}」の記録 ({{ placeHistoryMoods.length }}件)</span>
          </div>
          <div class="place-history-body">
            <div
              v-for="m in placeHistoryMoods"
              :key="m.id"
              class="place-history-item"
            >
              <div class="place-history-item-header">
                <span class="place-history-date">{{ formatMoodDate(m.date) }}<span v-if="m.time"> {{ m.time }}</span></span>
                <span class="place-history-level" :style="{ color: scoreColor(m.level) }">
                  {{ moodEmoji(m.level) }} {{ moodLabel(m.level) }}
                </span>
              </div>
              <p v-if="m.memo" class="place-history-memo">{{ m.memo }}</p>
              <p v-else class="place-history-memo place-history-no-memo">メモなし</p>
              <button class="place-history-day-btn" @click="goToDayTimeline(m.date)">その日の履歴を見る</button>
            </div>
            <p v-if="placeHistoryMoods.length === 0" class="place-history-empty">記録がありません</p>
          </div>
        </div>
      </div>
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


const moods = ref<Mood[]>([])
const loading = ref(true)

// insights専用: 平均スコアの色（低スコアはグレー）
function scoreColor(avg: number): string {
  const { best, good, neutral } = MOOD_THRESHOLDS
  if (avg >= best) return '#1b5e20'
  if (avg >= good) return '#28a745'
  if (avg >= neutral) return '#ffc107'
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

const {
  thisWeekAvg, thisWeekCount, lastWeekAvg, lastWeekCount,
  dayOfWeekStats, timeSlotStats, placeRanking,
  currentStreak, maxStreak, missedDays,
  dayTimeMatrix, placeDayMatrix,
  intradayPattern, frequencyMoodStats, lowScoreStreaks,
} = useInsightsStats(moods)

const dayNamesOrdered = ['月', '火', '水', '木', '金', '土', '日']

// --- 場所別履歴モーダル ---
const placeHistoryName = ref<string | null>(null)

const placeHistoryMoods = computed(() => {
  if (!placeHistoryName.value) return []
  return moods.value
    .filter((m) => m.place_name === placeHistoryName.value)
    .sort((a, b) => b.date.localeCompare(a.date) || (b.time ?? '').localeCompare(a.time ?? ''))
})

function openPlaceHistory(name: string) {
  placeHistoryName.value = name
}

function closePlaceHistory() {
  placeHistoryName.value = null
}

function formatMoodDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return `${d.getMonth() + 1}/${d.getDate()}(${DAY_NAMES[d.getDay()]})`
}


function goToDayTimeline(dateStr: string) {
  closePlaceHistory()
  router.push({ path: '/timeline', query: { date: dateStr } })
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

/* 場所別履歴モーダル */
.place-history-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 9998;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.place-history-modal {
  background: #fff;
  border-radius: 16px;
  width: 100%;
  max-width: 400px;
  height: 70vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.place-history-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  border-bottom: 1px solid #eee;
  flex-shrink: 0;
}

.place-history-close {
  background: none;
  border: none;
  font-size: 20px;
  color: #666;
  cursor: pointer;
  padding: 4px 8px;
}

.place-history-title {
  font-size: 15px;
  font-weight: 700;
  color: #333;
}

.place-history-body {
  flex: 1;
  overflow-y: auto;
  padding: 12px 16px;
}

.place-history-item {
  padding: 12px 0;
  border-bottom: 1px solid #f0f0f0;
}

.place-history-item:last-child {
  border-bottom: none;
}

.place-history-item-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
}

.place-history-date {
  font-size: 13px;
  color: #666;
  font-weight: 600;
}

.place-history-level {
  font-size: 13px;
  font-weight: 700;
}

.place-history-memo {
  font-size: 14px;
  line-height: 1.5;
  color: #333;
  white-space: pre-wrap;
  margin: 4px 0 8px;
}

.place-history-no-memo {
  color: #ccc;
  font-style: italic;
}

.place-history-day-btn {
  background: none;
  border: 1px solid #007aff;
  border-radius: 6px;
  color: #007aff;
  font-size: 12px;
  font-weight: 600;
  padding: 4px 10px;
  cursor: pointer;
}

.place-history-day-btn:active {
  background: #007aff;
  color: #fff;
}

.place-history-empty {
  text-align: center;
  color: #999;
  font-size: 14px;
  padding: 40px 0;
}

.ranking-item {
  cursor: pointer;
}

.ranking-item:active {
  background: #f0f0f5;
}
</style>
