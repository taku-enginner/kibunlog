<template>
  <div class="toast-container">
    <TransitionGroup name="toast">
      <div
        v-for="toast in toasts"
        :key="toast.id"
        class="toast"
        :class="toast.type"
      >
        {{ toast.message }}
      </div>
    </TransitionGroup>
  </div>
</template>

<script setup lang="ts">
const { toasts } = useToast()
</script>

<style scoped>
.toast-container {
  position: fixed;
  top: 12px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 99999;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  pointer-events: none;
}

.toast {
  padding: 10px 20px;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 600;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.15);
  pointer-events: auto;
}

.toast.success {
  background: #e8f5e9;
  color: #2e7d32;
}

.toast.error {
  background: #ffebee;
  color: #c62828;
}

.toast-enter-active {
  transition: all 0.3s ease;
}

.toast-leave-active {
  transition: all 0.2s ease;
}

.toast-enter-from {
  opacity: 0;
  transform: translateY(-20px);
}

.toast-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}
</style>
