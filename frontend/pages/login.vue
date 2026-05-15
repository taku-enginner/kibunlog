<template>
  <div class="login-page">
    <h1 class="page-title">きぶんログ</h1>
    <p class="sub-text">{{ isRegister ? 'アカウント作成' : 'ログイン' }}</p>

    <form class="login-form" @submit.prevent="submit">
      <input
        v-model="username"
        type="text"
        placeholder="ユーザー名"
        class="input-field"
        autocomplete="username"
      />
      <div class="password-wrapper">
        <input
          v-model="password"
          :type="showPassword ? 'text' : 'password'"
          placeholder="パスワード"
          class="input-field password-input"
          autocomplete="current-password"
        />
        <button type="button" class="toggle-password" @click="showPassword = !showPassword">
          {{ showPassword ? '🙈' : '👁' }}
        </button>
      </div>
      <button type="submit" class="submit-btn" :disabled="loading">
        {{ loading ? '...' : isRegister ? '登録' : 'ログイン' }}
      </button>
    </form>

    <p v-if="error" class="error-msg">{{ error }}</p>

    <button class="toggle-btn" @click="isRegister = !isRegister">
      {{ isRegister ? 'アカウントをお持ちの方はこちら' : '新規登録はこちら' }}
    </button>
  </div>
</template>

<script setup lang="ts">
const config = useRuntimeConfig()
const apiBase = config.public.apiBase
const { setAuth } = useAuth()
const router = useRouter()

const username = ref('')
const password = ref('')
const isRegister = ref(false)
const showPassword = ref(false)
const loading = ref(false)
const error = ref('')

async function submit() {
  loading.value = true
  error.value = ''
  const endpoint = isRegister.value ? '/auth/register' : '/auth/login'
  try {
    const result = await $fetch<{ token: string; username: string }>(
      `${apiBase}${endpoint}`,
      {
        method: 'POST',
        body: { username: username.value, password: password.value },
      }
    )
    setAuth(result.token, result.username)
    router.push('/')
  } catch (e: any) {
    const detail = e?.data?.detail
    if (detail === 'Username already exists') {
      error.value = 'そのユーザー名は既に使われています'
    } else if (detail === 'Invalid username or password') {
      error.value = 'ユーザー名またはパスワードが違います'
    } else {
      error.value = 'エラーが発生しました'
    }
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.login-page {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding-top: 80px;
  min-height: 100vh;
}

.page-title {
  font-size: 32px;
  font-weight: 700;
  margin-bottom: 8px;
}

.sub-text {
  font-size: 16px;
  color: #6e6e73;
  margin-bottom: 40px;
}

.login-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
  width: 100%;
  max-width: 320px;
}

.input-field {
  padding: 14px 16px;
  border: 1px solid #d1d1d6;
  border-radius: 12px;
  font-size: 16px;
  background: #fff;
  outline: none;
  transition: border-color 0.2s;
}

.input-field:focus {
  border-color: #007aff;
}

.password-wrapper {
  position: relative;
}

.password-input {
  width: 100%;
  padding-right: 48px;
}

.toggle-password {
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  font-size: 20px;
  cursor: pointer;
  padding: 8px;
  line-height: 1;
}

.submit-btn {
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

.submit-btn:active {
  background: #005ec4;
}

.submit-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.error-msg {
  margin-top: 16px;
  color: #d32f2f;
  font-size: 14px;
}

.toggle-btn {
  margin-top: 24px;
  background: none;
  border: none;
  color: #007aff;
  font-size: 14px;
  cursor: pointer;
}
</style>
