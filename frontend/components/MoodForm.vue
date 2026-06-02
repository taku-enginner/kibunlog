<template>
  <div class="overlay" @click.self="$emit('close')">
    <div class="sheet">
      <div class="sheet-header">
        <span class="sheet-title">気分を記録</span>
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

      <!-- 場所 (折り返しチップ + + 新規) -->
      <div class="section">
        <p class="section-label">場所</p>
        <div class="chips">
          <button
            v-for="p in places"
            :key="p.id"
            class="chip"
            :class="{ active: selectedPlaceId === p.id }"
            @click="togglePlace(p.id)"
          >
            {{ p.name }}
          </button>
          <button class="chip chip-add" @click="showAddModal = true">＋ 新規</button>
        </div>
      </div>

      <textarea
        v-model="memo"
        class="memo-input"
        placeholder="メモ（任意）"
        rows="4"
      />

      <!-- 画像追加 -->
      <div class="image-section">
        <button v-if="!imagePreview" class="image-add-btn" @click="triggerFileInput">
          📷 写真を追加
        </button>
        <div v-else class="image-preview-wrap">
          <img :src="imagePreview" class="image-preview" />
          <button v-if="existingImage" class="image-rotate-btn" :disabled="rotating" @click="rotateImage">↻</button>
          <button class="image-remove-btn" @click="removeImage">✕</button>
        </div>
        <input
          ref="fileInput"
          type="file"
          accept="image/*"
          class="image-file-input"
          @change="onFileSelected"
        />
      </div>

      <button
        class="save-btn"
        :disabled="selectedLevel === null || saving"
        @click="submit"
      >
        {{ saving ? '保存中...' : '記録する' }}
      </button>
    </div>

    <!-- 新規場所ミニモーダル -->
    <div v-if="showAddModal" class="add-modal-backdrop" @click.self="cancelAdd">
      <div class="add-modal">
        <p class="add-modal-title">新しい場所</p>
        <input
          v-model="newPlaceName"
          type="text"
          class="add-modal-input"
          placeholder="場所の名前"
          autofocus
          @keydown.enter="confirmAdd"
          @keydown.esc="cancelAdd"
        />
        <div class="add-modal-actions">
          <button class="add-modal-cancel" @click="cancelAdd">キャンセル</button>
          <button class="add-modal-confirm" :disabled="!newPlaceName.trim() || adding" @click="confirmAdd">
            {{ adding ? '...' : '追加' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
interface Place {
  id: number
  name: string
  latitude: number | null
  longitude: number | null
}

const props = defineProps<{
  initialLevel?: number | null
  initialMemo?: string | null
  initialPlaceId?: number | null
  initialHasImage?: boolean
  moodId?: number | null
  saving: boolean
}>()

const emit = defineEmits<{
  submit: [data: { level: number; memo: string | null; placeId: number | null; image: File | null }]
  close: []
}>()

const config = useRuntimeConfig()
const apiBase = config.public.apiBase
const { getHeaders } = useAuth()
const { show: showToast } = useToast()

const selectedLevel = ref<number | null>(props.initialLevel ?? null)
const memo = ref(props.initialMemo ?? '')
const selectedPlaceId = ref<number | null>(props.initialPlaceId ?? null)
const selectedImage = ref<File | null>(null)
const imagePreview = ref<string | null>(null)
const existingImage = ref(false)
const rotating = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)

const places = ref<Place[]>([])
const showAddModal = ref(false)
const newPlaceName = ref('')
const adding = ref(false)

onMounted(async () => {
  try {
    places.value = await $fetch<Place[]>(`${apiBase}/places`, {
      headers: getHeaders(),
    })
  } catch {
    // 場所一覧の取得失敗は致命的ではない (場所なしで保存できる)
  }
})

// Load existing thumbnail if editing a mood with image
if (props.initialHasImage && props.moodId) {
  existingImage.value = true
  $fetch(`${apiBase}/moods/${props.moodId}/image/thumb?t=${Date.now()}`, {
    headers: getHeaders(),
    responseType: 'blob',
  }).then((blob: Blob) => {
    imagePreview.value = URL.createObjectURL(blob)
  }).catch(() => {})
}

function togglePlace(placeId: number) {
  // 同じチップタップで解除 (場所なし状態にする)、別チップタップで切り替え
  selectedPlaceId.value = selectedPlaceId.value === placeId ? null : placeId
}

function cancelAdd() {
  showAddModal.value = false
  newPlaceName.value = ''
}

async function confirmAdd() {
  const name = newPlaceName.value.trim()
  if (!name || adding.value) return
  adding.value = true
  try {
    const created = await $fetch<Place>(`${apiBase}/places`, {
      method: 'POST',
      body: { name },
      headers: getHeaders(),
    })
    // 既に同名 Place があると backend が既存を返す (重複チェック)。
    // 一覧に未追加なら足して、追加した場所を選択状態にする
    if (!places.value.find((p) => p.id === created.id)) {
      places.value.push(created)
    }
    selectedPlaceId.value = created.id
    cancelAdd()
  } catch {
    showToast('場所の追加に失敗しました', 'error')
  } finally {
    adding.value = false
  }
}

function triggerFileInput() {
  fileInput.value?.click()
}

function onFileSelected(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  selectedImage.value = file
  imagePreview.value = URL.createObjectURL(file)
}

function removeImage() {
  if (imagePreview.value) {
    URL.revokeObjectURL(imagePreview.value)
  }
  selectedImage.value = null
  imagePreview.value = null
  existingImage.value = false
  if (fileInput.value) fileInput.value.value = ''
}

async function rotateImage() {
  if (!props.moodId || rotating.value) return
  rotating.value = true
  try {
    await $fetch(`${apiBase}/moods/${props.moodId}/image/rotate`, {
      method: 'POST',
      headers: getHeaders(),
    })
    if (imagePreview.value) {
      URL.revokeObjectURL(imagePreview.value)
    }
    const blob = await $fetch<Blob>(`${apiBase}/moods/${props.moodId}/image/thumb?t=${Date.now()}`, {
      headers: getHeaders(),
      responseType: 'blob',
    })
    imagePreview.value = URL.createObjectURL(blob)
  } catch {
    showToast('回転に失敗しました', 'error')
  }
  rotating.value = false
}

function submit() {
  if (selectedLevel.value === null) return
  emit('submit', {
    level: selectedLevel.value,
    memo: memo.value || null,
    placeId: selectedPlaceId.value,
    image: selectedImage.value,
  })
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
  font-size: 17px;
  font-weight: 700;
  color: #333;
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

.section {
  margin-bottom: 14px;
}

.section-label {
  font-size: 12px;
  color: #6e6e73;
  margin-bottom: 6px;
  font-weight: 600;
}

.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.chip {
  padding: 6px 12px;
  background: #f5f5f7;
  border: 1px solid transparent;
  border-radius: 16px;
  font-size: 13px;
  color: #333;
  cursor: pointer;
}

.chip.active {
  background: #007aff;
  color: #fff;
}

.chip-add {
  background: #fff;
  border: 1px dashed #c7c7cc;
  color: #007aff;
  font-weight: 600;
}

.chip-add:active {
  background: #f0f0f0;
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

.image-section {
  margin-bottom: 12px;
}

.image-add-btn {
  background: none;
  border: 1px dashed #d1d1d6;
  border-radius: 10px;
  padding: 10px 16px;
  font-size: 14px;
  color: #007aff;
  cursor: pointer;
  width: 100%;
}

.image-file-input {
  display: none;
}

.image-preview-wrap {
  position: relative;
  display: inline-block;
}

.image-preview {
  width: 80px;
  height: 80px;
  object-fit: cover;
  border-radius: 10px;
  border: 1px solid #e0e0e0;
}

.image-remove-btn {
  position: absolute;
  top: -6px;
  right: -6px;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: #d32f2f;
  color: #fff;
  border: none;
  font-size: 12px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
}

.image-rotate-btn {
  position: absolute;
  bottom: -6px;
  right: -6px;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.55);
  color: #fff;
  border: none;
  font-size: 14px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
}

.image-rotate-btn:disabled {
  opacity: 0.4;
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

.add-modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  z-index: 300;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.add-modal {
  background: #fff;
  border-radius: 14px;
  padding: 18px 18px 14px;
  width: 100%;
  max-width: 320px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.18);
}

.add-modal-title {
  font-size: 15px;
  font-weight: 700;
  margin-bottom: 10px;
  color: #333;
}

.add-modal-input {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid #d1d1d6;
  border-radius: 10px;
  font-size: 15px;
  outline: none;
  margin-bottom: 14px;
}

.add-modal-input:focus {
  border-color: #007aff;
}

.add-modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.add-modal-cancel,
.add-modal-confirm {
  padding: 8px 16px;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  border: none;
}

.add-modal-cancel {
  background: #f5f5f7;
  color: #333;
}

.add-modal-confirm {
  background: #007aff;
  color: #fff;
}

.add-modal-confirm:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
</style>
