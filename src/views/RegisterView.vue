<template>
  <div class="auth-page">
    <div class="auth-container">
      <div class="auth-header">
        <h1 class="logo">{{ $t('app.name') }}</h1>
        <p>{{ $t('auth.signUpTitle') }}</p>
      </div>

      <form @submit.prevent="handleRegister" class="auth-form">
        <div class="form-group">
          <label>{{ $t('auth.fullName') }}</label>
          <input
            v-model="form.name"
            type="text"
            :placeholder="$t('auth.fullName')"
            autocomplete="name"
            required
          />
        </div>

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
          <div class="password-wrapper">
            <input
              v-model="form.password"
              :type="showPassword ? 'text' : 'password'"
              :placeholder="$t('auth.password')"
              autocomplete="new-password"
              required
              minlength="6"
            />
          </div>
        </div>

        <div class="form-group">
          <label>{{ $t('auth.company') }}</label>
          <input
            v-model="form.company"
            type="text"
            :placeholder="$t('auth.company')"
            autocomplete="organization"
          />
        </div>

        <div class="form-group">
          <label>{{ $t('auth.industry') }}</label>
          <input
            v-model="form.industry"
            type="text"
            :placeholder="$t('auth.industryPlaceholder')"
          />
        </div>

        <button type="submit" :disabled="isLoading" class="submit-btn">
          {{ isLoading ? '...' + $t('app.loading') : $t('auth.registerLink') }}
        </button>

        <p v-if="errorMsg" class="error-msg">{{ errorMsg }}</p>
        <p v-if="successMsg" class="success-msg">{{ successMsg }}</p>
      </form>

      <p class="switch-text">{{ $t('auth.haveAccount') }} <router-link to="/login">{{ $t('auth.loginLink') }}</router-link></p>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { register } from '../services/auth'

const router = useRouter()
const form = reactive({ name: '', email: '', password: '', company: '', industry: '' })
const isLoading = ref(false)
const errorMsg = ref('')
const successMsg = ref('')
const showPassword = ref(false)

async function handleRegister() {
  if (!form.name || !form.email || !form.password) return
  isLoading.value = true
  errorMsg.value = ''
  successMsg.value = ''

  try {
    const result = await register(form.email, form.password, {
      fullName: form.name,
      company: form.company,
      industry: form.industry,
    })
    if (result.success) {
      successMsg.value = 'Registration successful! Redirecting...'
      setTimeout(() => router.push('/home'), 1200)
    } else {
      errorMsg.value = result.error || 'Registration failed'
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
  justify-content: center; padding: 24px 16px; padding-bottom: 40px;
  background: linear-gradient(135deg, #1a56db 0%, #2563eb 50%, #3b82f6 100%);
}
.auth-container { width: 100%; max-width: 400px; }
.auth-header { text-align: center; margin-bottom: 24px; }
.logo { color: white; font-size: 36px; font-weight: 800; margin: 0 0 8px; letter-spacing: -1px; }
.auth-header p { color: rgba(255,255,255,0.85); font-size: 15px; margin: 0; }
.auth-form { background: white; border-radius: 16px; padding: 24px; box-shadow: 0 10px 40px rgba(0,0,0,0.15); max-height: 85vh; overflow-y: auto; }
.form-group { margin-bottom: 14px; }
.form-group label { display: block; font-size: 13px; font-weight: 600; color: #374151; margin-bottom: 5px; }
.form-group input {
  width: 100%; height: 42px; border: 1.5px solid #e5e7eb; border-radius: 10px;
  padding: 0 12px; font-size: 14px; outline: none; transition: border-color 0.2s;
  box-sizing: border-box; font-family: inherit;
}
.form-group input:focus { border-color: #1a56db; box-shadow: 0 0 0 3px rgba(26,86,219,0.08); }
.password-wrapper { position: relative; }
.submit-btn {
  width: 100%; height: 48px; background: linear-gradient(135deg,#22c55e,#16a34a);
  color: white; border: none; border-radius: 10px;
  font-size: 16px; font-weight: 700; cursor: pointer; margin-top: 4px; transition: opacity 0.2s;
}
.submit-btn:disabled { opacity: 0.6; cursor: not-allowed; }
.error-msg { background: #fef2f2; color: #dc2626; padding: 10px 14px; border-radius: 8px; font-size: 13px; margin-top: 10px; text-align: center; }
.success-msg { background: #f0fdf4; color: #15803d; padding: 10px 14px; border-radius: 8px; font-size: 13px; margin-top: 10px; text-align: center; }
.switch-text { text-align: center; margin-top: 16px; color: rgba(255,255,255,0.85); font-size: 14px; }
.switch-text a { color: white; font-weight: 600; text-decoration: none; }
</style>
