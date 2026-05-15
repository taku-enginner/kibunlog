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
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.top-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  max-width: 480px;
  margin: 0 auto;
  width: 100%;
}

.user-name {
  font-size: 14px;
  color: #6e6e73;
}

.logout-btn {
  background: none;
  border: none;
  color: #007aff;
  font-size: 14px;
  cursor: pointer;
}

.main-content {
  flex: 1;
  padding: 0 16px 24px;
  padding-bottom: 80px;
  max-width: 480px;
  margin: 0 auto;
  width: 100%;
}

.bottom-nav {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  background: #fff;
  border-top: 1px solid #e0e0e0;
  padding: 8px 0;
  padding-bottom: max(8px, env(safe-area-inset-bottom));
  z-index: 100;
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
  padding: 4px 0;
  transition: color 0.2s;
}

.nav-item.active {
  color: #007aff;
}

.nav-icon {
  font-size: 24px;
}

.nav-label {
  font-weight: 600;
}
</style>
