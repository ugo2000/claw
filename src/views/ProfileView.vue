<template>
  <div class="profile-page">
    <!-- User Info Card -->
    <div class="user-card">
      <div class="user-avatar">
        <span>{{ userName.charAt(0).toUpperCase() }}</span>
      </div>
      <div class="user-info">
        <h2>{{ userName }}</h2>
        <p v-if="userCompany">{{ userCompany }}</p>
        <p class="member-since">{{ $t('profile.memberSince', { date: '2024-06-04' }) }}</p>
      </div>
    </div>

    <!-- Language Settings -->
    <section class="settings-section">
      <h3>{{ $t('profile.language') }}</h3>
      <div class="lang-options">
        <button
          class="lang-btn"
          :class="{ active: currentLocale === 'en' }"
          @click="switchLanguage('en')"
        >
          {{ $t('profile.langEnglish') }}
        </button>
        <button
          class="lang-btn"
          :class="{ active: currentLocale === 'zh' }"
          @click="switchLanguage('zh')"
        >
          {{ $t('profile.langChinese') }}
        </button>
      </div>
    </section>

    <!-- Credits Balance -->
    <section class="credits-section">
      <h3>{{ $t('profile.rechargeTitle') }}</h3>
      <div class="balance-display">
        {{ $t('profile.currentBalance') }} <strong>{{ credits.balance.toLocaleString() }}</strong> {{ $t('home.credits') }}
      </div>

      <!-- Recharge Packages -->
      <div class="packages-grid">
        <div
          v-for="(pkg, key) in packages" :key="key"
          class="package-card"
          :class="{ popular: pkg.popular }"
        >
          <span v-if="pkg.popular" class="popular-badge">{{ $t('profile.popular') }}</span>
          <h4>{{ $t(`profile.${key}Pack`) || pkg.label }}</h4>
          <p class="package-price">&yen;{{ pkg.price }}</p>
          <p class="package-credits">{{ pkg.credits.toLocaleString() }} {{ $t('home.credits') }}</p>
          <button class="buy-btn" @click="buyPackage(key, pkg)">
            {{ $t('profile.buyBtn') }}
          </button>
        </div>
      </div>
    </section>

    <!-- Usage History -->
    <section class="history-section">
      <h3>{{ $t('profile.usageHistory') }}</h3>
      <div v-if="credits.usageLogs.length" class="history-list">
        <div v-for="log in credits.usageLogs" :key="log.id" class="history-item">
          <div class="history-left">
            <span :class="['type-dot', log.type]"></span>
            <div class="history-detail">
              <p class="log-action">{{ log.action }}</p>
              <p class="log-time">{{ formatRelativeTime(log.time) }}</p>
            </div>
          </div>
          <span :class="['log-credits', log.type === 'use' ? 'minus' : 'plus']">
            {{ log.credits > 0 ? '+' : '' }}{{ log.credits }}
          </span>
        </div>
      </div>
      <div v-else class="empty-history">
        <p>{{ $t('profile.noUsage') }}</p>
      </div>
    </section>

    <!-- Logout -->
      <button class="logout-btn" @click="handleLogout">
        {{ $t('auth.logout') }}
      </button>

      <!-- Payment Modal -->
      <PaymentModal
        v-if="showPayment"
        :pkg="payingPkg"
        :package-key="payingKey"
        @close="showPayment = false"
        @success="onPaymentSuccess"
      />
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useCreditsStore } from '../stores/credits'
import { getStoredUser } from '../services/auth'
import { logout as authLogout } from '../services/auth'
import { setLanguage } from '../i18n'
import PaymentModal from '../components/PaymentModal.vue'

const router = useRouter()
const { t, locale } = useI18n()
const credits = useCreditsStore()

const currentLocale = computed(() => locale.value)

const user = getStoredUser()
const userName = computed(() => (user && user.name) ? user.name.split(' ')[0] : 'User')
const userCompany = user?.company || ''

function switchLanguage(lang) {
  setLanguage(lang)
}

// Recharge packages — keys must match credits.js getPricePerCredit()
const packages = {
  trial:     { label: 'Starter Pack',   price: 9.9,   credits: 100,   popular: false },
  basic:     { label: 'Standard Pack',  price: 49,    credits: 600,   popular: false },
  pro:       { label: 'Pro Pack',       price: 99,    credits: 1500,  popular: true },
  premium:   { label: 'Enterprise Pack',price: 199,   credits: 3500,  popular: false },
}

const showPayment = ref(false)
const payingKey = ref('')
const payingPkg = ref({})

function buyPackage(key, pkg) {
  payingKey.value = key
  payingPkg.value = pkg
  showPayment.value = true
}

function onPaymentSuccess(result) {
  // 支付成功回调（信任模式下积分已到账）
  console.log('Payment success:', result)
}

async function handleLogout() {
  await authLogout()
  localStorage.removeItem('claw_local_user')
  router.push('/login')
}

function formatRelativeTime(timestamp) {
  const diff = Date.now() - timestamp
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return t ? 'Just now' : 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(timestamp).toLocaleDateString()
}
</script>

<style scoped>
.profile-page { padding: 20px 16px; padding-bottom: 30px; }

/* User Card */
.user-card {
  display: flex; align-items: center; gap: 16px;
  background: linear-gradient(135deg, #1a56db, #2563eb);
  border-radius: 14px; padding: 20px; margin-bottom: 20px;
}
.user-avatar {
  width: 56px; height: 56px; border-radius: 50%;
  background: rgba(255,255,255,0.25); display: flex;
  align-items: center; justify-content: center;
}
.user-avatar span { font-size: 24px; color: white; font-weight: 700; }
.user-info h2 { color: white; font-size: 18px; margin: 0 0 2px; }
.user-info p { color: rgba(255,255,255,0.8); font-size: 13px; margin: 0; }
.member-since { color: rgba(255,255,255,0.6) !important; font-size: 11px !important; margin-top: 4px !important; }

/* Settings */
.settings-section { background: white; border-radius: 12px; padding: 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.06); margin-bottom: 18px; }
.settings-section h3 { font-size: 15px; font-weight: 700; color: #1f2937; margin: 0 0 10px; }
.lang-options { display: flex; gap: 8px; }
.lang-btn {
  flex: 1; padding: 10px; border: 1.5px solid #e5e7eb; border-radius: 8px;
  background: white; font-size: 14px; cursor: pointer;
  transition: all 0.2s; color: #6b7280; font-weight: 500;
}
.lang-btn.active { border-color: #1a56db; background: #eff6ff; color: #1a56db; }

/* Credits */
.credits-section { background: white; border-radius: 12px; padding: 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.06); margin-bottom: 18px; }
.credits-section h3 { font-size: 15px; font-weight: 700; color: #1f2937; margin: 0 0 12px; }
.balance-display { text-align: center; font-size: 15px; color: #374151; margin-bottom: 16px; }
.balance-display strong { font-size: 28px; color: #1a56db; }
.packages-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; }
.package-card {
  position: relative; background: #f9fafb; border: 2px solid transparent;
  border-radius: 12px; padding: 14px; text-align: center;
}
.package-card.popular { border-color: #1a56db; background: #eff6ff; }
.popular-badge {
  position: absolute; top: -8px; left: 50%; transform: translateX(-50%);
  background: #1a56db; color: white; font-size: 10px; font-weight: 600;
  padding: 2px 10px; border-radius: 10px;
}
.package-card h4 { font-size: 14px; color: #374151; margin: 0 0 6px; }
.package-price { font-size: 22px; font-weight: 700; color: #1f2937; margin: 0 0 2px; }
.package-credits { font-size: 12px; color: #6b7280; margin: 0 0 10px; }
.buy-btn {
  width: 100%; padding: 8px; background: #1a56db; color: white;
  border: none; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer;
}

/* History */
.history-section { background: white; border-radius: 12px; padding: 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.06); margin-bottom: 18px; }
.history-section h3 { font-size: 15px; font-weight: 700; color: #1f2937; margin: 0 0 12px; }
.history-list { max-height: 300px; overflow-y: auto; }
.history-item {
  display: flex; justify-content: space-between; align-items: center;
  padding: 10px 0; border-bottom: 1px solid #f3f4f6;
}
.history-item:last-child { border-bottom: none; }
.history-left { display: flex; align-items: center; gap: 8px; flex: 1; min-width: 0; }
.type-dot {
  width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0;
}
.type-use { background: #ef4444; }
.type-recharge { background: #22c55e; }
.type-reward { background: #3b82f6; }
.log-action { font-size: 13px; color: #374151; margin: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.log-time { font-size: 11px; color: #9ca3af; margin: 2px 0 0; }
.log-credits { font-size: 14px; font-weight: 600; }
.log-credits.minus { color: #ef4444; }
.log-credits.plus { color: #22c55e; }
.empty-history { text-align: center; padding: 24px; color: #9ca3af; font-size: 13px; }

/* Logout */
.logout-btn {
  width: 100%; padding: 12px; background: white; border: 1.5px solid #fecaca;
  border-radius: 10px; color: #dc2626; font-size: 15px; font-weight: 600;
  cursor: pointer; transition: all 0.2s;
}
.logout-btn:hover { background: #fef2f2; }
</style>
