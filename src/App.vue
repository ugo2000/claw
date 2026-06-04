<template>
  <div id="app" class="app-container">
    <!-- Main content area with bottom padding for tab bar -->
    <main class="main-content">
      <!-- Auth pages (no tab bar) -->
      <router-view v-if="isGuestRoute" />

      <!-- App content (requires login) -->
      <template v-else>
        <div v-if="!authReady" class="loading-screen">
          <div class="spinner"></div>
          <p>{{ $t('app.loading') }}</p>
        </div>
        <template v-else>
          <router-view v-if="userLoggedIn" />
          <div v-else class="login-prompt">
            <h2>{{ $t('app.name') }}</h2>
            <p>{{ $t('auth.loginDesc') }}</p>
            <router-link to="/login" class="btn-primary">{{ $t('auth.loginBtn') }}</router-link>
          </div>
        </template>
      </template>
    </main>

    <!-- Tab bar (only show when logged in and on app routes) -->
    <TabBar v-if="userLoggedIn && !isGuestRoute && authReady" />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import TabBar from './components/TabBar.vue'
import * as auth from './services/auth'

const route = useRoute()
const userLoggedIn = ref(false)
const authReady = ref(false)

// Guest routes that don't require auth
const guestRoutes = ['/login', '/register', '/forgot-password']
const isGuestRoute = computed(() => guestRoutes.includes(route.path))

function checkAuth() {
  const stored = auth.getStoredUser()
  userLoggedIn.value = !!stored
}

onMounted(async () => {
  // Initial check
  checkAuth()
  authReady.value = true
})

// Re-check auth whenever route changes (catches login/logout navigation)
watch(() => route.path, () => {
  if (!isGuestRoute.value || !!auth.getStoredUser()) {
    checkAuth()
  }
})
</script>

<style scoped>
.app-container {
  min-height: 100vh;
  background: #f5f7fa;
}
.main-content {
  max-width: 480px;
  margin: 0 auto;
  padding-bottom: 70px;
  min-height: 100vh;
}
.loading-screen {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 80vh;
  color: #6b7280;
}
.spinner {
  width: 36px;
  height: 36px;
  border: 3px solid #e5e7eb;
  border-top-color: #1a56db;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
@keyframes spin {
  to { transform: rotate(360deg); }
}
.login-prompt {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 80vh;
  padding: 24px;
  text-align: center;
}
.login-prompt h2 {
  font-size: 24px;
  color: #1a56db;
  margin-bottom: 8px;
}
.login-prompt p {
  color: #6b7280;
  margin-bottom: 20px;
}
.btn-primary {
  display: inline-block;
  padding: 12px 32px;
  background: linear-gradient(135deg, #1a56db, #2563eb);
  color: white;
  border-radius: 10px;
  text-decoration: none;
  font-weight: 600;
  font-size: 15px;
}
</style>
