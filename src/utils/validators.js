/**
 * URL / Email 校验工具
 * 用于验证和清理用户输入及 AI 生成的网址、邮箱数据
 */

/**
 * 校验 URL 格式是否合法
 * @param {string} url - 待校验的 URL 字符串
 * @param {Object} options - 配置选项
 * @param {boolean} options.requireProtocol - 是否要求必须带协议 (默认 false)
 * @param {string[]} options.allowedProtocols - 允许的协议列表 (默认 ['http', 'https'])
 * @returns {boolean}
 */
export function isValidUrl(url, options = {}) {
  if (!url || typeof url !== 'string') return false

  const trimmed = url.trim()
  if (!trimmed || trimmed.length > 2048) return false

  const { requireProtocol = false, allowedProtocols = ['http', 'https'] } = options

  try {
    let parsedUrl = trimmed

    // 如果没有协议，尝试自动补全 https:// 用于解析校验
    if (!/^https?:\/\//i.test(trimmed)) {
      if (requireProtocol) return false
      parsedUrl = 'https://' + trimmed
    }

    const urlObj = new URL(parsedUrl)

    // 检查协议是否在允许列表中
    const protocol = urlObj.protocol.replace(/:$/, '').toLowerCase()
    if (!allowedProtocols.includes(protocol)) return false

    // 检查 hostname 是否合法（不能为空，不能包含非法字符）
    const hostname = urlObj.hostname
    if (!hostname) return false

    // hostname 必须包含至少一个点，或者是 localhost / IP 地址
    const validHostnamePattern = /^([a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?\.)*[a-zA-Z]{2,}$|^localhost$|^\d{1,3}(\.\d{1,3}){3}$/
    if (!validHostnamePattern.test(hostname)) return false

    return true
  } catch {
    return false
  }
}

/**
 * 校验 Email 格式是否合法
 * @param {string} email - 待校验的邮箱字符串
 * @returns {boolean}
 */
export function isValidEmail(email) {
  if (!email || typeof email !== 'string') return false

  const trimmed = email.trim()

  // 基本长度检查
  if (trimmed.length < 3 || trimmed.length > 254) return false

  // RFC 5322 简化版正则，覆盖绝大多数真实邮箱格式
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/

  if (!emailRegex.test(trimmed)) return false

  // 确保 @ 符号后至少有一个点
  const atParts = trimmed.split('@')
  if (atParts.length !== 2) return false
  const domain = atParts[1]
  if (!domain.includes('.')) return false

  // 域名部分基本检查
  const domainParts = domain.split('.')
  if (domainParts[domainParts.length - 1].length < 2) return false

  return true
}

/**
 * 规范化 URL：补全协议、去除首尾空格、转小写协议
 * 如果 URL 格式不合法，返回原始值并标记
 * @param {string} url - 原始 URL
 * @returns {{ url: string, valid: boolean, warning: string }}
 */
export function normalizeUrl(url) {
  if (!url || typeof url !== 'string') return { url: '', valid: false, warning: '' }

  const trimmed = url.trim()

  if (!trimmed) return { url: '', valid: false, warning: '' }

  // 已经是合法的完整 URL
  if (/^https?:\/\//i.test(trimmed)) {
    try {
      new URL(trimmed)
      return { url: trimmed, valid: true, warning: '' }
    } catch {
      return { url: trimmed, valid: false, warning: 'invalid_url' }
    }
  }

  // 尝试补全 https://
  const withProtocol = 'https://' + trimmed
  try {
    const urlObj = new URL(withProtocol)
    // 额外检查：hostname 不能是常见的非域名关键词
    const invalidKeywords = ['example', 'test', 'none', 'n/a', '-', 'unknown', '无']
    if (invalidKeywords.some(k => urlObj.hostname.toLowerCase() === k || urlObj.hostname.toLowerCase().startsWith(k + '.'))) {
      return { url: trimmed, valid: false, warning: 'placeholder_url' }
    }
    return { url: withProtocol, valid: true, warning: '' }
  } catch {
    return { url: trimmed, valid: false, warning: 'invalid_url' }
  }
}

/**
 * 规范化 Email：去首尾空格、转小写
 * @param {string} email - 原始邮箱
 * @returns {{ email: string, valid: boolean }}
 */
export function normalizeEmail(email) {
  if (!email || typeof email !== 'string') return { email: '', valid: false }

  const trimmed = email.trim().toLowerCase()

  if (!trimmed) return { email: '', valid: false }

  // 过滤明显的占位符
  const placeholders = [
    'example@email.com', 'test@example.com', 'email@domain.com',
    'procurement@domain.com', 'info@domain.com', 'contact@domain.com',
    'name@company.com', 'user@example.com', 'admin@domain.com',
    'noreply@domain.com', 'sales@domain.com',
  ]

  const isPlaceholder = placeholders.includes(trimmed) ||
    trimmed.endsWith('@domain.com') ||
    trimmed.endsWith('@example.com')

  if (isPlaceholder) {
    return { email: trimmed, valid: false }
  }

  const valid = isValidEmail(trimmed)
  return { email: trimmed, valid }
}

/**
 * 安全地生成 href 属性值（防 XSS）
 * 对 mailto: 和 https?: 链接进行白名单校验
 * @param {string} type - 链接类型: 'mailto' | 'url'
 * @param {string} value - 原始值
 * @returns {string|null} - 安全的 href 值，不安全时返回 null
 */
export function safeHref(type, value) {
  if (!value || typeof value !== 'string') return null

  const trimmed = value.trim()
  if (!trimmed) return null

  if (type === 'mailto') {
    // 只允许 mailto: + 合法邮箱格式
    if (isValidEmail(trimmed)) {
      return `mailto:${encodeURIComponent(trimmed)}`
    }
    return null
  }

  if (type === 'url') {
    const normalized = normalizeUrl(trimmed)
    if (normalized.valid) {
      return normalized.url
    }
    return null
  }

  return null
}

/**
 * 批量校验 lead 数据中的 website 和 email 字段
 * @param {Array} leads - AI 生成的 leads 数组
 * @returns {Array} - 标记了校验状态的 leads 数组
 */
export function validateLeads(leads) {
  if (!Array.isArray(leads)) return []

  return leads.map(lead => {
    const result = { ...lead }

    // 校验 website
    if (lead.website) {
      const urlCheck = normalizeUrl(lead.website)
      result._websiteValid = urlCheck.valid
      result._websiteNormalized = urlCheck.valid ? urlCheck.url : lead.website
      result._websiteWarning = urlCheck.warning
    } else {
      result._websiteValid = false
      result._websiteNormalized = ''
    }

    // 校验 email
    if (lead.email) {
      const emailCheck = normalizeEmail(lead.email)
      result._emailValid = emailCheck.valid
      result._emailNormalized = emailCheck.email
    } else {
      result._emailValid = false
      result._emailNormalized = ''
    }

    return result
  })
}
