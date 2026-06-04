/**
 * 通用错误处理
 */
export class AppError extends Error {
  constructor(message, code = 'UNKNOWN') {
    super(message)
    this.code = code
  }
}

export const ERROR_CODES = {
  NO_API_KEY: 'NO_API_KEY',
  API_ERROR: 'API_ERROR',
  INSUFFICIENT_CREDITS: 'INSUFFICIENT_CREDITS',
  NETWORK_ERROR: 'NETWORK_ERROR',
  RATE_LIMIT: 'RATE_LIMIT',
}

/**
 * 安全的 JSON 解析
 */
export function safeJsonParse(str, fallback = null) {
  try {
    return JSON.parse(str)
  } catch {
    return fallback
  }
}

/**
 * 防抖函数
 */
export function debounce(fn, delay = 300) {
  let timer = null
  return (...args) => {
    clearTimeout(timer)
    timer = setTimeout(() => fn(...args), delay)
  }
}

/**
 * 复制文本到剪贴板（带 fallback）
 */
export async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    // fallback: textarea 方案
    const textarea = document.createElement('textarea')
    textarea.value = text
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)
    textarea.select()
    try {
      document.execCommand('copy')
      return true
    } catch {
      return false
    } finally {
      document.body.removeChild(textarea)
    }
  }
}

/**
 * 格式化时间戳为相对时间
 */
export function formatRelativeTime(ts) {
  const diff = Date.now() - ts
  if (diff < 60000) return '刚刚'
  if (diff < 3600000) return Math.floor(diff / 60000) + '分钟前'
  if (diff < 86400000) return Math.floor(diff / 3600000) + '小时前'
  if (diff < 2592000000) return Math.floor(diff / 86400000) + '天前'
  return new Date(ts).toLocaleDateString('zh-CN')
}
