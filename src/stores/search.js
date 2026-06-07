import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useSearchStore = defineStore('search', () => {
  const keyword = ref('')
  const region = ref('')
  const industry = ref('')
  const hasSearched = ref(false)
  const isSearching = ref(false)
  const results = ref([])
  const lastQuery = ref('')

  // Pagination state
  const currentPage = ref(0)          // 0-based page index
  const pageSize = 10                 // results per page
  const allResults = ref([])          // accumulated across all pages
  const excludedCompanies = ref([])   // company names already shown (for exclusion in AI prompt)

  // Computed: total pages
  const totalPages = computed(() => Math.ceil(allResults.value.length / pageSize) || 1)

  // Current page slice
  function getPageSlice(page) {
    const start = page * pageSize
    return allResults.value.slice(start, start + pageSize)
  }

  // Load from localStorage on init
  function loadFromStorage() {
    try {
      const saved = JSON.parse(localStorage.getItem('claw_search_state') || '{}')
      if (saved.keyword) keyword.value = saved.keyword
      if (saved.region) region.value = saved.region
      if (saved.industry) industry.value = saved.industry
      if (saved.hasSearched) hasSearched.value = true
      if (saved.lastQuery) lastQuery.value = saved.lastQuery
      if (saved.allResults && saved.allResults.length) {
        allResults.value = markSavedStatus(saved.allResults)
        results.value = getPageSlice(saved.currentPage || 0)
        currentPage.value = saved.currentPage || 0
        if (saved.excludedCompanies) excludedCompanies.value = saved.excludedCompanies
      } else if (saved.results && saved.results.length) {
        // Migrate old format: single-page results → allResults
        allResults.value = markSavedStatus(saved.results)
        results.value = allResults.value.slice(0, pageSize)
        excludedCompanies.value = saved.results.map(r => r.company).filter(Boolean)
        currentPage.value = 0
      }
    } catch {}
  }

  function saveToStorage() {
    localStorage.setItem('claw_search_state', JSON.stringify({
      keyword: keyword.value,
      region: region.value,
      industry: industry.value,
      hasSearched: hasSearched.value,
      lastQuery: lastQuery.value,
      results: results.value.map(r => ({ ...r })),
      // New pagination fields
      currentPage: currentPage.value,
      allResults: allResults.value.map(r => ({ ...r })),
      excludedCompanies: [...excludedCompanies.value],
    }))
  }

  function markSavedStatus(items) {
    try {
      const savedClients = JSON.parse(localStorage.getItem('claw_saved_clients') || '[]')
      const savedNames = new Set(savedClients.map(c => c.company))
      return items.map(item => ({
        ...item,
        _saved: item._saved || savedNames.has(item.company),
      }))
    } catch { return items }
  }

  // Set initial results (first page — replaces previous search)
  function setResults(newResults, query) {
    const marked = markSavedStatus(newResults)
    allResults.value = marked
    results.value = marked.slice(0, pageSize)
    lastQuery.value = query
    hasSearched.value = true
    currentPage.value = 0
    excludedCompanies.value = newResults.map(r => r.company).filter(Boolean)
    saveToStorage()
  }

  // Append next page results
  function appendPageResults(newResults) {
    const marked = markSavedStatus(newResults)
    // Only add items not already in allResults (by company name)
    const existingCompanies = new Set(allResults.value.map(r => r.company))
    const uniqueNew = marked.filter(item => !existingCompanies.has(item.company))

    if (uniqueNew.length > 0) {
      allResults.value = [...allResults.value, ...uniqueNew]
      excludedCompanies.value = [...excludedCompanies.value, ...uniqueNew.map(r => r.company)]
    }
    // Move to next page
    currentPage.value++
    results.value = getPageSlice(currentPage.value)
    saveToStorage()
    return uniqueNew.length
  }

  // Navigate to a specific page
  function goToPage(page) {
    if (page < 0 || page >= totalPages.value) return false
    currentPage.value = page
    results.value = getPageSlice(page)
    saveToStorage()
    return true
  }

  function clear() {
    results.value = []
    allResults.value = []
    hasSearched.value = false
    lastQuery.value = ''
    currentPage.value = 0
    excludedCompanies.value = []
    localStorage.removeItem('claw_search_state')
  }

  function updateItemSaved(companyName) {
    const item = results.value.find(r => r.company === companyName)
    if (item) item._saved = true
    const allItem = allResults.value.find(r => r.company === companyName)
    if (allItem) allItem._saved = true
    saveToStorage()
  }

  // 报告无效公司：加入排除列表，避免后续搜索再次出现
  function addExcludedCompany(companyName) {
    if (companyName && !excludedCompanies.value.includes(companyName)) {
      excludedCompanies.value = [...excludedCompanies.value, companyName]
      saveToStorage()
    }
  }

  return {
    keyword, region, industry, hasSearched, isSearching,
    results, lastQuery,
    currentPage, pageSize, totalPages,
    allResults, excludedCompanies,
    loadFromStorage, saveToStorage, setResults, appendPageResults,
    goToPage, clear, updateItemSaved, markSavedStatus,
    addExcludedCompany,
  }
})
