/**
 * URL / Email 校验工具
 * 用于验证和清理用户输入及 AI 生成的网址、邮箱数据
 */

/**
 * 常见 URL 拼写错误模式
 */
const URL_TYPO_PATTERNS = [
  /^https?:\/\/w{4,}/i,           // wwww... 四个及以上 w
  /^https?:\/\/wwww\./i,           // wwww. 明确四个 w
  /^https?:\/\/w{3,4}\./i,        // 允许 www. 但不允许 wwww.
  /htt+p:/i,                       // htttp, httpp 等
  /httpss?:\/\//i,                 // httpss
  /\.c[o0]m\d/i,                  // .com1, .com2 等异常后缀
  /\.(net|org|edu|gov)\d/i,        // 同理
]

/**
 * 检测 URL 是否包含常见拼写错误
 * @param {string} url
 * @returns {boolean} - true = 有拼写错误
 */
function hasUrlTypo(url) {
  if (!url || typeof url !== 'string') return false
  const lower = url.toLowerCase()
  return URL_TYPO_PATTERNS.some(p => p.test(lower))
}

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

  // 先检测常见拼写错误
  if (hasUrlTypo(trimmed)) return false

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

  // 检测常见拼写错误（如 wwww 四个 w）
  if (hasUrlTypo(trimmed)) {
    return { url: trimmed, valid: false, warning: 'typo_in_url' }
  }

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
 * 批量校验 lead 数据中的 website 和 email 字段（格式校验，同步）
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

/**
 * 异步验证网站是否可访问（fetch() 实际探测，带重试）
 * 原理：用 fetch() + AbortController 超时检测
 * - fetch 成功 resolve → 服务器有响应（_websiteReachable = true）
 * - fetch 失败（DNS 无法解析/连接超时/服务器无响应）→ _websiteReachable = false
 * - no-cors 模式下，只要服务器响应（含 404/500）就会 resolve
 * - 只有网络级错误（DNS 失败、连接被拒、超时）才会 reject
 *
 * 带重试：首次失败后等待 3 秒重试一次，避免偶发超时误判
 *
 * @param {Array} leads - validateLeads() 处理后的 leads 数组
 * @returns {Promise<Array>} - 标记了 _websiteReachable 的 leads 数组
 */
function probeWebsite(url, timeoutMs = 7000) {
  return new Promise((resolve) => {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

    fetch(url, {
      mode: 'no-cors',
      signal: controller.signal,
      cache: 'no-cache',
    })
      .then(() => {
        clearTimeout(timeoutId)
        resolve(true)
      })
      .catch(() => {
        clearTimeout(timeoutId)
        resolve(false)
      })
  })
}

export async function verifyWebsites(leads) {
  if (!Array.isArray(leads)) return Promise.resolve([])

  const results = await Promise.all(
    leads.map(async (lead) => {
      const result = { ...lead }

      // 无网站或格式无效，直接标记不可访问
      if (!lead._websiteValid || !lead._websiteNormalized) {
        result._websiteReachable = false
        return result
      }

      // 拼写错误直接标记不可访问
      if (lead._websiteWarning === 'typo_in_url') {
        result._websiteReachable = false
        return result
      }

      // 首次探测
      let reachable = await probeWebsite(lead._websiteNormalized, 7000)

      // 首次失败，重试一次（避免偶发超时）
      if (!reachable) {
        await new Promise(r => setTimeout(r, 3000))
        reachable = await probeWebsite(lead._websiteNormalized, 7000)
      }

      result._websiteReachable = reachable
      return result
    })
  )

  return results
}

/**
 * 异步验证邮箱域名是否有 MX 记录（能收邮件）
 * 使用 Google DNS over HTTPS API（免费，无 API Key 需求）
 *
 * 状态说明：
 *   _emailReachable = true  + _emailUncertain = false → 绿色：MX 验证通过
 *   _emailReachable = false + _emailUncertain = true  → 黄色：DNS 查询失败，不确定
 *   _emailReachable = false + _emailUncertain = false → 红色：格式无效 / 无 MX 记录
 *
 * @param {Array} leads - leads 数组
 * @returns {Promise<Array>} - 标记了 _emailReachable / _emailUncertain 的 leads 数组
 */
export function verifyEmails(leads) {
  if (!Array.isArray(leads)) return Promise.resolve([])

  const tasks = leads.map(lead => {
    return new Promise(resolve => {
      const result = { ...lead, _emailUncertain: false }
      if (!lead._emailValid || !lead._emailNormalized) {
        result._emailReachable = false
        return resolve(result)
      }

      const domain = lead._emailNormalized.split('@')[1]
      if (!domain) {
        result._emailReachable = false
        return resolve(result)
      }

      // Google DNS over HTTPS：查询 MX 记录
      fetch(`https://dns.google/resolve?name=${encodeURIComponent(domain)}&type=MX`, {
        signal: AbortSignal.timeout(5000)
      })
        .then(r => r.json())
        .then(data => {
          // 有 MX 记录 = 域名能收邮件（绿色）
          const hasMX = !!(data.Answer && data.Answer.length > 0)
          result._emailReachable = hasMX
          result._emailUncertain = false   // 确定结果，不是不确定
          resolve(result)
        })
        .catch(() => {
          // DNS 查询失败（网络问题/超时）→ 黄色：不确定，保守保留
          result._emailReachable = false
          result._emailUncertain = true    // 标记为不确定
          resolve(result)
        })
    })
  })

  return Promise.all(tasks)
}

/**
 * 完整验证流程：格式校验 + 网站可访问性 + 邮箱 MX 记录
 * @param {Array} leads - AI 生成的 leads 数组
 * @param {Object} options - { verifyWebsite: true, verifyEmail: true }
 * @returns {Promise<Array>}
 */
export async function fullVerifyLeads(leads, options = {}) {
  const { verifyWebsite = true, verifyEmail = true } = options
  let result = validateLeads(leads)

  if (verifyWebsite) {
    result = await verifyWebsites(result)
  }

  if (verifyEmail) {
    result = await verifyEmails(result)
  }

  return result
}
