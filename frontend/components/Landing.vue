<template>
  <div class="landing">
    <div
      ref="trackEl"
      class="track"
      @scroll.passive="onScroll"
    >
      <!-- 1: 紹介 -->
      <section class="page page-intro">
        <div class="page-inner">
          <span class="hero-emoji">🌤️</span>
          <h1 class="title">きぶんログ</h1>
          <p class="tagline">
            気分を記録して、<br />自分のパターンを見つける。
          </p>
          <p class="swipe-hint">→ スワイプで続く</p>
        </div>
      </section>

      <!-- 2: 機能 (記録) -->
      <section class="page">
        <div class="page-inner">
          <h2 class="page-title">記録する</h2>
          <div class="placeholder">
            <span class="placeholder-emoji">📝</span>
            <span class="placeholder-label">記録画面</span>
          </div>
          <ul class="bullets">
            <li>1-10 段階のスコア + メモ</li>
            <li>場所(自宅・カフェなど)とタグ付け</li>
            <li>写真も一緒に(自動でWebP変換)</li>
          </ul>
        </div>
      </section>

      <!-- 3: 分析 (グラフ・insights) -->
      <section class="page">
        <div class="page-inner">
          <h2 class="page-title">振り返る</h2>
          <div class="placeholder">
            <span class="placeholder-emoji">📈</span>
            <span class="placeholder-label">グラフ画面</span>
          </div>
          <ul class="bullets">
            <li>2週間〜3年の気分推移グラフ</li>
            <li>場所・曜日・時間帯ごとの傾向</li>
            <li>ストリーク・場所マップ</li>
          </ul>
        </div>
      </section>

      <!-- 4: CTA -->
      <section class="page">
        <div class="page-inner cta-inner">
          <h2 class="page-title">触ってみる</h2>
          <button class="btn-primary" :disabled="loading" @click="startDemo">
            {{ loading ? '...' : 'デモを見る' }}
          </button>
          <p class="cta-hint">
            サンプルデータ入りの使い捨てアカウントを発行<br />(画像アップは無効)
          </p>
          <div class="secondary-links">
            <NuxtLink to="/login?mode=register" class="link-button">新規登録</NuxtLink>
            <span class="divider">·</span>
            <NuxtLink to="/login" class="link-button">ログイン</NuxtLink>
          </div>
        </div>
      </section>
    </div>

    <!-- 進捗ドット -->
    <div class="dots">
      <button
        v-for="i in pageCount"
        :key="i"
        class="dot"
        :class="{ active: currentPage === i - 1 }"
        :aria-label="`${i}ページ目へ`"
        @click="goTo(i - 1)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
const config = useRuntimeConfig()
const apiBase = config.public.apiBase
const { setAuth } = useAuth()
const { show: showToast } = useToast()
const router = useRouter()

const pageCount = 4
const currentPage = ref(0)
const trackEl = ref<HTMLDivElement | null>(null)
const loading = ref(false)

function onScroll() {
  const el = trackEl.value
  if (!el) return
  const idx = Math.round(el.scrollLeft / el.clientWidth)
  if (idx !== currentPage.value && idx >= 0 && idx < pageCount) {
    currentPage.value = idx
  }
}

function goTo(idx: number) {
  const el = trackEl.value
  if (!el) return
  el.scrollTo({ left: idx * el.clientWidth, behavior: 'smooth' })
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'ArrowRight') {
    e.preventDefault()
    goTo(Math.min(currentPage.value + 1, pageCount - 1))
  } else if (e.key === 'ArrowLeft') {
    e.preventDefault()
    goTo(Math.max(currentPage.value - 1, 0))
  }
}

onMounted(() => {
  window.addEventListener('keydown', onKeydown)
})
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
})

async function startDemo() {
  loading.value = true
  try {
    const result = await $fetch<{ token: string; username: string }>(
      `${apiBase}/auth/demo`,
      { method: 'POST' }
    )
    setAuth(result.token, result.username)
    router.push('/')
  } catch {
    showToast('デモアカウントの発行に失敗しました', 'error')
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.landing {
  position: relative;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.track {
  flex: 1;
  display: flex;
  overflow-x: auto;
  overflow-y: hidden;
  scroll-snap-type: x mandatory;
  scroll-behavior: smooth;
  scrollbar-width: none;
  -webkit-overflow-scrolling: touch;
}
.track::-webkit-scrollbar {
  display: none;
}

.page {
  flex-shrink: 0;
  width: 100%;
  scroll-snap-align: start;
  scroll-snap-stop: always;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px 16px 56px;
  box-sizing: border-box;
}

.page-inner {
  width: 100%;
  max-width: 520px;
  /* 全ページのカードを同じ高さに揃える。中身が少ないページは上下余白で吸収。 */
  height: 100%;
  max-height: 600px;
  /* スワイプ可能エリアを視覚化する薄い背景。カード状に見えるので「ここを横に動かせる」と分かる */
  background: rgba(255, 255, 255, 0.7);
  border-radius: 20px;
  padding: 32px 24px;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  gap: 20px;
}

.page-intro .page-inner {
  gap: 12px;
}

.hero-emoji {
  font-size: 80px;
  line-height: 1;
}

.title {
  font-size: 36px;
  font-weight: 800;
  letter-spacing: -0.02em;
}

.tagline {
  font-size: 16px;
  line-height: 1.6;
  color: #6e6e73;
  font-weight: 500;
}

.swipe-hint {
  margin-top: 20px;
  font-size: 13px;
  color: #8e8e93;
  animation: hint-fade 1.8s ease-in-out infinite;
}
@keyframes hint-fade {
  0%, 100% { opacity: 0.4; transform: translateX(0); }
  50% { opacity: 1; transform: translateX(4px); }
}

.page-title {
  font-size: 24px;
  font-weight: 700;
  margin-bottom: 4px;
}

.placeholder {
  width: 100%;
  aspect-ratio: 4 / 3;
  background: linear-gradient(135deg, #e5e9f2 0%, #f5f5f7 100%);
  border-radius: 14px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.05);
}

.placeholder-emoji {
  font-size: 48px;
}

.placeholder-label {
  font-size: 12px;
  color: #8e8e93;
}

.bullets {
  list-style: none;
  padding: 0;
  margin: 0;
  text-align: left;
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: 100%;
}

.bullets li {
  font-size: 14px;
  color: #333;
  line-height: 1.5;
  padding-left: 22px;
  position: relative;
}

.bullets li::before {
  content: '•';
  position: absolute;
  left: 8px;
  color: #007aff;
  font-weight: 700;
}

.cta-inner {
  gap: 16px;
}

.btn-primary {
  width: 100%;
  padding: 16px;
  background: #007aff;
  color: #fff;
  border: none;
  border-radius: 14px;
  font-size: 17px;
  font-weight: 700;
  cursor: pointer;
  min-height: 56px;
}
.btn-primary:active {
  background: #005ec4;
}
.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.cta-hint {
  font-size: 12px;
  color: #8e8e93;
  line-height: 1.4;
  margin: 0;
}

.secondary-links {
  display: flex;
  align-items: center;
  gap: 8px;
}

.link-button {
  font-size: 14px;
  color: #007aff;
  text-decoration: none;
  padding: 4px 8px;
}

.divider {
  color: #c7c7cc;
}

.dots {
  position: absolute;
  bottom: 16px;
  left: 0;
  right: 0;
  display: flex;
  justify-content: center;
  gap: 8px;
}

.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #d1d1d6;
  border: none;
  padding: 0;
  cursor: pointer;
  transition: background 0.2s, transform 0.2s;
}

.dot.active {
  background: #007aff;
  transform: scale(1.15);
}
</style>
