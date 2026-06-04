<template>
  <div class="auth-page">
    <div class="auth-container">
      <div class="auth-header">
        <h1 class="logo">{{ $t('app.name') }}</h1>
        <p>{{ $t('auth.forgotTitle') }}</p>
      </div>

      <form @submit.prevent="handleReset" class="auth-form" v-if="!sent">
        <p class="desc-text">{{ $t('auth.forgotDesc') }}</p>

        <div class="form-group">
          <label>{{ $t('auth.email') }}</label>
          <input
            v-model="email"
            type="email"
            :placeholder="$t('auth.email')"
            autocomplete="email"
            required
          />
        </div>

        <button type="submit" :disabled="isLoading" class="submit-btn">
          {{ isLoading ? '...' + $t('app.loading') : $t('auth.sendResetBtn') }}
        </button>

        <p v-if="errorMsg" class="error-msg">{{ errorMsg }}</p>
      </form>

      <div v-else class="auth-form success-card">
        <div class="success-icon">&#9993;</div>
        <p>{{ $t('auth.resetSent') }}</p>
        <router-link to="/login" class="back-link">{{ $t('auth.backToLogin') }}</router-link>
      </div>

      <p class="switch-text"><router-link to="/login">{{ $t('auth.backToLogin') }}</router-link></p>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { sendPasswordResetEmail } from '../services/auth'

const email = ref('')
const isLoading = ref(false)
const errorMsg = ref('')
const sent = ref(false)

async function handleReset() {
  if (!email.value) return
  isLoading.value = true
  errorMsg.value = ''

  try {
    const result = await sendPasswordResetEmail(email.value)
    if (result.success) {
      sent.value = true
    } else {
      errorMsg.value = result.error || 'Request failed'
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
.auth-header { text-align: center; margin-bottom: 24px; }
.logo { color: white; font-size: 36px; font-weight: 800; margin: 0 0 8px; letter-spacing: -1px; }
.auth-header p { color: rgba(255,255,255,0.85); font-size: 15px; margin: 0; }
.auth-form { background: white; border-radius: 16px; padding: 28px 24px; box-shadow: 0 10px 40px rgba(0,0,0,0.15); }
.desc-text { color: #6b7280; font-size: 13px; margin: 0 0 18px; text-align: center; }
.form-group { margin-bottom: 18px; }
.form-group label { display: block; font-size: 13px; font-weight: 600; color: #374151; margin-bottom: 6px; }
.form-group input {
  width: 100%; height: 46px; border: 1.5px solid #e5e7eb; border-radius: 10px;
  padding: 0 14px; font-size: 15px; outline: none; transition: border-color 0.2s;
  box-sizing: border-box; font-family: inherit;
}
.form-group input:focus { border-color: #1a56db; box-shadow: 0 0 0 3px rgba(26,86,219,0.08); }
.submit-btn {
  width: 100%; height: 48px; background: linear-gradient(135deg,#f59e0b,#d97706);
  color: white; border: none; border-radius: 10px;
  font-size: 16px; font-weight: 700; cursor: pointer; transition: opacity 0.2s;
}
.submit-btn:disabled { opacity: 0.6; cursor: not-allowed; }
.error-msg { background: #fef2f2; color: #dc2626; padding: 10px 14px; border-radius: 8px; font-size: 13px; margin-top: 12px; text-align: center; }
.success-card { text-align: center; padding: 32px 20px; }
.success-icon { font-size: 48px; margin-bottom: 12px; }
.success-card p { color: #374151; font-size: 15px; margin: 0 0 16px; line-height: 1.5; }
.back-link {
  display: inline-block; padding: 10px 28px;
  background: #1a56db; color: white; border-radius: 8px;
  text-decoration: none; font-weight: 600; font-size: 14px;
}
.switch-text { text-align: center; margin-top: 16px; color: rgba(255,255,255,0.85); font-size: 13px; }
.switch-text a { color: white; font-weight: 600; text-decoration: none; }
</style>
