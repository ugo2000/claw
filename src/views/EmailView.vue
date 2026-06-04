<template>
  <div class="email-page">
    <!-- Header -->
    <div class="page-header">
      <h1>{{ $t('email.title') }}</h1>
      <p>{{ $t('email.desc') }}</p>
    </div>

    <!-- Form -->
    <div class="form-card">
      <div class="form-group">
        <label>{{ $t('email.companyName') }}</label>
        <input v-model="form.company" type="text" :placeholder="$t('email.companyName')" />
      </div>
      <div class="form-group">
        <label>{{ $t('email.contactName') }}</label>
        <input v-model="form.contactName" type="text" :placeholder="$t('email.contactName')" />
      </div>
      <div class="form-group">
        <label>{{ $t('email.productInfo') }}</label>
        <textarea v-model="form.product" rows="4" :placeholder="$t('email.productPlaceholder')"></textarea>
      </div>
      <div class="form-row">
        <div class="form-group half">
          <label>{{ $t('email.emailType') }}</label>
          <select v-model="form.type">
            <option value="intro">{{ $t('email.typeIntro') }}</option>
            <option value="followup">{{ $t('email.typeFollowUp') }}</option>
            <option value="quote">{{ $t('email.typeQuote') }}</option>
          </select>
        </div>
        <div class="form-group half">
          <label>{{ $t('email.tone') }}</label>
          <select v-model="form.tone">
            <option value="professional">{{ $t('email.toneProfessional') }}</option>
            <option value="friendly">{{ $t('email.toneFriendly') }}</option>
            <option value="concise">{{ $t('email.toneConcise') }}</option>
          </select>
        </div>
      </div>

      <!-- Credit check -->
      <div v-if="!canGenerate" class="insufficient-credits">
        &#9888;&#65039; {{ $t('email.insufficientCredits') }}
        <router-link to="/profile">{{ $t('profile.rechargeTitle') }} &rarr;</router-link>
      </div>

      <button
        class="generate-btn"
        :disabled="!canGenerate || !form.company.trim() || isGenerating"
        @click="generateEmail"
      >
        {{ isGenerating ? $t('email.generating') + '...' : $t('email.generateBtn') }}
      </button>
    </div>

    <!-- Result -->
    <div v-if="generatedEmail" class="result-card">
      <h3>{{ $t('email.resultTitle') }}</h3>
      <pre class="result-text">{{ generatedEmail }}</pre>
      <div class="result-actions">
        <button class="action-btn primary" @click="copyResult">{{ $t('email.copyEmail') }}</button>
        <button class="action-btn" @click="saveTemplate">{{ $t('email.useAsTemplate') }}</button>
      </div>
    </div>

    <!-- History -->
    <section v-if="history.length" class="history-section">
      <h2>{{ $t('email.historyTitle', { count: history.length }) }}</h2>
      <div class="history-list">
        <div v-for="(item, index) in history" :key="index" class="history-item" @click="loadHistory(item)">
          <div class="history-header">
            <strong>{{ item.company || 'Untitled' }}</strong>
            <span class="history-time">{{ formatRelativeTime(item.time) }}</span>
          </div>
          <p class="history-preview">{{ (item.content || '').slice(0, 80) }}...</p>
        </div>
      </div>
      <button class="clear-history-btn" @click="clearHistory">{{ $t('email.clearHistory') }}</button>
    </section>
    <section v-else-if="!isGenerating" class="empty-state">
      <p>{{ $t('email.emptyHistory') }}</p>
    </section>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import { useCreditsStore } from '../stores/credits'
import { generateEmail as aiGenerateEmail } from '../services/ai'
import { copyToClipboard, formatRelativeTime } from '../utils/helpers'

const { t } = useI18n()
const credits = useCreditsStore()
const route = useRoute()

const form = ref({
  company: '',
  contactName: '',
  product: '',
  type: 'intro',
  tone: 'professional',
})

const isGenerating = ref(false)
const generatedEmail = ref('')
const history = ref([])

const canGenerate = computed(() => credits.canAfford(5))

onMounted(() => {
  if (route.query.company) form.value.company = route.query.company
  if (route.query.industry) form.value.product = `I supply ${route.query.industry}. Please describe your product for a better email.`

  const saved = localStorage.getItem('claw_email_history')
  if (saved) try { history.value = JSON.parse(saved) } catch {}
})

async function generateEmail() {
  const costResult = credits.deduct(5, `AI Email - ${form.value.company}`)
  if (!costResult.success) { alert(costResult.message); return }

  isGenerating.value = true
  generatedEmail.value = ''

  try {
    const result = await aiGenerateEmail({
      companyName: form.value.company,
      contactPerson: form.value.contactName,
      productDescription: form.value.product,
      emailType: form.value.type,
      tone: form.value.tone,
    })

    generatedEmail.value = result.email

    // Save to history
    const entry = {
      company: form.value.company,
      contactName: form.value.contactName,
      content: result.email,
      type: form.value.type,
      time: Date.now(),
    }
    history.value.unshift(entry)
    localStorage.setItem('claw_email_history', JSON.stringify(history.value.slice(0, 50)))
  } catch (err) {
    console.error(err)
    alert(err.message || 'Generation failed')
    // Refund
    credits.balance += 5
    credits.totalUsed -= 5
    const idx = credits.usageLogs.findIndex(l => l.action.includes(`AI Email - ${form.value.company}`))
    if (idx >= 0) credits.usageLogs.splice(idx, 1)
  }

  isGenerating.value = false
}

async function copyResult() {
  const ok = await copyToClipboard(generatedEmail.value)
  alert(ok ? t('email.copyEmail') + ' OK' : 'Failed')
}

function saveTemplate() {
  alert(t('email.useAsTemplate'))
}

function loadHistory(item) {
  form.value.company = item.company
  generatedEmail.value = item.content
}

function clearHistory() {
  history.value = []
  localStorage.removeItem('claw_email_history')
}
</script>

<style scoped>
.email-page { padding: 20px 16px; padding-bottom: 30px; }
.page-header h1 { font-size: 22px; color: #1f2937; margin: 0 0 6px; }
.page-header p { font-size: 13px; color: #6b7280; margin: 0 0 20px; }

.form-card {
  background: white; border-radius: 14px;
  padding: 16px; box-shadow: 0 1px 4px rgba(0,0,0,0.06); margin-bottom: 20px;
}
.form-group { margin-bottom: 14px; }
.form-group label { display: block; font-size: 13px; font-weight: 600; color: #374151; margin-bottom: 6px; }
.form-group input, .form-group textarea, .form-group select {
  width: 100%; border: 1.5px solid #e5e7eb; border-radius: 8px;
  padding: 10px 12px; font-size: 14px; outline: none; transition: border-color 0.2s;
  box-sizing: border-box; font-family: inherit;
}
.form-group input:focus, .form-group textarea:focus, .form-group select:focus { border-color: #1a56db; }
.form-group textarea { resize: vertical; min-height: 80px; }
.form-row { display: flex; gap: 12px; }
.half { flex: 1; }
.insufficient-credits {
  background: #fef3c7; color: #92400e; padding: 10px 14px;
  border-radius: 8px; font-size: 13px; margin-bottom: 12px;
}
.insufficient-credits a { color: #d97706; text-decoration: none; font-weight: 600; }
.generate-btn {
  width: 100%; height: 46px; background: linear-gradient(135deg, #1a56db, #2563eb);
  color: white; border: none; border-radius: 10px;
  font-size: 16px; font-weight: 600; cursor: pointer; margin-top: 4px;
}
.generate-btn:disabled { opacity: 0.5; cursor: not-allowed; }

.result-card {
  background: white; border-radius: 14px;
  padding: 16px; box-shadow: 0 1px 4px rgba(0,0,0,0.06); margin-bottom: 20px;
}
.result-card h3 { font-size: 15px; color: #1f2937; margin: 0 0 10px; }
.result-text {
  margin: 0; font-family: inherit; font-size: 13px; line-height: 1.8;
  color: #374151; white-space: pre-wrap; word-break: break-word;
  background: #f9fafb; padding: 14px; border-radius: 8px;
  max-height: 400px; overflow-y: auto;
}
.result-actions { display: flex; gap: 8px; margin-top: 12px; }
.action-btn {
  flex: 1; padding: 10px; border: 1px solid #e5e7eb; border-radius: 8px;
  background: #fff; font-size: 13px; cursor: pointer; font-weight: 500;
}
.action-btn.primary { background: #1a56db; color: #fff; border-color: #1a56db; }

.history-section h2 { font-size: 17px; color: #1f2937; margin: 0 0 12px; }
.history-list { display: flex; flex-direction: column; gap: 8px; margin-bottom: 12px; }
.history-item {
  background: white; border-radius: 10px; padding: 12px 14px;
  cursor: pointer; box-shadow: 0 1px 2px rgba(0,0,0,0.04);
}
.history-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; }
.history-header strong { font-size: 14px; color: #1f2937; }
.history-time { font-size: 11px; color: #9ca3af; }
.history-preview { font-size: 12px; color: #6b7280; margin: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.clear-history-btn {
  width: 100%; padding: 8px; background: transparent;
  border: 1px dashed #d1d5db; border-radius: 8px;
  color: #9ca3af; font-size: 13px; cursor: pointer;
}
.empty-state { text-align: center; padding: 32px; color: #9ca3af; }
</style>
