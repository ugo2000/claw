<template>
  <div class="search-page">
    <!-- Header -->
    <div class="page-header">
      <h1>{{ $t('search.title') }}</h1>
      <p>{{ $t('search.subtitle') }}</p>
    </div>

    <!-- Search Form -->
    <div class="search-form">
      <input
        v-model="keyword"
        type="text"
        class="search-input"
        :placeholder="$t('search.keywordPlaceholder')"
        @keyup.enter="doSearch"
      />
      <div class="form-row">
        <select v-model="region" class="form-select">
          <option value="">{{ $t('search.allRegions') }}</option>
          <option value="na">{{ $t('regions.na') }}</option>
          <option value="eu">{{ $t('regions.eu') }}</option>
          <option value="sea">{{ $t('regions.sea') }}</option>
          <option value="me">{{ $t('regions.me') }}</option>
          <option value="latam">{{ $t('regions.latam') }}</option>
          <option value="africa">{{ $t('regions.africa') }}</option>
        </select>
        <select v-model="industry" class="form-select">
          <option value="">{{ $t('search.allIndustries') }}</option>
          <option value="Electronics">Electronics</option>
          <option value="Textiles">Textiles</option>
          <option value="Machinery">Machinery</option>
          <option value="Auto Parts">Auto Parts</option>
          <option value="Building Materials">Building Materials</option>
          <option value="Food & Beverage">F&B</option>
          <option value="Chemicals">Chemicals</option>
          <option value="Home & Garden">Home & Garden</option>
        </select>
      </div>
      <button
        class="search-btn"
        :disabled="!keyword.trim() || isSearching"
        @click="doSearch"
      >
        {{ isSearching ? $t('search.analyzing') + '...' : $t('search.searchBtn') }}
      </button>
      <p class="cost-hint">{{ $t('search.costInfo') }}</p>
    </div>

    <!-- Results -->
    <div v-if="hasSearched" class="results-section">
      <div v-if="isSearching" class="loading-state">
        <div class="spinner"></div>
        <p>AI {{ $t('home.searchLeads').toLowerCase() }}...</p>
      </div>
      <template v-else-if="results.length">
        <p class="result-count">
          {{ $t('search.resultCount', { count: results.length, query: lastQuery }) }}
        </p>
        <div class="results-list">
          <div v-for="(item, index) in results" :key="index" class="result-card">
            <div class="result-header">
              <h3>{{ item.company }}</h3>
              <span :class="['region-badge', `badge-${item.region || 'na'}`]">
                {{ (item.country && tRegion(item.country)) || item.region || '--' }}
              </span>
            </div>
            <p class="result-desc">{{ item.desc }}</p>
            <div class="result-meta">
              <span v-if="item.industry" class="meta-tag">{{ item.industry }}</span>
              <a
                v-if="item.website"
                :class="['meta-link', { 'link-invalid': !item._websiteValid }]"
                :href="item._websiteNormalized || item.website"
                target="_blank"
                rel="noopener noreferrer"
                @click.prevent="item._websiteValid ? window.open(item._websiteNormalized || item.website, '_blank') : null"
              >
                <svg v-if="!item._websiteValid" class="warn-icon" viewBox="0 0 16 16" fill="currentColor"><path d="M8 0a8 8 0 110 16A8 8 0 018 0zm1 12H7v-2h2v2zm0-3H7V4h2v5z"/></svg>
                {{ item.website }}
              </a>
              <span
                v-if="item.email"
                :class="['meta-email', { 'email-invalid': !item._emailValid }]"
              >
                <svg v-if="!item._emailValid" class="warn-icon" viewBox="0 0 16 16" fill="currentColor"><path d="M8 0a8 8 0 110 16A8 8 0 018 0zm1 12H7v-2h2v2zm0-3H7V4h2v5z"/></svg>
                {{ item.email }}
              </span>
            </div>
            <div class="result-footer">
              <span class="match-score">{{ $t('search.matchScore', { score: item.score }) }}</span>
              <div class="result-actions">
                <button
                  class="analyze-btn"
                  @click.stop="analyzeClient(item)"
                  :disabled="isAnalyzing === item.company"
                >
                  {{ isAnalyzing === item.company ? $t('search.analyzing') : $t('search.aiAnalyze') }}
                </button>
                <button
                  class="save-btn"
                  @click.stop="saveClient(item)"
                >
                  {{ item._saved ? $t('search.savedBtn') : $t('search.saveBtn') }}
                </button>
                <router-link
                  :to="{ path: '/email', query: { company: item.company, industry: item.industry } }"
                  class="email-btn"
                  custom
                  v-slot="{ navigate }"
                >
                  <button @click="navigate" class="email-btn-inner">{{ $t('search.emailBtn') }}</button>
                </router-link>
              </div>
            </div>
          </div>
        </div>
      </template>
      <div v-else class="empty-results">
        <p>&#128533; {{ $t('search.noResults') }}</p>
      </div>
    </div>

    <!-- AI Analysis Modal -->
    <div v-if="analysisResult" class="modal-overlay" @click="closeAnalysis">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h3>{{ $t('search.analysisTitle') }}</h3>
          <button class="close-btn" @click="closeAnalysis">&times;</button>
        </div>
        <div class="modal-body">
          <p class="analysis-target"><strong>{{ $t('search.targetCompany') }}</strong> {{ analysisTarget }}</p>
          <pre class="analysis-text">{{ analysisResult }}</pre>
        </div>
        <div class="modal-footer">
          <button class="action-sm" @click="copyAnalysis">{{ $t('search.copyReport') }}</button>
          <button class="action-sm primary" @click="closeAnalysis">{{ $t('search.close') }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { useCreditsStore } from '../stores/credits'
import { generateLeads as aiGenerateLeads, analyzeClient as aiAnalyzeClient } from '../services/ai'
import { copyToClipboard, formatRelativeTime } from '../utils/helpers'
import { validateLeads, safeHref } from '../utils/validators'

const { t } = useI18n()
const router = useRouter()
const credits = useCreditsStore()

const keyword = ref('')
const region = ref('')
const industry = ref('')
const hasSearched = ref(false)
const isSearching = ref(false)
const results = ref([])
const lastQuery = ref('')
const isAnalyzing = ref('')
const analysisResult = ref('')
const analysisTarget = ref('')

// Region name mapping
function tRegion(code) {
  const map = {
    NA: 'North America',
    EU: 'Europe',
    SEA: 'SE Asia',
    ME: 'Middle East',
    LATAM: 'LatAm',
    AF: 'Africa',
  }
  return map[code] || code
}

async function doSearch() {
  if (!keyword.value.trim()) return

  // Deduct credits
  const costResult = credits.deduct(2, `Lead Search - ${keyword.value}`)
  if (!costResult.success) {
    alert(costResult.message)
    return
  }

  isSearching.value = true
  hasSearched.value = true
  results.value = []
  lastQuery.value = keyword.value.trim()

  try {
    const result = await aiGenerateLeads({
      keyword: keyword.value.trim(),
      region: region.value,
      industry: industry.value,
      count: 8,
    })
    results.value = validateLeads(result.leads).map(l => ({ ...l, _saved: false }))
  } catch (err) {
    console.error('Search failed:', err)
    alert(err.message || 'Search failed')
    // Refund credits
    credits.balance += 2
    credits.totalUsed -= 2
    const idx = credits.usageLogs.findIndex(l => l.action.includes(`Lead Search - ${keyword.value}`))
    if (idx >= 0) credits.usageLogs.splice(idx, 1)
  }

  isSearching.value = false
}

function saveClient(item) {
  if (item._saved) return
  const saved = JSON.parse(localStorage.getItem('claw_saved_clients') || '[]')
  saved.unshift({ ...item, savedAt: Date.now(), _saved: true })
  localStorage.setItem('claw_saved_clients', JSON.stringify(saved.slice(0, 200)))
  item._saved = true
  alert(t('search.savedBtn'))
}

async function analyzeClient(item) {
  const costResult = credits.deduct(10, `${t('search.analysisTitle')} - ${item.company}`)
  if (!costResult.success) {
    alert(costResult.message)
    return
  }

  isAnalyzing.value = item.company
  analysisTarget.value = item.company

  try {
    const result = await aiAnalyzeClient({
      companyName: item.company,
      country: item.country,
      industry: item.industry,
      website: item.website,
      description: item.desc,
    })
    analysisResult.value = result.analysis
  } catch (err) {
    console.error('Analysis failed:', err)
    alert(err.message || 'Analysis failed')
    // Refund credits
    credits.balance += 10
    credits.totalUsed -= 10
    const idx = credits.usageLogs.findIndex(l => l.action.includes(`${t('search.analysisTitle')} - ${item.company}`))
    if (idx >= 0) credits.usageLogs.splice(idx, 1)
  }

  isAnalyzing.value = ''
}

function closeAnalysis() { analysisResult.value = '' }
async function copyAnalysis() {
  const ok = await copyToClipboard(analysisResult.value)
  alert(ok ? t('search.copyReport') + ' OK' : 'Copy failed')
}
</script>

<style scoped>
.search-page { padding: 20px 16px; padding-bottom: 30px; }
.page-header h1 { font-size: 22px; color: #1f2937; margin: 0 0 6px; }
.page-header p { font-size: 13px; color: #6b7280; margin: 0 0 20px; }

/* Form */
.search-form { background: white; border-radius: 14px; padding: 16px; box-shadow: 0 1px 4px rgba(0,0,0,0.06); margin-bottom: 20px; }
.search-input {
  width: 100%; height: 44px;
  border: 1.5px solid #e5e7eb; border-radius: 10px;
  padding: 0 14px; font-size: 15px;
  outline: none; transition: border-color 0.2s;
  box-sizing: border-box;
}
.search-input:focus { border-color: #1a56db; }
.form-row { display: flex; gap: 8px; margin-top: 10px; }
.form-select {
  flex: 1; height: 40px;
  border: 1px solid #e5e7eb; border-radius: 8px;
  padding: 0 10px; font-size: 13px;
  background: white;
  appearance: auto;
}
.search-btn {
  width: 100%; height: 46px;
  background: linear-gradient(135deg, #1a56db, #2563eb);
  color: white; border: none; border-radius: 10px;
  font-size: 16px; font-weight: 600;
  margin-top: 12px; cursor: pointer;
}
.search-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.cost-hint { text-align: center; font-size: 12px; color: #9ca3af; margin: 8px 0 0; }

/* Results */
.results-section { }
.loading-state {
  text-align: center; padding: 40px 0; color: #6b7280;
}
.spinner {
  width: 32px; height: 32px;
  border: 3px solid #e5e7eb; border-top-color: #1a56db;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin: 0 auto 12px;
}
@keyframes spin { to { transform: rotate(360deg); } }
.result-count { font-size: 13px; color: #6b7280; margin: 0 0 12px; }
.results-list { display: flex; flex-direction: column; gap: 10px; }
.result-card {
  background: white; border-radius: 12px;
  padding: 14px 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.06);
}
.result-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6px; }
.result-header h3 { font-size: 15px; color: #1f2937; margin: 0; flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.region-badge {
  font-size: 11px; padding: 2px 8px; border-radius: 20px; white-space: nowrap; margin-left: 8px;
  font-weight: 500;
}
.badge-na { background: #dbeafe; color: #1d4ed8; }
.badge-eu { background: #dcfce7; color: #15803d; }
.badge-sea { background: #fef9c3; color: #a16207; }
.badge-me { background: #fee2e2; color: #b91c1c; }
.badge-latam { background: #f3e8ff; color: #7c3aed; }
.badge-africa { background: #ffe4cc; color: #c2410c; }
.result-desc { font-size: 13px; color: #6b7280; line-height: 1.5; margin: 0 0 8px; }
.result-meta { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 10px; }
.meta-tag {
  font-size: 11px; background: #f3f4f6; color: #374151;
  padding: 2px 8px; border-radius: 4px;
}
.meta-link, .meta-email {
  font-size: 11px; color: #1a56db; max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  display: inline-flex; align-items: center; gap: 2px;
}
.meta-link { text-decoration: none; }
.meta-link:hover { text-decoration: underline; }
.link-invalid { color: #f59e0b !important; cursor: not-allowed; opacity: 0.8; }
.email-invalid { color: #f59e0b !important; opacity: 0.8; }
.warn-icon {
  width: 12px; height: 12px; flex-shrink: 0;
  color: #f59e0b; margin-right: 1px;
}
.result-footer { display: flex; justify-content: space-between; align-items: center; }
.match-score { font-size: 12px; color: #6b7280; }
.result-actions { display: flex; gap: 6px; align-items: center; }
.analyze-btn {
  background: #f59e0b; color: white; border: none;
  border-radius: 6px; padding: 5px 12px; font-size: 12px; cursor: pointer;
}
.analyze-btn:disabled { opacity: 0.5; }
.save-btn {
  background: #1a56db; color: white; border: none;
  border-radius: 6px; padding: 5px 14px; font-size: 12px; cursor: pointer;
}
.email-btn { text-decoration: none; }
.email-btn-inner {
  background: #10b981; color: white; border: none;
  border-radius: 6px; padding: 5px 12px; font-size: 12px; cursor: pointer;
}
.empty-results { text-align: center; padding: 32px; color: #9ca3af; }

/* Modal */
.modal-overlay {
  position: fixed; top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.4); z-index: 100;
  display: flex; align-items: center; justify-content: center; padding: 16px;
}
.modal-content {
  background: #fff; border-radius: 14px;
  width: 100%; max-width: 480px; max-height: 80vh; overflow-y: auto;
}
.modal-header { display: flex; justify-content: space-between; align-items: center; padding: 14px 18px; border-bottom: 1px solid #f3f4f6; }
.modal-header h3 { margin: 0; font-size: 17px; }
.close-btn { background: none; border: none; font-size: 24px; cursor: pointer; color: #9ca3af; line-height: 1; }
.modal-body { padding: 16px 18px; }
.analysis-target { font-size: 13px; color: #6b7280; margin-bottom: 12px; }
.analysis-text {
  margin: 0; font-family: inherit; font-size: 13px;
  line-height: 1.8; color: #374151; white-space: pre-wrap; word-break: break-word;
  background: #f9fafb; padding: 12px; border-radius: 8px;
}
.modal-footer { display: flex; gap: 8px; padding: 12px 18px; border-top: 1px solid #f3f4f6; }
.action-sm {
  flex: 1; padding: 8px; border: 1px solid #e5e7eb; border-radius: 8px;
  background: #fff; font-size: 13px; cursor: pointer; color: #6b7280;
}
.action-sm.primary { background: #1a56db; color: #fff; border-color: #1a56db; }
</style>
