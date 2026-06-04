<template>
  <nav class="tab-bar" v-show="$route.meta.guest || isAuthenticated">
    <router-link
      v-for="tab in tabs"
      :key="tab.path"
      :to="tab.path"
      class="tab-item"
      :class="{ active: isActive(tab.path) }"
    >
      <span class="tab-icon">{{ tab.icon }}</span>
      <span class="tab-label">{{ $t('nav.' + tab.key) }}</span>
    </router-link>
  </nav>
</template>

<script setup>
import { useRoute } from 'vue-router'
import { isAuthenticated } from '../services/auth'

const route = useRoute()

const tabs = [
  { path: '/home',   key: 'home',    icon: '\u2302' },
  { path: '/search', key: 'search',   icon: '\uD83D\uDD0D' },
  { path: '/email',  key: 'email',    icon: '\u2709' },
  { path: '/clients',key: 'clients',  icon: '\uD83D\uDC65' },
  { path: '/profile',key: 'profile',  icon: '\u{1F464}' },
]

function isActive(path) {
  return route.path.startsWith(path) && path !== '/'
}
</script>

<style scoped>
.tab-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  background: #fff;
  border-top: 1px solid #e5e7eb;
  z-index: 100;
  padding-bottom: env(safe-area-inset-bottom);
}
.tab-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 6px 0 5px;
  text-decoration: none;
  color: #9ca3af;
  font-size: 11px;
  transition: color 0.2s;
}
.tab-item.active {
  color: #1a56db;
}
.tab-icon {
  font-size: 22px;
  line-height: 1.2;
  margin-bottom: 2px;
}
.tab-label {
  font-weight: 500;
}
</style>
