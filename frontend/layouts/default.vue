<template>
  <div class="app-container">
    <ToastMessage />
    <header v-if="isLoggedIn" class="app-header">
      <span class="app-header-title">kibunrogu</span>
    </header>
    <main class="main-content">
      <slot />
    </main>
    <nav v-if="isLoggedIn" class="bottom-nav">
      <NuxtLink to="/" class="nav-item" :class="{ active: route.path === '/' }">
        <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        <span class="nav-label">記録</span>
      </NuxtLink>
      <NuxtLink to="/graph" class="nav-item" :class="{ active: route.path === '/graph' }">
        <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
        <span class="nav-label">グラフ</span>
      </NuxtLink>
      <NuxtLink to="/timeline" class="nav-item" :class="{ active: route.path === '/timeline' }">
        <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
        <span class="nav-label">履歴</span>
      </NuxtLink>
<NuxtLink to="/insights" class="nav-item" :class="{ active: route.path === '/insights' }">
        <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
        <span class="nav-label">+α</span>
      </NuxtLink>
    </nav>
  </div>
</template>

<script setup lang="ts">
const route = useRoute()
const { isLoggedIn } = useAuth()

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
  touch-action: manipulation;
}
</style>

<style scoped>
.app-container {
  /* height, flex, overflow are in global.css */
}

.main-content {
  /* flex, overflow, padding are in global.css */
}

.app-header {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #fff;
  border-bottom: 1px solid #e0e0e0;
  height: 44px;
  padding-top: env(safe-area-inset-top);
}

.app-header-title {
  font-size: 17px;
  font-weight: 700;
  color: #1d1d1f;
  letter-spacing: -0.3px;
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
  width: 22px;
  height: 22px;
}

.nav-label {
  font-weight: 600;
  font-size: 10px;
}
</style>
