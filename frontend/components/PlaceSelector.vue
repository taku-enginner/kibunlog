<template>
  <div class="overlay" @click.self="$emit('close')">
    <div class="sheet">
      <div class="sheet-header">
        <span class="sheet-title">場所を選択</span>
        <button class="close-btn" @click="$emit('close')">✕</button>
      </div>

      <!-- 新規追加 -->
      <div class="add-row">
        <input
          v-model="newName"
          type="text"
          placeholder="新しい場所名"
          class="add-input"
          @keydown.enter="addPlace"
        />
        <button class="add-btn" :disabled="!newName.trim() || adding" @click="addPlace">
          {{ adding ? '...' : '追加' }}
        </button>
      </div>

      <!-- 既存場所一覧 -->
      <div v-if="places.length > 0" class="registered">
        <p class="section-label">登録済みの場所</p>
        <div
          v-for="place in places"
          :key="place.id"
          class="place-item-row"
        >
          <button class="place-item" @click="$emit('select', place)">
            {{ place.name }}
          </button>
          <button class="place-delete-btn" @click="deletePlace(place.id)">✕</button>
        </div>
      </div>
      <p v-else class="empty-hint">まだ登録された場所はありません</p>
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

const emit = defineEmits<{
  select: [place: Place]
  close: []
}>()

const config = useRuntimeConfig()
const apiBase = config.public.apiBase
const { getHeaders } = useAuth()
const { show: showToast } = useToast()

const places = ref<Place[]>([])
const newName = ref('')
const adding = ref(false)

onMounted(async () => {
  try {
    places.value = await $fetch<Place[]>(`${apiBase}/places`, {
      headers: getHeaders(),
    })
  } catch {}
})

async function addPlace() {
  const name = newName.value.trim()
  if (!name) return
  adding.value = true
  try {
    const place = await $fetch<Place>(`${apiBase}/places`, {
      method: 'POST',
      body: { name },
      headers: getHeaders(),
    })
    emit('select', place)
  } catch {
    showToast('場所の追加に失敗しました', 'error')
  } finally {
    adding.value = false
  }
}

async function deletePlace(placeId: number) {
  if (!confirm('この場所を削除しますか？')) return
  try {
    await $fetch(`${apiBase}/places/${placeId}`, {
      method: 'DELETE',
      headers: getHeaders(),
    })
    places.value = places.value.filter((p) => p.id !== placeId)
    showToast('場所を削除しました')
  } catch {
    showToast('削除に失敗しました', 'error')
  }
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
  max-height: 85vh;
  overflow-y: auto;
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

.add-row {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}

.add-input {
  flex: 1;
  padding: 12px 14px;
  border: 1px solid #d1d1d6;
  border-radius: 12px;
  font-size: 15px;
  outline: none;
  background: #fff;
}

.add-input:focus {
  border-color: #007aff;
}

.add-btn {
  padding: 0 18px;
  background: #007aff;
  color: #fff;
  border: none;
  border-radius: 12px;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
}

.add-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.section-label {
  font-size: 13px;
  font-weight: 600;
  color: #6e6e73;
  margin-bottom: 8px;
}

.registered {
  margin-top: 4px;
}

.empty-hint {
  text-align: center;
  font-size: 13px;
  color: #8e8e93;
  padding: 24px 0;
}

.place-item-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}

.place-item {
  flex: 1;
  text-align: left;
  padding: 12px;
  background: #fff;
  border: 1px solid #e0e0e0;
  border-radius: 10px;
  font-size: 15px;
  cursor: pointer;
}

.place-item:active {
  background: #f0f0f0;
}

.place-delete-btn {
  flex-shrink: 0;
  width: 32px;
  height: 32px;
  background: none;
  border: 1px solid #e0e0e0;
  border-radius: 50%;
  font-size: 14px;
  color: #999;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.place-delete-btn:active {
  background: #fee;
  color: #d32f2f;
  border-color: #d32f2f;
}
</style>
