<template>
  <div class="home-page">
    <!-- Header -->
    <div class="header">
      <div class="header-left">
        <h1>{{ $t('home.greeting', { name: userName }) }}</h1>
      </div>
      <router-link to="/profile" class="avatar-btn">
        <span class="avatar-text">{{ userName.charAt(0).toUpperCase() }}</span>
      </router-link>
    </div>

    <!-- Credits Card -->
    <div class="credits-card">
      <div class="credits-info">
        <p class="credits-label">{{ $t('home.creditsBalance') }}</p>
        <p class="credits-value">{{ credits.balance.toLocaleString() }} <small>{{ $t('home.credits') }}</small></p>
      </div>
      <button class="recharge-btn" @click="navigateTo('/profile')">
        {{ $t('profile.rechargeTitle') }} +
      </button>
    </div>

    <!-- Quick Actions -->
    <section class="section">
      <h2 class="section-title">{{ $t('home.quickActions') }}</h2>
      <div class="quick-actions">
        <button class="action-card blue" @click="navigateTo('/search')">
          <div class="action-icon">&#128269;</div>
          <span>{{ $t('home.searchLeads') }}</span>
          <svg class="arrow-icon" viewBox="0 0 16 16" fill="currentColor"><path d="M6 3l4 4-4 4" stroke="currentColor" stroke-width="2" fill="none"/></svg>
        </button>
        <button class="action-card green" @click="navigateTo('/email')">
          <div class="action-icon">&#9993;</div>
          <span>{{ $t('home.generateEmail') }}</span>
          <svg class="arrow-icon" viewBox="0 0 16 16" fill="currentColor"><path d="M6 3l4 4-4 4" stroke="currentColor" stroke-width="2" fill="none"/></svg>
        </button>
        <button class="action-card orange" @click="navigateTo('/clients')">
          <div class="action-icon">&#128101;</div>
          <span>{{ $t('home.myClients') }}</span>
          <svg class="arrow-icon" viewBox="0 0 16 16" fill="currentColor"><path d="M6 3l4 4-4 4" stroke="currentColor" stroke-width="2" fill="none"/></svg>
        </button>
      </div>
    </section>

    <!-- Today's Stats -->
    <section class="section">
      <h2 class="section-title">{{ $t('home.todayStats') }}</h2>
      <div class="stats-grid">
        <div class="stat-item">
          <p class="stat-value">{{ todayEmails }}</p>
          <p class="stat-label">{{ $t('home.emailsGenerated') }}</p>
        </div>
        <div class="stat-item">
          <p class="stat-value">{{ todayClients }}</p>
          <p class="stat-label">{{ $t('home.clientsFound') }}</p>
        </div>
        <div class="stat-item">
          <p class="stat-value">{{ todaySaved }}</p>
          <p class="stat-label">{{ $t('home.clientsSaved') }}</p>
        </div>
      </div>
    </section>

    <!-- Recent Activity -->
    <section class="section">
      <h2 class="section-title">{{ $t('home.recentActivity') }}</h2>
      <div v-if="recentLogs.length" class="activity-list">
        <div v-for="log in recentLogs" :key="log.id" class="activity-item">
          <span :class="['activity-dot', log.type === 'use' ? 'red' : 'green']"></span>
          <div class="activity-info">
            <p class="activity-action">{{ log.action }}</p>
            <p class="activity-time">{{ formatRelativeTime(log.time) }}</p>
          </div>
          <span :class="['activity-credits', log.type === 'use' ? 'red' : 'green']">
            {{ log.credits > 0 ? '+' : '' }}{{ log.credits }}
          </span>
        </div>
      </div>
      <div v-else class="empty-state">
        <p>{{ $t('home.noActivity') }}</p>
      </div>
    </section>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useCreditsStore } from '../stores/credits'
import { formatRelativeTime } from '../utils/helpers'
import { getStoredUser } from '../services/auth'

const router = useRouter()
const credits = useCreditsStore()
const user = getStoredUser()
const userName = computed(() => (user && user.name) ? user.name.split(' ')[0] : 'User')

function navigateTo(path) {
  router.push(path)
}

const recentLogs = computed(() => credits.usageLogs.slice(0, 5))

// Today's stats
const todayStart = new Date()
todayStart.setHours(0, 0, 0, 0)

const todayEmails = computed(() =>
  credits.usageLogs.filter(l => l.action.includes('Email') && l.time >= todayStart.getTime()).length
)
const todayClients = computed(() =>
  credits.usageLogs.filter(l => (l.action.includes('Client') || l.action.includes('Lead')) && l.time >= todayStart.getTime()).length
)
const todaySaved = computed(() =>
  credits.usageLogs.filter(l => l.action.includes('Save') && l.time >= todayStart.getTime()).length
)
</script>

<style scoped>
.home-page { padding: 20px 16px; }
.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}
.header h1 { font-size: 22px; color: #1f2937; margin: 0; }
.avatar-btn {
  width: 40px; height: 40px;
  border-radius: 50%;
  background: linear-gradient(135deg, #1a56db, #2563eb);
  display: flex; align-items: center; justify-content: center;
  text-decoration: none;
}
.avatar-text { color: #fff; font-weight: 700; font-size: 16px; }

/* Credits Card */
.credits-card {
  background: linear-gradient(135deg, #1a56db, #2563eb);
  border-radius: 14px;
  padding: 18px 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}
.credits-label { color: rgba(255,255,255,0.8); font-size: 13px; margin: 0 0 4px; }
.credits-value { color: #fff; font-size: 28px; font-weight: 700; margin: 0; }
.credits-value small { font-size: 14px; opacity: 0.8; }
.recharge-btn {
  background: rgba(255,255,255,0.2);
  color: white;
  padding: 8px 16px;
  border-radius: 8px;
  border: none;
  text-decoration: none;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}
.recharge-btn:hover { background: rgba(255,255,255,0.35); }

/* Sections */
.section { margin-bottom: 24px; }
.section-title { font-size: 17px; font-weight: 700; color: #1f2937; margin: 0 0 12px; }

/* Quick Actions - reliable click handling for Capacitor WebView */
.quick-actions { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
.action-card {
  background: white;
  border-radius: 12px;
  padding: 16px 8px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  box-shadow: 0 1px 3px rgba(0,0,0,0.06);
  border: none;
  cursor: pointer;
  position: relative;
  transition: transform 0.15s, box-shadow 0.15s;
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
  user-select: none;
  z-index: 1;
}
.action-card:active { transform: scale(0.97); }
.action-card:hover { box-shadow: 0 2px 8px rgba(0,0,0,0.12); }
.action-icon { font-size: 28px; margin-bottom: 6px; }
.action-card span { font-size: 12px; color: #374151; font-weight: 500; }
.arrow-icon {
  position: absolute;
  right: 8px; top: 50%;
  width: 12px; height: 12px;
  opacity: 0.3;
  transform: translateY(-50%);
}

/* Stats */
.stats-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
.stat-item {
  background: white;
  border-radius: 12px;
  padding: 16px;
  text-align: center;
  box-shadow: 0 1px 3px rgba(0,0,0,0.06);
}
.stat-value { font-size: 24px; font-weight: 700; color: #1a56db; margin: 0 0 4px; }
.stat-label { font-size: 11px; color: #6b7280; margin: 0; }

/* Activity */
.activity-list { background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.06); }
.activity-item {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid #f3f4f6;
}
.activity-item:last-child { border-bottom: none; }
.activity-dot {
  width: 8px; height: 8px; border-radius: 50%; margin-right: 10px;
  flex-shrink: 0;
}
.activity-dot.red { background: #ef4444; }
.activity-dot.green { background: #22c55e; }
.activity-info { flex: 1; min-width: 0; }
.activity-action { font-size: 13px; color: #374151; margin: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.activity-time { font-size: 11px; color: #9ca3af; margin: 2px 0 0; }
.activity-credits { font-size: 13px; font-weight: 600; margin-left: 8px; }
.activity-credits.red { color: #ef4444; }
.activity-credits.green { color: #22c55e; }

.empty-state {
  background: white;
  border-radius: 12px;
  padding: 24px;
  text-align: center;
  color: #9ca3af;
}
</style>
