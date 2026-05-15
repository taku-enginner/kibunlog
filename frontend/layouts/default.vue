<template>
  <div class="app-container">
    <header v-if="isLoggedIn" class="top-bar">
      <span class="user-name">{{ authState.username }}</span>
      <button class="logout-btn" @click="handleLogout">ログアウト</button>
    </header>
    <main class="main-content">
      <slot />
    </main>
    <nav v-if="isLoggedIn" class="bottom-nav">
      <NuxtLink to="/" class="nav-item" :class="{ active: route.path === '/' }">
        <span class="nav-icon">📝</span>
        <span class="nav-label">記録</span>
      </NuxtLink>
      <NuxtLink to="/graph" class="nav-item" :class="{ active: route.path === '/graph' }">
        <span class="nav-icon">📊</span>
        <span class="nav-label">グラフ</span>
      </NuxtLink>
      <NuxtLink to="/timeline" class="nav-item" :class="{ active: route.path === '/timeline' }">
        <span class="nav-icon">📋</span>
        <span class="nav-label">履歴</span>
      </NuxtLink>
      <NuxtLink to="/map" class="nav-item" :class="{ active: route.path === '/map' }">
        <span class="nav-icon">🗺️</span>
        <span class="nav-label">マップ</span>
      </NuxtLink>
    </nav>
  </div>
</template>

<script setup lang="ts">
const route = useRoute()
const router = useRouter()
const { authState, isLoggedIn, logout } = useAuth()

function handleLogout() {
  logout()
  router.push('/login')
}
</script>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Hiragino Sans', 'Hiragino Kaku Gothic ProN', sans-serif;
  background: #f5f5f7;
  color: #1d1d1f;
  -webkit-font-smoothing: antialiased;
}
</style>

<style scoped>
.app-container {
  /* height, flex, overflow are in global.css */
}

.top-bar {
  flex-shrink: 0;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 16px;
  max-width: 480px;
  margin: 0 auto;
  width: 100%;
}

.user-name {
  font-size: 15px;
  color: #6e6e73;
  font-weight: 500;
}

.logout-btn {
  background: none;
  border: none;
  color: #007aff;
  font-size: 15px;
  cursor: pointer;
  padding: 8px 12px;
  min-height: 44px;
  display: flex;
  align-items: center;
}

.main-content {
  /* flex, overflow, padding are in global.css */
}

.bottom-nav {
  flex-shrink: 0;
  display: flex;
  background: #fff;
  border-top: 1px solid #e0e0e0;
  padding: 8px 0;
  padding-bottom: max(8px, env(safe-area-inset-bottom));
}

.nav-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  text-decoration: none;
  color: #8e8e93;
  font-size: 10px;
  padding: 6px 0;
  min-height: 52px;
  justify-content: center;
  transition: color 0.2s;
}

.nav-item.active {
  color: #007aff;
}

.nav-icon {
  font-size: 22px;
}

.nav-label {
  font-weight: 600;
  font-size: 10px;
}
</style>
