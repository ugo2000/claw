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
          <option value="Electronics">{{ $t('search.industries.electronics') }}</option>
          <option value="Textiles">{{ $t('search.industries.textiles') }}</option>
          <option value="Machinery">{{ $t('search.industries.machinery') }}</option>
          <option value="Auto Parts">{{ $t('search.industries.autoParts') }}</option>
          <option value="Building Materials">{{ $t('search.industries.buildingMaterials') }}</option>
          <option value="Food & Beverage">{{ $t('search.industries.foodBeverage') }}</option>
          <option value="Chemicals">{{ $t('search.industries.chemicals') }}</option>
          <option value="Home & Garden">{{ $t('search.industries.homeGarden') }}</option>
        </select>
      </div>
      <button
        class="search-btn"
        :disabled="!keyword.trim() || isSearching"
        @click="doSearch"
      >
        {{ isSearching ? $t('search.analyzing') + '...' : $t('search.searchBtn') }}
      </button>
      <p class="cost-hint">{{ $t('search.costInfo') }} (2 {{ $t('home.credits') }}/page)</p>
    </div>

    <!-- Results -->
  <div v-if="hasSearched" class="results-section">
    <div v-if="isSearching && !isLoadingNext" class="loading-state">
      <div class="spinner"></div>
      <p>AI {{ $t('home.searchLeads').toLowerCase() }}...</p>
    </div>
    <!-- 验证进度横幅（独立显示，不影响结果列表） -->
    <div v-if="isValidating" class="validating-banner">
      <span class="v-spinner"></span>
      {{ $t('search.verifying') }}
    </div>

    <!-- 有结果 -->
    <template v-if="results.length && !isSearching">
        <div class="result-header-bar">
          <p class="result-count">
            {{ searchStore.allResults.length }} {{ $t('search.resultsCount') }} | {{ $t('search.page') }} {{ searchStore.currentPage + 1 }} {{ $t('search.pageOf') }} {{ searchStore.totalPages }}{{ $t('search.pageSuffix') }}
          </p>
          <!-- 数据来源标识 -->
          <span v-if="results[0]?._source === 'serpapi'" class="source-badge real">
            &#127760; {{ $t('search.sourceReal') }}
          </span>
          <span v-else-if="results[0]" class="source-badge ai">
            &#129302; {{ $t('search.sourceAi') }}
          </span>
          <label class="filter-verified">
            <input type="checkbox" v-model="onlyVerifiedEmails" />
            {{ $t('search.verifiedOnly') }}
          </label>
          <button class="clear-results" @click="clearResults">&times; {{ $t('search.clear') }}</button>
        </div>
        <!-- 筛选后为空的提示 -->
        <div v-if="onlyVerifiedEmails && !displayResults.length" class="empty-filter-hint">
          &#128269; {{ $t('search.noVerifiedOnPage') }}
        </div>
        <div v-else class="results-list">
          <div v-for="(item, index) in displayResults" :key="item.company + '-' + index" class="result-card">
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
                @click.prevent="openLink(item)"
              >
                <svg v-if="!item._websiteValid" class="warn-icon" viewBox="0 0 16 16" fill="currentColor"><path d="M8 0a8 8 0 110 16A8 8 0 018 0zm1 12H7v-2h2v2zm0-3H7V4h2v5z"/></svg>
                {{ item.website }}
              </a>
              <span
                v-if="item.email"
                :class="[
                  'meta-email',
                  !item._emailValid ? 'email-invalid'
                    : item._emailReachable === true ? 'email-verified'
                    : item._emailUncertain ? 'email-unverified'
                    : item._emailReachable === false ? 'email-invalid'
                    : 'email-pending'
                ]"
                :title="!item._emailValid ? $t('search.emailTipInvalid')
                  : item._emailReachable === true ? $t('search.emailTipVerified')
                  : item._emailUncertain ? $t('search.emailTipUncertain')
                  : item._emailReachable === false ? $t('search.emailTipNoMx')
                  : $t('search.emailTipChecking')"
              >
                <!-- 格式无效 / 无MX记录 -->
                <svg v-if="!item._emailValid || (item._emailReachable === false && !item._emailUncertain)" class="email-status-icon warn-icon" viewBox="0 0 16 16" fill="currentColor"><path d="M8 0a8 8 0 110 16A8 8 0 018 0zm1 12H7v-2h2v2zm0-3H7V4h2v5z"/></svg>
                <!-- 已验证（绿色对勾） -->
                <svg v-else-if="item._emailReachable === true" class="email-status-icon check-icon" viewBox="0 0 16 16" fill="currentColor"><path d="M13.854 3.646a.5.5 0 010 .708l-7 7a.5.5 0 01-.708 0l-3.5-3.5a.5.5 0 11.708-.708L6.5 10.293l6.646-6.647a.5.5 0 01.708 0z"/></svg>
                <!-- 不确定（黄色问号） -->
                <svg v-else-if="item._emailUncertain" class="email-status-icon uncertain-icon" viewBox="0 0 16 16" fill="currentColor"><path d="M5.255 5.786a.237.237 0 00.241.247h.825c.138 0 .248-.113.266-.25.09-.656.54-1.134 1.342-1.134.686 0 1.314.343 1.314 1.168 0 .635-.374.927-.965 1.371-.673.489-1.206 1.06-1.168 1.987l.003.217a.25.25 0 00.25.246h.811a.25.25 0 00.25-.25v-.105c0-.718.273-.927 1.01-1.486.609-.463 1.244-.977 1.244-2.056 0-1.511-1.276-2.241-2.673-2.241-1.267 0-2.655.59-2.75 2.286zm1.557 5.763c0 .533.425.927 1.01.927.609 0 1.028-.394 1.028-.927 0-.552-.42-.94-1.029-.94-.584 0-1.009.388-1.009.94z"/></svg>
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
                  :class="['save-btn', { saved: item._saved }]"
                  @click.stop="saveClient(item)"
                  :disabled="item._saved"
                >
                  {{ item._saved ? $t('search.savedLabel') : $t('search.saveBtn') }}
                </button>
                <button
                  v-if="!item._websiteReachable || !item._emailReachable"
                  class="report-btn"
                  @click.stop="reportInvalid(item, index)"
                >
                  🚫 {{ $t('search.reportInvalid') }}
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

        <!-- Pagination Controls -->
        <div class="pagination-bar">
          <button
            class="page-btn prev"
            :disabled="searchStore.currentPage <= 0"
            @click="prevPage"
          >
            &#9664; {{ $t('search.prev') }}
          </button>
          <span class="page-info">
            {{ $t('search.page') }} <strong>{{ searchStore.currentPage + 1 }}</strong> {{ $t('search.pageOf') }} {{ searchStore.totalPages }}{{ $t('search.pageSuffix') }}
            <span v-if="searchStore.allResults.length > 0" class="total-info">
              ({{ searchStore.allResults.length }} {{ $t('search.resultsCount') }})
            </span>
          </span>
          <button
            class="page-btn next"
            :disabled="isSearching || isLoadingNext"
            @click="nextPage"
          >
            {{ $t('search.next') }} &#9654;
            <span v-if="isLoadingNext" class="mini-spinner"></span>
          </button>
        </div>
      </template>
      <div v-else-if="!isSearching && !isLoadingNext && !results.length" class="empty-results">
        <p>&#128533; {{ $t('search.noResults') }}</p>
      </div>

      <!-- Quota Exhausted Contact Modal -->
      <div v-if="showQuotaModal" class="modal-overlay" @click="showQuotaModal = false">
        <div class="modal-content quota-modal" @click.stop>
          <div class="modal-header">
            <h3>&#128308; {{ $t('search.quotaTitle') }}</h3>
            <button class="close-btn" @click="showQuotaModal = false">&times;</button>
          </div>
          <div class="modal-body quota-body">
            <div class="quota-icon">&#128308;</div>
            <p class="quota-text">{{ $t('search.quotaText') }}</p>
            <div class="quota-contact">
              <p><strong>{{ $t('payment.wechatId') }}：</strong>ugo2000</p>
              <p><strong>Email：</strong> ugo2000@126.com</p>
            </div>
          </div>
          <div class="modal-footer">
            <button class="action-sm primary" @click="showQuotaModal = false">{{ $t('search.quotaClose') }}</button>
          </div>
        </div>
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
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useCreditsStore } from '../stores/credits'
import { useSearchStore } from '../stores/search'
import { generateLeads, analyzeClient } from '../services/ai'
import { copyToClipboard } from '../utils/helpers'
import { validateLeads, fullVerifyLeads } from '../utils/validators'
import { openExternalUrl } from '../utils/browser'

const { t } = useI18n()
const credits = useCreditsStore()
const searchStore = useSearchStore()

// Bind store refs to template
const keyword = ref('')
const region = ref('')
const industry = ref('')
const hasSearched = ref(false)
const isSearching = ref(false)
const isLoadingNext = ref(false)   // loading next page specifically
const results = ref([])
const lastQuery = ref('')
const isAnalyzing = ref('')
const analysisResult = ref('')
const analysisTarget = ref('')
const isValidating = ref(false)   // 网站/邮箱验证中
const onlyVerifiedEmails = ref(false)  // 仅显示邮箱已验证的结果
const showQuotaModal = ref(false)  // SerpAPI 额度用尽弹窗

// 计算属性：根据开关过滤显示结果
const displayResults = computed(() => {
  if (!onlyVerifiedEmails.value) return results.value
  return results.value.filter(
    l => l.email && l._emailValid !== false && l._emailReachable === true
  )
})

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

// Load persisted state on mount
onMounted(() => {
  keyword.value = searchStore.keyword
  region.value = searchStore.region
  industry.value = searchStore.industry
  hasSearched.value = searchStore.hasSearched
  results.value = searchStore.results
  lastQuery.value = searchStore.lastQuery

  // Re-check saved status against current localStorage (may have changed)
  results.value = searchStore.markSavedStatus(results.value)
})

async function doSearch() {
  if (!keyword.value.trim()) return

  // Deduct credits (2 per page)
  const costResult = credits.deduct(2, `Lead Search - ${keyword.value}`)
  if (!costResult.success) {
    alert(costResult.message)
    return
  }

  isSearching.value = true
  isLoadingNext.value = false
  hasSearched.value = true
  lastQuery.value = keyword.value.trim()

  // Sync form values to store
  searchStore.keyword = keyword.value
  searchStore.region = region.value
  searchStore.industry = industry.value

  try {
    const result = await generateLeads({
      keyword: keyword.value.trim(),
      region: region.value,
      industry: industry.value,
      count: searchStore.pageSize,
    })
    let validated = validateLeads(result.leads).map(l => ({ ...l, _saved: false }))

    // 先显示未验证结果，背景开始验证
    results.value = searchStore.markSavedStatus(validated)
    searchStore.setResults(validated, keyword.value.trim())
    results.value = searchStore.results
    isValidating.value = true

    // 异步验证网站可访问性 + 邮箱 MX 记录
    try {
      const verified = await fullVerifyLeads(validated, { verifyWebsite: true, verifyEmail: true })
      // 只保留网站可访问的结果（邮箱验证只标记，不过滤）
      const filtered = verified.filter(l => l._websiteReachable !== false)
      if (filtered.length === 0) {
        // 所有结果都无法访问：退回积分，提示用户
        console.warn('[Search] All leads failed website check, keeping originals')
        // 不退积分——AI 已经提供了数据，只是网站不可访问
      }
      // 更新 store 和当前页结果
      const marked = searchStore.markSavedStatus(filtered.length > 0 ? filtered : verified)
      searchStore.setResults(marked, keyword.value.trim())
      results.value = searchStore.results
    } catch (verifyErr) {
      console.warn('[Search] Verification skipped:', verifyErr.message)
    }
    isValidating.value = false
  } catch (err) {
    console.error('Search failed:', err)
    // 检测 SerpAPI 额度用尽
    const isQuota = err.message && (
      err.message.includes('SERPAPI_EMPTY') ||
      err.message.includes('quota') ||
      err.message.includes('额度') ||
      err.message.includes('exhausted') ||
      err.message.includes('limit') ||
      err.message.includes('429') ||
      err.message.includes('402')
    )
    if (isQuota) {
      showQuotaModal.value = true
    } else {
      alert(err.message || 'Search failed')
    }
    // 退还积分
    credits.balance += 2
    credits.totalUsed -= 2
    const idx = credits.usageLogs.findIndex(l => l.action.includes(`Lead Search - ${keyword.value}`))
    if (idx >= 0) credits.usageLogs.splice(idx, 1)
  }

  isSearching.value = false
}

// Load next page — re-search with exclusion list
async function nextPage() {
  if (isSearching.value || isLoadingNext.value) return
  const nextPg = searchStore.currentPage + 1
  // If we already have data for next page (e.g., appended earlier), just navigate
  if (nextPg * searchStore.pageSize < searchStore.allResults.length) {
    searchStore.goToPage(nextPg)
    results.value = searchStore.results
    return
  }

  // Need new AI search for more results
  const costResult = credits.deduct(2, `Lead Search (pg.${nextPg + 1}) - ${keyword.value}`)
  if (!costResult.success) {
    alert(costResult.message)
    return
  }

  isLoadingNext.value = true
  isValidating.value = true
  try {
    const excludeList = searchStore.excludedCompanies
    const result = await generateLeads({
      keyword: keyword.value.trim(),
      region: region.value,
      industry: industry.value,
      count: searchStore.pageSize,
      exclude: excludeList,  // Pass excluded companies to avoid duplicates
    })
    const validated = validateLeads(result.leads).map(l => ({ ...l, _saved: false }))

    // 验证网站可访问性 + 邮箱 MX 记录
    let filtered = validated
    try {
      const verified = await fullVerifyLeads(validated, { verifyWebsite: true, verifyEmail: true })
      // 只保留网站可访问的结果（邮箱验证只标记，不过滤）
      filtered = verified.filter(l => l._websiteReachable !== false)
      if (filtered.length === 0) {
        // 所有结果都无法访问：保留原始结果
        console.warn('[Search] All next-page leads failed website check, keeping originals')
        filtered = verified
      }
    } catch (verifyErr) {
      console.warn('[Search] Next-page verification skipped:', verifyErr.message)
    }

    const addedCount = searchStore.appendPageResults(filtered)
    results.value = searchStore.results

    if (addedCount === 0) {
      alert('No new unique leads found. Try a different search term.')
      // Refund
      credits.balance += 2
      credits.totalUsed -= 2
    }
  } catch (err) {
    console.error('Next page search failed:', err)
    alert(err.message || 'Search failed')
    // Refund
    credits.balance += 2
    credits.totalUsed -= 2
    const idx = credits.usageLogs.findIndex(l => l.action.includes(`Lead Search (pg.`))
    if (idx >= 0) credits.usageLogs.splice(idx, 1)
  }

  isLoadingNext.value = false
  isValidating.value = false
}

function prevPage() {
  if (searchStore.currentPage <= 0) return
  searchStore.goToPage(searchStore.currentPage - 1)
  results.value = searchStore.results
}

function clearResults() {
  results.value = []
  hasSearched.value = false
  lastQuery.value = ''
  searchStore.clear()
}

/**
 * 打开外部链接（兼容浏览器 + Capacitor App）
 * - 浏览器环境：window.open(url, '_blank')
 * - Capacitor App：用 @capacitor/browser 打开
 */
function openLink(item) {
  const url = item._websiteNormalized || item.website
  if (!url) return
  openExternalUrl(url)
}

function saveClient(item) {
  if (item._saved) return
  // Save to unified 'claw_clients' so it shows up in My Clients page
  const clients = JSON.parse(localStorage.getItem('claw_clients') || '[]')
  const clientEntry = {
    company: item.company,
    contactName: item.contactName || '',
    email: item.email || '',
    phone: item.phone || '',
    country: item.country || item.region || '',
    website: item.website || '',
    notes: item.desc ? `Source: Search | ${item.desc}` : 'Source: Lead Search',
    status: 'new',
    industry: item.industry || '',
    savedAt: Date.now(),
  }
  // Avoid duplicates
  const exists = clients.some(c => c.company === item.company && c.email === item.email)
  if (!exists) {
    clients.unshift(clientEntry)
    localStorage.setItem('claw_clients', JSON.stringify(clients.slice(0, 500)))
  }
  // Also keep claw_saved_clients for search-page status tracking
  const saved = JSON.parse(localStorage.getItem('claw_saved_clients') || '[]')
  if (!exists) {
    saved.unshift({ ...item, savedAt: Date.now(), _saved: true })
    localStorage.setItem('claw_saved_clients', JSON.stringify(saved.slice(0, 200)))
  }
  item._saved = true
  searchStore.updateItemSaved(item.company)
}

/**
 * 报告无效结果（网站打不开/邮箱无效）
 * - 从当前结果中移除
 * - 加入排除列表，避免后续搜索再次出现
 */
function reportInvalid(item, _index) {
  // 加入排除列表
  searchStore.addExcludedCompany(item.company)
  // 从 allResults 中移除（按 company 匹配，避免 displayResults 过滤后 index 错位）
  const realIndex = searchStore.allResults.findIndex(l => l.company === item.company)
  if (realIndex >= 0) {
    searchStore.allResults.splice(realIndex, 1)
  }
  results.value = searchStore.results
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
    const result = await analyzeClient({
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

/* 验证进度横幅 */
.validating-banner {
  display: flex; align-items: center; gap: 8px;
  font-size: 12px; color: #6b7280;
  background: #f0f9ff; border: 1px solid #bae6fd;
  border-radius: 8px; padding: 8px 12px; margin-bottom: 10px;
}
.v-spinner {
  display: inline-block; width: 12px; height: 12px;
  border: 2px solid #93c5fd; border-top-color: #2563eb;
  border-radius: 50%; animation: spin 0.8s linear infinite; flex-shrink: 0;
}
.empty-filter-hint {
  text-align: center; padding: 20px; color: #6b7280; font-size: 13px;
  background: #f9fafb; border-radius: 10px; margin-bottom: 8px;
}
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
.result-header-bar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; flex-wrap: wrap; gap: 6px; }
.filter-verified {
  display: inline-flex; align-items: center; gap: 5px;
  font-size: 12px; color: #059669; font-weight: 500; cursor: pointer;
  background: #ecfdf5; border: 1px solid #a7f3d0;
  padding: 3px 10px; border-radius: 20px;
  user-select: none;
}
.filter-verified input[type="checkbox"] { width: 13px; height: 13px; accent-color: #059669; cursor: pointer; }
.source-badge {
  display: inline-flex; align-items: center; gap: 3px;
  font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 12px;
}
.source-badge.real { color: #0369a1; background: #e0f2fe; border: 1px solid #bae6fd; }
.source-badge.ai { color: #7c3aed; background: #ede9fe; border: 1px solid #c4b5fd; }

/* Quota Modal */
.quota-modal { max-width: 400px; }
.quota-icon { font-size: 48px; text-align: center; margin-bottom: 12px; }
.quota-text { font-size: 15px; color: #374151; text-align: center; line-height: 1.6; margin-bottom: 16px; }
.quota-contact { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px 16px; }
.quota-contact p { margin: 4px 0; font-size: 14px; color: #1f2937; }
.quota-body { padding: 20px; }
.result-count { font-size: 13px; color: #6b7280; margin: 0; }
.clear-results {
  background: none; border: none; color: #9ca3af; font-size: 13px; cursor: pointer; padding: 4px 8px;
}
.clear-results:hover { color: #ef4444; }
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
  font-size: 11px; color: #1a56db; max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  display: inline-flex; align-items: center; gap: 3px;
}
.meta-link { text-decoration: none; }
.meta-link:hover { text-decoration: underline; }
.link-invalid { color: #f59e0b !important; cursor: not-allowed; opacity: 0.8; }

/* 邮箱三态样式 */
.email-verified {
  color: #059669 !important;   /* 绿色：MX 验证通过 */
  font-weight: 500;
}
.email-unverified {
  color: #d97706 !important;   /* 黄色：不确定 */
  opacity: 0.9;
}
.email-pending {
  color: #6b7280 !important;   /* 灰色：验证中 */
  opacity: 0.7;
}
.email-invalid {
  color: #ef4444 !important;   /* 红色：格式无效 */
  opacity: 0.8;
  text-decoration: line-through;
}

/* 邮箱状态图标 */
.email-status-icon {
  width: 11px; height: 11px; flex-shrink: 0;
}
.check-icon { color: #059669; }     /* 绿色对勾 */
.uncertain-icon { color: #d97706; } /* 黄色问号 */
.warn-icon {
  width: 12px; height: 12px; flex-shrink: 0;
  color: #ef4444; margin-right: 1px;
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
  transition: all 0.2s;
}
.save-btn.saved {
  background: #d1d5db; color: #6b7280; cursor: not-allowed;
}
.save-btn:disabled { cursor: not-allowed; }
.email-btn { text-decoration: none; }
.email-btn-inner {
  background: #10b981; color: white; border: none;
  border-radius: 6px; padding: 5px 12px; font-size: 12px; cursor: pointer;
}
.report-btn {
  background: #fef3c7; color: #b45309; border: 1px solid #f59e0b;
  border-radius: 6px; padding: 5px 10px; font-size: 11px; cursor: pointer;
}
.report-btn:active { background: #fde68a; }

/* Pagination */
.pagination-bar {
  display: flex; justify-content: space-between; align-items: center;
  margin-top: 16px; padding: 12px 4px;
  background: white; border-radius: 10px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.06);
}
.page-btn {
  padding: 8px 16px; border: 1.5px solid #e5e7eb; border-radius: 8px;
  background: white; font-size: 13px; font-weight: 600; cursor: pointer;
  display: flex; align-items: center; gap: 4px;
  transition: all 0.2s; touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
}
.page-btn:not(:disabled):active { background: #f3f4f6; }
.page-btn:not(:disabled):hover { border-color: #1a56db; color: #1a56db; }
.page-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.page-btn.next { background: #1a56db; color: white; border-color: #1a56db; }
.page-btn.next:disabled { background: #d1d5db; border-color: #d1d5db; }
.page-info { font-size: 13px; color: #6b7280; text-align: center; }
.page-info strong { color: #1f2937; }
.total-info { font-size: 11px; color: #9ca3af; }
.mini-spinner {
  width: 14px; height: 14px;
  border: 2px solid rgba(255,255,255,0.3);
  border-top-color: white; border-radius: 50%;
  animation: spin 0.6s linear infinite; display: inline-block;
  vertical-align: middle;
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
