<template>
  <div class="record-page">
    <h1 class="page-title">きぶんログ</h1>
    <p class="today-date" :style="{ color: todayColor }">{{ todayLabel }}</p>

    <div v-if="todayMood" class="recorded-status">
      <p class="recorded-label">今日の記録</p>
      <div class="recorded-mood" :style="{ background: moodConfig[todayMood.level]?.bg }">
        <span class="recorded-emoji">{{ moodConfig[todayMood.level]?.emoji }}</span>
        <span class="recorded-text">{{ moodConfig[todayMood.level]?.label }}</span>
      </div>
      <p v-if="todayMood.memo" class="recorded-memo">{{ todayMood.memo }}</p>
      <button class="edit-btn" @click="startEdit">記録を変更する</button>
    </div>

    <div v-else class="mood-buttons">
      <p class="prompt-text">今日の気分は？</p>
      <div class="buttons-row">
        <button
          v-for="opt in moodOptions"
          :key="opt.level"
          class="mood-btn"
          :style="{ background: selectedLevel === opt.level ? opt.bg : '#fff', color: selectedLevel === opt.level ? opt.color : '#333' }"
          :class="{ selected: selectedLevel === opt.level }"
          @click="selectedLevel = opt.level"
        >
          <span class="btn-emoji">{{ opt.emoji }}</span>
          <span class="btn-label">{{ opt.label }}</span>
        </button>
      </div>

      <div v-if="selectedLevel !== null" class="memo-section">
        <textarea
          v-model="memo"
          class="memo-input"
          placeholder="メモ（任意）"
          rows="3"
        />
        <button class="save-btn" :disabled="saving" @click="recordMood">
          {{ saving ? '保存中...' : '記録する' }}
        </button>
      </div>
    </div>

    <p v-if="error" class="error-msg">記録に失敗しました。もう一度お試しください。</p>
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
const { formatWithDay, getDateColor } = useDate()

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

const today = new Date()
const todayStr = today.toISOString().slice(0, 10)
const todayLabel = formatWithDay(today)
const todayColor = getDateColor(today)

const todayMood = ref<Mood | null>(null)
const selectedLevel = ref<number | null>(null)
const memo = ref('')
const saving = ref(false)
const error = ref(false)

onMounted(async () => {
  try {
    const moods = await $fetch<Mood[]>(`${apiBase}/moods`, {
      params: { from_date: todayStr, to_date: todayStr },
      headers: getHeaders(),
    })
    if (moods && moods.length > 0) {
      todayMood.value = moods[0]
    }
  } catch (e) {
    // Not recorded yet
  }
})

function startEdit() {
  selectedLevel.value = todayMood.value?.level ?? null
  memo.value = todayMood.value?.memo ?? ''
  todayMood.value = null
}

async function recordMood() {
  if (selectedLevel.value === null) return
  saving.value = true
  error.value = false
  try {
    const result = await $fetch<Mood>(`${apiBase}/moods`, {
      method: 'POST',
      body: { date: todayStr, level: selectedLevel.value, memo: memo.value || null },
      headers: getHeaders(),
    })
    todayMood.value = result
    selectedLevel.value = null
    memo.value = ''
  } catch (e) {
    error.value = true
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.record-page {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding-top: 32px;
}

.page-title {
  font-size: 32px;
  font-weight: 700;
  margin-bottom: 8px;
}

.today-date {
  font-size: 18px;
  margin-bottom: 40px;
  font-weight: 500;
}

.prompt-text {
  font-size: 20px;
  font-weight: 600;
  margin-bottom: 24px;
  text-align: center;
}

.buttons-row {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  justify-content: center;
}

.mood-btn {
  width: 88px;
  height: 104px;
  border: 2px solid #e0e0e0;
  border-radius: 18px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  cursor: pointer;
  transition: transform 0.15s, box-shadow 0.15s, border-color 0.15s;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}

.mood-btn.selected {
  border-color: #007aff;
  box-shadow: 0 4px 16px rgba(0, 122, 255, 0.3);
  transform: scale(1.08);
}

.mood-btn:active {
  transform: scale(0.95);
}

.btn-emoji {
  font-size: 34px;
}

.btn-label {
  font-size: 13px;
  font-weight: 700;
}

.memo-section {
  margin-top: 28px;
  width: 100%;
  max-width: 360px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.memo-input {
  padding: 14px 16px;
  border: 1px solid #d1d1d6;
  border-radius: 14px;
  font-size: 16px;
  resize: vertical;
  font-family: inherit;
  outline: none;
  transition: border-color 0.2s;
  background: #fff;
}

.memo-input:focus {
  border-color: #007aff;
  box-shadow: 0 0 0 3px rgba(0, 122, 255, 0.1);
}

.save-btn {
  padding: 16px;
  background: #007aff;
  color: #fff;
  border: none;
  border-radius: 14px;
  font-size: 17px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s;
  min-height: 52px;
}

.save-btn:active {
  background: #005ec4;
}

.save-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.recorded-status {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
}

.recorded-label {
  font-size: 18px;
  color: #6e6e73;
  font-weight: 500;
}

.recorded-mood {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 36px 52px;
  border-radius: 24px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
}

.recorded-emoji {
  font-size: 72px;
}

.recorded-text {
  font-size: 22px;
  font-weight: 700;
}

.recorded-memo {
  font-size: 15px;
  color: #6e6e73;
  max-width: 320px;
  text-align: center;
  white-space: pre-wrap;
  line-height: 1.6;
}

.edit-btn {
  margin-top: 12px;
  background: none;
  border: 2px solid #007aff;
  color: #007aff;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  padding: 12px 24px;
  border-radius: 12px;
  min-height: 48px;
  transition: all 0.2s;
}

.edit-btn:active {
  background: #007aff;
  color: #fff;
}

.error-msg {
  margin-top: 24px;
  color: #d32f2f;
  font-size: 14px;
}
</style>
