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

  // Load from localStorage on init
  function loadFromStorage() {
    try {
      const saved = JSON.parse(localStorage.getItem('claw_search_state') || '{}')
      if (saved.keyword) keyword.value = saved.keyword
      if (saved.region) region.value = saved.region
      if (saved.industry) industry.value = saved.industry
      if (saved.hasSearched) hasSearched.value = true
      if (saved.lastQuery) lastQuery.value = saved.lastQuery
      if (saved.results && saved.results.length) {
        results.value = markSavedStatus(saved.results)
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

  function setResults(newResults, query) {
    results.value = markSavedStatus(newResults)
    lastQuery.value = query
    hasSearched.value = true
    saveToStorage()
  }

  function clear() {
    results.value = []
    hasSearched.value = false
    lastQuery.value = ''
    localStorage.removeItem('claw_search_state')
  }

  function updateItemSaved(companyName) {
    const item = results.value.find(r => r.company === companyName)
    if (item) item._saved = true
    saveToStorage()
  }

  return {
    keyword, region, industry, hasSearched, isSearching,
    results, lastQuery,
    loadFromStorage, saveToStorage, setResults, clear, updateItemSaved, markSavedStatus,
  }
})
