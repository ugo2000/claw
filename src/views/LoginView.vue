<template>
  <div class="auth-page">
    <div class="auth-container">
      <div class="auth-header">
        <h1 class="logo">{{ $t('app.name') }}</h1>
        <p>{{ $t('auth.loginTitle') }}</p>
      </div>

      <form @submit.prevent="handleLogin" class="auth-form">
        <div class="form-group">
          <label>{{ $t('auth.email') }}</label>
          <input
            v-model="form.email"
            type="email"
            :placeholder="$t('auth.email')"
            autocomplete="email"
            required
          />
        </div>

        <div class="form-group">
          <label>{{ $t('auth.password') }}</label>
          <input
            v-model="form.password"
            type="password"
            :placeholder="$t('auth.password')"
            autocomplete="current-password"
            required
          />
        </div>

        <p class="forgot-link"><router-link to="/forgot-password">{{ $t('auth.forgotPassword') }}</router-link></p>

        <button type="submit" :disabled="isLoading" class="submit-btn">
          {{ isLoading ? '...' + $t('app.loading') : $t('auth.loginBtn') }}
        </button>

        <p v-if="errorMsg" class="error-msg">{{ errorMsg }}</p>
        <p class="demo-hint">{{ $t('auth.demoHint') || 'Enter any email & password to start (auto-register)' }}</p>
      </form>

      <p class="switch-text">{{ $t('auth.noAccount') }} <router-link to="/register">{{ $t('auth.registerLink') }}</router-link></p>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { login } from '../services/auth'

const router = useRouter()
const form = reactive({ email: '', password: '' })
const isLoading = ref(false)
const errorMsg = ref('')

async function handleLogin() {
  if (!form.email || !form.password) return
  isLoading.value = true
  errorMsg.value = ''

  try {
    const result = await login(form.email, form.password)
    if (result.error) {
      errorMsg.value = result.error
    } else if (result.user) {
      router.push('/home')
    } else {
      errorMsg.value = 'Login failed'
    }
  } catch (err) {
    errorMsg.value = err.message || 'Connection error'
  }

  isLoading.value = false
}
</script>

<style scoped>
.auth-page {
  min-height: 100vh; display: flex; align-items: center;
  justify-content: center; padding: 24px 16px;
  background: linear-gradient(135deg, #1a56db 0%, #2563eb 50%, #3b82f6 100%);
}
.auth-container { width: 100%; max-width: 400px; }
.auth-header { text-align: center; margin-bottom: 28px; }
.logo { color: white; font-size: 36px; font-weight: 800; margin: 0 0 8px; letter-spacing: -1px; }
.auth-header p { color: rgba(255,255,255,0.85); font-size: 15px; margin: 0; }
.auth-form { background: white; border-radius: 16px; padding: 28px 24px; box-shadow: 0 10px 40px rgba(0,0,0,0.15); }
.form-group { margin-bottom: 18px; }
.form-group label { display: block; font-size: 13px; font-weight: 600; color: #374151; margin-bottom: 6px; }
.form-group input {
  width: 100%; height: 46px; border: 1.5px solid #e5e7eb; border-radius: 10px;
  padding: 0 14px; font-size: 15px; outline: none; transition: border-color 0.2s;
  box-sizing: border-box; font-family: inherit;
}
.form-group input:focus { border-color: #1a56db; box-shadow: 0 0 0 3px rgba(26,86,219,0.08); }
.forgot-link { text-align: right; margin-bottom: 18px; }
.forgot-link a { font-size: 12px; color: #1a56db; text-decoration: none; }
.submit-btn {
  width: 100%; height: 48px; background: linear-gradient(135deg,#1a56db,#2563eb);
  color: white; border: none; border-radius: 10px;
  font-size: 16px; font-weight: 700; cursor: pointer; transition: opacity 0.2s;
}
.submit-btn:disabled { opacity: 0.6; cursor: not-allowed; }
.error-msg { background: #fef2f2; color: #dc2626; padding: 10px 14px; border-radius: 8px; font-size: 13px; margin-top: 12px; text-align: center; }
.demo-hint { text-align: center; font-size: 12px; color: #9ca3af; margin-top: 10px; }
.switch-text { text-align: center; margin-top: 20px; color: rgba(255,255,255,0.85); font-size: 14px; }
.switch-text a { color: white; font-weight: 600; text-decoration: none; }
</style>
