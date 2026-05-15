<template>
  <div class="overlay" @click.self="$emit('close')">
    <div class="sheet">
      <div class="sheet-header">
        <span class="sheet-title">{{ placeName || '気分を記録' }}</span>
        <button class="close-btn" @click="$emit('close')">✕</button>
      </div>

      <div class="buttons-row">
        <button
          v-for="opt in moodOptions"
          :key="opt.level"
          class="mood-btn"
          :style="{
            background: selectedLevel === opt.level ? opt.bg : '#fff',
            color: selectedLevel === opt.level ? opt.color : '#333',
          }"
          :class="{ selected: selectedLevel === opt.level }"
          @click="selectedLevel = opt.level"
        >
          <span class="btn-emoji">{{ opt.emoji }}</span>
          <span class="btn-label">{{ opt.label }}</span>
        </button>
      </div>

      <textarea
        v-model="memo"
        class="memo-input"
        placeholder="メモ（任意）"
        rows="4"
      />

      <button
        class="save-btn"
        :disabled="selectedLevel === null || saving"
        @click="submit"
      >
        {{ saving ? '保存中...' : '記録する' }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  placeName?: string
  initialLevel?: number | null
  initialMemo?: string | null
  saving: boolean
}>()

const emit = defineEmits<{
  submit: [data: { level: number; memo: string | null }]
  close: []
}>()

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

const selectedLevel = ref<number | null>(props.initialLevel ?? null)
const memo = ref(props.initialMemo ?? '')

function submit() {
  if (selectedLevel.value === null) return
  emit('submit', { level: selectedLevel.value, memo: memo.value || null })
}
</script>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  z-index: 200;
  display: flex;
  align-items: flex-end;
  justify-content: center;
}

.sheet {
  background: #fff;
  border-radius: 20px 20px 0 0;
  width: 100%;
  max-width: 480px;
  padding: 20px 16px;
  padding-bottom: max(20px, env(safe-area-inset-bottom));
}

.sheet-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.sheet-title {
  font-size: 18px;
  font-weight: 700;
}

.close-btn {
  background: none;
  border: none;
  font-size: 18px;
  color: #6e6e73;
  cursor: pointer;
  padding: 8px;
}

.buttons-row {
  display: flex;
  gap: 8px;
  justify-content: center;
  margin-bottom: 16px;
}

.mood-btn {
  width: 60px;
  height: 74px;
  border: 2px solid #e0e0e0;
  border-radius: 16px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  cursor: pointer;
  transition: transform 0.15s, box-shadow 0.15s;
}

.mood-btn.selected {
  border-color: #007aff;
  box-shadow: 0 3px 12px rgba(0, 122, 255, 0.3);
  transform: scale(1.08);
}

.btn-emoji {
  font-size: 24px;
}

.btn-label {
  font-size: 10px;
  font-weight: 700;
}

.memo-input {
  width: 100%;
  padding: 10px 14px;
  border: 1px solid #d1d1d6;
  border-radius: 12px;
  font-size: 15px;
  resize: none;
  font-family: inherit;
  outline: none;
  background: #fff;
  margin-bottom: 12px;
}

.memo-input:focus {
  border-color: #007aff;
}

.save-btn {
  width: 100%;
  padding: 14px;
  background: #007aff;
  color: #fff;
  border: none;
  border-radius: 12px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  min-height: 48px;
}

.save-btn:disabled {
  opacity: 0.5;
}
</style>
