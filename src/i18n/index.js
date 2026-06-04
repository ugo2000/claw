import { createI18n } from 'vue-i18n'
import en from './locales/en.json'
import zh from './locales/zh.json'

// Detect saved language or browser language
function getInitialLocale() {
  const saved = localStorage.getItem('claw_language')
  if (saved) return saved
  // Check browser language
  const lang = navigator.language || navigator.languages?.[0] || 'en'
  if (lang.startsWith('zh')) return 'zh'
  if (lang.startsWith('en')) return 'en'
  return 'en' // default
}

const i18n = createI18n({
  legacy: false,        // Use Composition API mode
  locale: getInitialLocale(),
  fallbackLocale: 'en',
  messages: { en, zh },
})

// Save preference on change
i18n.global.locale.value = getInitialLocale()

// Helper: switch and persist
export function setLanguage(locale) {
  i18n.global.locale.value = locale
  localStorage.setItem('claw_language', locale)
}

export default i18n
