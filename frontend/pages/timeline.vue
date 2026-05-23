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
            @click="openDetail(mood)"
          >
            <div class="card-header">
              <span class="card-place">
                <span v-if="mood.time" class="card-time">{{ mood.time }}</span>
                {{ mood.place_name || '場所なし' }}
              </span>
              <span class="card-header-right">
                <button
                  v-if="mood.has_image"
                  class="image-icon-btn"
                  @click.stop="openImageViewer(mood.id)"
                >📷</button>
                <span class="card-mood" :style="{ color: moodConfig[mood.level]?.color }">
                  {{ moodConfig[mood.level]?.emoji }} {{ moodConfig[mood.level]?.label }}
                </span>
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

      <!-- 日付フィルター -->
      <div v-if="filterDate" class="date-filter-bar">
        <span class="date-filter-label">{{ formatDate(filterDate) }} の記録を表示中</span>
        <button class="date-filter-clear" @click="clearDateFilter">✕</button>
      </div>

      <!-- 画像DLボタン -->
      <div v-if="hasAnyImage && !downloadMode" class="download-start-row">
        <button class="download-start-btn" @click="enterDownloadMode">画像DL</button>
      </div>
      <div v-if="downloadMode" class="download-mode-bar">
        <button class="download-cancel-btn" @click="exitDownloadMode">キャンセル</button>
        <button
          class="download-exec-btn"
          :disabled="selectedDownloadIds.length === 0 || downloading"
          @click="executeDownload"
        >
          {{ downloading ? 'DL中...' : `ダウンロード (${selectedDownloadIds.length})` }}
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
          @click="!downloadMode ? openHistoryDetail(mood) : undefined"
        >
          <!-- Download mode checkbox -->
          <label v-if="downloadMode && mood.has_image" class="download-checkbox-wrap">
            <input
              type="checkbox"
              :checked="selectedDownloadIds.includes(mood.id)"
              @change="toggleDownloadSelect(mood.id)"
            />
          </label>
          <div class="timeline-dot" :style="{ background: moodConfig[mood.level]?.bg }">
            <span class="dot-emoji">{{ moodConfig[mood.level]?.emoji }}</span>
          </div>
          <div class="timeline-content">
            <div class="timeline-header">
              <span class="timeline-date" :style="{ color: getDateColor(new Date(mood.date + 'T00:00:00')) }">
                {{ formatDate(mood.date) }}<span v-if="mood.time" class="timeline-time"> {{ mood.time }}</span>
              </span>
              <span class="timeline-header-right">
                <button
                  v-if="mood.has_image"
                  class="image-icon-btn"
                  @click.stop="openImageViewer(mood.id)"
                >📷</button>
                <span class="timeline-level" :style="{ color: moodConfig[mood.level]?.color }">
                  {{ moodConfig[mood.level]?.label }}
                </span>
              </span>
            </div>
            <p v-if="mood.place_name" class="timeline-place">{{ mood.place_name }}</p>
            <p v-if="mood.memo" class="timeline-memo">{{ mood.memo }}</p>
            <p v-else class="timeline-no-memo">メモなし</p>
          </div>
          <button v-if="!downloadMode" class="timeline-delete-btn" @click.stop="deleteMood(mood.id)">✕</button>
        </div>
      </div>
    </template>

    <!-- Detail View Overlay (today tab) -->
    <Teleport to="body">
      <div
        v-if="detailMood"
        class="detail-overlay"
        @click.self="closeDetail"
        @touchstart="onDetailTouchStart"
        @touchend="onDetailTouchEnd"
      >
        <div class="detail-view">
          <div class="detail-view-header">
            <button class="detail-close-btn" @click="closeDetail">✕</button>
            <span class="detail-view-counter" v-if="detailListIds.length > 1">
              {{ detailListIds.indexOf(detailMood.id) + 1 }} / {{ detailListIds.length }}
            </span>
            <button class="detail-edit-btn" @click="editFromDetail">編集</button>
          </div>

          <div class="detail-view-body">
            <div class="detail-view-mood" :style="{ color: moodConfig[detailMood.level]?.color }">
              {{ moodConfig[detailMood.level]?.emoji }} {{ moodConfig[detailMood.level]?.label }}
            </div>
            <div class="detail-view-meta">
              <span class="detail-view-date">{{ formatDate(detailMood.date) }}</span>
              <span v-if="detailMood.time" class="detail-view-time">{{ detailMood.time }}</span>
              <span class="detail-view-place">{{ detailMood.place_name || '���所なし' }}</span>
            </div>
            <p v-if="detailMood.memo" class="detail-view-memo">{{ detailMood.memo }}</p>
            <p v-else class="detail-view-memo detail-view-no-memo">メモなし</p>

            <!-- 画像 -->
            <div v-if="detailMood.has_image" class="detail-view-image">
              <div v-if="detailImageLoading" class="detail-image-spinner">読み込み中...</div>
              <img v-else-if="detailImageUrl" :src="detailImageUrl" class="detail-img" />
            </div>
          </div>

          <div v-if="detailListIds.length > 1" class="detail-swipe-hint">← スワイプで前後に移動 →</div>
        </div>
      </div>
    </Teleport>

    <!-- Image Viewer Overlay -->
    <Teleport to="body">
      <div
        v-if="viewingImageMoodId !== null"
        class="image-viewer-overlay"
        @click.self="closeImageViewer"
        @touchstart="onViewerTouchStart"
        @touchend="onViewerTouchEnd"
      >
        <div class="image-viewer-content">
          <button class="image-viewer-close" @click="closeImageViewer">✕</button>
          <button v-if="imageListIds.length > 1" class="image-nav-btn image-nav-prev" @click="navigateImage('prev')">‹</button>
          <div v-if="imageLoading" class="image-viewer-spinner">読み込み中...</div>
          <img
            v-else-if="viewingImageUrl"
            :src="viewingImageUrl"
            class="image-viewer-img"
          />
          <button v-if="imageListIds.length > 1" class="image-nav-btn image-nav-next" @click="navigateImage('next')">›</button>
          <div v-if="imageListIds.length > 1" class="image-viewer-counter">
            {{ imageListIds.indexOf(viewingImageMoodId!) + 1 }} / {{ imageListIds.length }}
          </div>
        </div>
      </div>
    </Teleport>

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
        :initial-has-image="editingMood?.has_image"
        :mood-id="editingMood?.id"
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
  has_image?: boolean
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
const { show: showToast } = useToast()
const { getDayName, getDateColor, formatWithDay, toLocalDateStr } = useDate()


const today = new Date()
const todayStr = toLocalDateStr(today)
const todayLabel = formatWithDay(today)
const todayColor = getDateColor(today)

const route = useRoute()
const activeTab = ref<'today' | 'history'>('today')
const allMoods = ref<Mood[]>([])
const loading = ref(true)
const saving = ref(false)
const filterLevel = ref<number | null>(null)
const filterDate = ref<string | null>(null)
const deleteMode = ref(false)

// Image viewer state
const viewingImageMoodId = ref<number | null>(null)
const viewingImageUrl = ref<string | null>(null)
const imageLoading = ref(false)
const imageListIds = ref<number[]>([]) // ordered list of mood IDs with images for swipe nav

const { onTouchStart: onViewerTouchStart, onTouchEnd: onViewerTouchEnd } = useSwipeDetect(
  () => navigateImage('next'),
  () => navigateImage('prev'),
)

// Detail view state (today tab)
const detailMood = ref<Mood | null>(null)
const detailListIds = ref<number[]>([])
const { onTouchStart: onDetailTouchStart, onTouchEnd: onDetailTouchEnd } = useSwipeDetect(
  () => navigateDetail('next'),
  () => navigateDetail('prev'),
)
const detailImageUrl = ref<string | null>(null)
const detailImageLoading = ref(false)

// Download mode state
const downloadMode = ref(false)
const selectedDownloadIds = ref<number[]>([])
const downloading = ref(false)

const hasAnyImage = computed(() => allMoods.value.some((m) => m.has_image))

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
  let result = historyMoods.value
  if (filterDate.value) {
    result = result.filter((m) => m.date === filterDate.value)
  }
  if (filterLevel.value !== null) {
    result = result.filter((m) => m.level === filterLevel.value)
  }
  return result
})

onMounted(async () => {
  // クエリパラメータで日付指定がある場合、履歴タブ＋日付フィルター
  if (route.query.date) {
    activeTab.value = 'history'
    filterDate.value = route.query.date as string
  }
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

async function onMoodSubmit(data: { level: number; memo: string | null; image: File | null }) {
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

      showToast('更新しました')
      cancelForm()

      // Upload image async (after form closes)
      if (data.image) {
        const imageId = updated.id
        const formData = new FormData()
        formData.append('file', data.image)
        $fetch(`${apiBase}/moods/${imageId}/image`, {
          method: 'POST',
          body: formData,
          headers: getHeaders(),
        }).then(() => {
          const moodIdx = allMoods.value.findIndex((m) => m.id === imageId)
          if (moodIdx >= 0) allMoods.value[moodIdx] = { ...allMoods.value[moodIdx], has_image: true }
          showToast('画像を保存しました')
        }).catch(() => {
          showToast('画像の保存に失敗しました', 'error')
        })
      }
    } else {
      showToast('更新しました')
      cancelForm()
    }
  } catch {
    showToast('保存に失敗しました', 'error')
  }
  saving.value = false
}

function clearDateFilter() {
  filterDate.value = null
}

function toggleDeleteMode() {
  deleteMode.value = !deleteMode.value
}

async function deleteMood(id: number) {
  if (!confirm('この記録を削除しますか？')) return
  try {
    await $fetch(`${apiBase}/moods/${id}`, {
      method: 'DELETE',
      headers: getHeaders(),
    })
    allMoods.value = allMoods.value.filter((m) => m.id !== id)
    showToast('削除しました')
  } catch {
    showToast('削除に失敗しました', 'error')
  }
}

// --- Image viewer ---
function openImageViewer(moodId: number) {
  // Build ordered list of image-bearing mood IDs from current view context
  const sourceList = activeTab.value === 'today' ? todayMoods.value : filteredMoods.value
  imageListIds.value = sourceList.filter((m) => m.has_image).map((m) => m.id)
  loadImage(moodId)
}

async function loadImage(moodId: number) {
  if (viewingImageUrl.value) {
    URL.revokeObjectURL(viewingImageUrl.value)
  }
  viewingImageMoodId.value = moodId
  viewingImageUrl.value = null
  imageLoading.value = true
  try {
    const blob = await $fetch<Blob>(`${apiBase}/moods/${moodId}/image?t=${Date.now()}`, {
      headers: getHeaders(),
      responseType: 'blob',
    })
    viewingImageUrl.value = URL.createObjectURL(blob)
  } catch {
    viewingImageUrl.value = null
  }
  imageLoading.value = false
}

function navigateImage(direction: 'prev' | 'next') {
  if (imageListIds.value.length <= 1) return
  const currentIdx = imageListIds.value.indexOf(viewingImageMoodId.value!)
  if (currentIdx < 0) return
  let nextIdx = direction === 'next' ? currentIdx + 1 : currentIdx - 1
  if (nextIdx >= imageListIds.value.length) nextIdx = 0
  if (nextIdx < 0) nextIdx = imageListIds.value.length - 1
  loadImage(imageListIds.value[nextIdx])
}


function closeImageViewer() {
  if (viewingImageUrl.value) {
    URL.revokeObjectURL(viewingImageUrl.value)
  }
  viewingImageMoodId.value = null
  viewingImageUrl.value = null
  imageListIds.value = []
}

// --- Detail view ---
function openDetail(mood: Mood) {
  if (deleteMode.value) return
  detailListIds.value = todayMoods.value.map((m) => m.id)
  showDetailForMood(mood)
}

function openHistoryDetail(mood: Mood) {
  detailListIds.value = filteredMoods.value.map((m) => m.id)
  showDetailForMood(mood)
}

async function showDetailForMood(mood: Mood) {
  detailMood.value = mood
  // Load image if available
  if (detailImageUrl.value) {
    URL.revokeObjectURL(detailImageUrl.value)
    detailImageUrl.value = null
  }
  if (mood.has_image) {
    detailImageLoading.value = true
    try {
      const blob = await $fetch<Blob>(`${apiBase}/moods/${mood.id}/image?t=${Date.now()}`, {
        headers: getHeaders(),
        responseType: 'blob',
      })
      detailImageUrl.value = URL.createObjectURL(blob)
    } catch {
      detailImageUrl.value = null
    }
    detailImageLoading.value = false
  }
}

function closeDetail() {
  if (detailImageUrl.value) {
    URL.revokeObjectURL(detailImageUrl.value)
  }
  detailMood.value = null
  detailImageUrl.value = null
  detailListIds.value = []
}

function editFromDetail() {
  const mood = detailMood.value
  if (!mood) return
  closeDetail()
  startEdit(mood)
}

function navigateDetail(direction: 'prev' | 'next') {
  if (!detailMood.value || detailListIds.value.length <= 1) return
  const currentIdx = detailListIds.value.indexOf(detailMood.value.id)
  if (currentIdx < 0) return
  let nextIdx = direction === 'next' ? currentIdx + 1 : currentIdx - 1
  if (nextIdx >= detailListIds.value.length) nextIdx = 0
  if (nextIdx < 0) nextIdx = detailListIds.value.length - 1
  const nextMood = allMoods.value.find((m) => m.id === detailListIds.value[nextIdx])
  if (nextMood) showDetailForMood(nextMood)
}


// --- Download mode ---
function enterDownloadMode() {
  downloadMode.value = true
  selectedDownloadIds.value = []
}

function exitDownloadMode() {
  downloadMode.value = false
  selectedDownloadIds.value = []
}

function toggleDownloadSelect(id: number) {
  const idx = selectedDownloadIds.value.indexOf(id)
  if (idx >= 0) {
    selectedDownloadIds.value.splice(idx, 1)
  } else {
    selectedDownloadIds.value.push(id)
  }
}

async function executeDownload() {
  if (selectedDownloadIds.value.length === 0) return
  downloading.value = true
  try {
    const blob = await $fetch<Blob>(`${apiBase}/moods/images/download`, {
      method: 'POST',
      body: { mood_ids: selectedDownloadIds.value },
      headers: getHeaders(),
      responseType: 'blob',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'mood_images.zip'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    exitDownloadMode()
  } catch {}
  downloading.value = false
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
.date-filter-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #e3f2fd;
  border-radius: 8px;
  padding: 8px 12px;
  margin-bottom: 12px;
}

.date-filter-label {
  font-size: 13px;
  font-weight: 600;
  color: #1565c0;
}

.date-filter-clear {
  background: none;
  border: none;
  font-size: 16px;
  color: #1565c0;
  cursor: pointer;
  padding: 2px 6px;
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

.timeline-time {
  font-size: 13px;
  font-weight: 500;
  color: #6e6e73;
}

.timeline-delete-btn {
  flex-shrink: 0;
  align-self: center;
  background: none;
  border: none;
  color: #ccc;
  font-size: 16px;
  cursor: pointer;
  padding: 8px;
  line-height: 1;
  transition: color 0.2s;
}

.timeline-delete-btn:active {
  color: #d32f2f;
}

/* Image icon */
.card-header-right {
  display: flex;
  align-items: center;
  gap: 6px;
}

.timeline-header-right {
  display: flex;
  align-items: center;
  gap: 6px;
}

.image-icon-btn {
  background: none;
  border: none;
  font-size: 16px;
  cursor: pointer;
  padding: 2px 4px;
  line-height: 1;
}

/* Image viewer overlay */
.image-viewer-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.85);
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
}

.image-viewer-content {
  position: relative;
  max-width: 90vw;
  max-height: 90vh;
  display: flex;
  align-items: center;
  justify-content: center;
}

.image-viewer-close {
  position: absolute;
  top: -40px;
  right: 0;
  background: none;
  border: none;
  color: #fff;
  font-size: 28px;
  cursor: pointer;
  padding: 8px;
  z-index: 1;
}

.image-viewer-spinner {
  color: #fff;
  font-size: 16px;
}

.image-viewer-img {
  max-width: 90vw;
  max-height: 75vh;
  border-radius: 8px;
  object-fit: contain;
}

.image-nav-btn {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  background: rgba(255, 255, 255, 0.8);
  border: none;
  font-size: 32px;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #333;
}

.image-nav-prev {
  left: 12px;
}

.image-nav-next {
  right: 12px;
}

.image-viewer-counter {
  position: absolute;
  bottom: 16px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(0, 0, 0, 0.6);
  color: #fff;
  font-size: 13px;
  padding: 4px 12px;
  border-radius: 12px;
}

/* Download mode */
.download-start-row {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 8px;
}

.download-start-btn {
  background: #007aff;
  color: #fff;
  border: none;
  border-radius: 8px;
  padding: 6px 14px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}

.download-mode-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
  margin-bottom: 8px;
  gap: 12px;
}

.download-cancel-btn {
  background: none;
  border: 1px solid #d1d1d6;
  border-radius: 8px;
  padding: 6px 14px;
  font-size: 13px;
  font-weight: 500;
  color: #6e6e73;
  cursor: pointer;
}

.download-exec-btn {
  background: #007aff;
  color: #fff;
  border: none;
  border-radius: 8px;
  padding: 8px 16px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}

.download-exec-btn:disabled {
  opacity: 0.5;
}

.download-checkbox-wrap {
  flex-shrink: 0;
  align-self: center;
  display: flex;
  align-items: center;
  padding-right: 4px;
}

.download-checkbox-wrap input[type="checkbox"] {
  width: 20px;
  height: 20px;
  cursor: pointer;
}

/* Detail View Overlay */
.detail-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 9998;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.detail-view {
  background: #fff;
  border-radius: 16px;
  width: 100%;
  max-width: 400px;
  height: 70vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.detail-view-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid #eee;
  flex-shrink: 0;
}

.detail-close-btn {
  background: none;
  border: none;
  font-size: 20px;
  color: #666;
  cursor: pointer;
  padding: 4px 8px;
}

.detail-view-counter {
  font-size: 13px;
  color: #999;
}

.detail-edit-btn {
  background: #007aff;
  color: #fff;
  border: none;
  border-radius: 8px;
  padding: 6px 14px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}

.detail-view-body {
  padding: 20px;
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.detail-view-mood {
  font-size: 28px;
  font-weight: 700;
  margin-bottom: 12px;
  flex-shrink: 0;
}

.detail-view-meta {
  display: flex;
  gap: 12px;
  font-size: 14px;
  color: #666;
  margin-bottom: 12px;
  flex-shrink: 0;
}

.detail-view-time {
  font-weight: 600;
}

.detail-view-place {
  color: #888;
}

.detail-view-memo {
  font-size: 15px;
  line-height: 1.6;
  color: #333;
  white-space: pre-wrap;
  flex: 1;
  overflow-y: auto;
  min-height: 0;
  margin-bottom: 8px;
}

.detail-view-no-memo {
  color: #ccc;
  font-style: italic;
}

.detail-view-image {
  flex-shrink: 0;
  height: 200px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-top: 8px;
}

.detail-image-spinner {
  color: #999;
  font-size: 13px;
}

.detail-img {
  max-width: 100%;
  max-height: 200px;
  border-radius: 8px;
  object-fit: contain;
}

.detail-swipe-hint {
  text-align: center;
  font-size: 12px;
  color: #bbb;
  padding: 8px;
  border-top: 1px solid #eee;
  flex-shrink: 0;
}
</style>
