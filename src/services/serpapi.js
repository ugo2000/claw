/**
 * SerpAPI 集成 — 搜索真实买家询盘/RFQ/采购需求
 *
 * 目标：找到真实的询盘（询盘 = buyer inquiry / RFQ / buying request）
 * 而不是 B2B 平台聚合页
 *
 * 搜索策略：
 *   1. 用 Google 搜索含询盘关键词的页面
 *   2. 用 -site: 排除所有 B2B 平台域名（非常激进）
 *   3. 只返回真实买家自己的页面
 *   4. 加 tbs=qdr:w 只取最近一周的询盘（最新在前）
 */

// 优先读环境变量（开发模式），fallback 到内嵌 key（生产/App 打包）
const SERP_API_KEY = import.meta.env.VITE_SERP_API_KEY || '5d15ea1c5bfe916160a769c67bd61715315b9f443ebd2ea98eb57c15c74911de'
const SERP_BASE_URL = 'https://serpapi.com/search'

// 原生 HTTP 桥接：Capacitor App 用 Java 发请求，浏览器/dev 用原生 fetch
import { nativeFetch } from './nativeHttp.js'

/**
 * 所有需要排除的域名（用于 Google -site: 参数，只含域名不含路径）
 * 这些网站不会有真实买家询盘
 */
const EXCLUDE_SITE_DOMAINS = [
  // ========== B2B 平台（聚合页，不是真实买家询盘）==========
  'alibaba.com',
  '1688.com',
  'made-in-china.com',
  'globalsources.com',
  'hkinstruments.com',
  '86trade.com',
  'chinax.com',
  'tradechina.com',
  'indiamart.com',
  'tradeindia.com',
  'exportersindia.com',
  'justdial.com',
  'zaubacorp.com',
  'machinedirectory.in',
  'exporthub.com',
  'ec21.com',
  'ecplaza.net',
  'tradekorea.com',
  'dhgate.com',
  'fiverr.com',
  'upwork.com',
  'thomasnet.com',
  // ========== 社交媒体（不会有询盘）==========
  'facebook.com',
  'reddit.com',
  'quora.com',
  'pinterest.com',
  'twitter.com',
  'x.com',
  'instagram.com',
  'tiktok.com',
  'linkedin.com',
  // ========== 非商业网站 ==========
  'wikipedia.org',
  'youtube.com',
  'amazon.com',
  'ebay.com',
  'walmart.com',
]

/**
 * URL 过滤：除了上述域名，还排除 LinkedIn 个人主页等含路径的模式
 */
const EXCLUDED_URL_PATTERNS = [
  ...EXCLUDE_SITE_DOMAINS,
  'linkedin.com/in/',
  'linkedin.com/pub/',
]

/**
 * 构造 Google 搜索查询
 * 核心策略：
 *   - 询盘关键词 OR 组合
 *   - 排除所有 B2B 平台（-site:域名）
 *   - tbs=qdr:w 只取最近一周（最新询盘优先）
 */
function buildSearchQuery(keyword, region = '') {
  const kw = keyword.trim()

  // 询盘关键词（Google 支持 OR，必须大写）
  const inquiryTerms = [
    '"want to buy"',
    '"inquiry"',
    '"RFQ"',
    '"sourcing"',
    '"buying request"',
    '"procurement"',
    '"purchase"',
    '"import"',
    '"looking for supplier"',
    '"need to buy"',
    '"seeking vendor"',
    '"quotation required"',
    '"send me your price"',
    '"please quote"',
  ].join(' OR ')

  // 构造 -site: 排除列表（仅用纯域名，不含路径）
  const excludeSites = EXCLUDE_SITE_DOMAINS.map(d => `-site:${d}`).join(' ')

  // 构造查询
  let query = `(${inquiryTerms}) "${kw}" ${excludeSites}`

  if (region) {
    query += ` ${region}`
  }

  return query
}

/**
 * 将 region 缩写扩展为搜索词
 */
function expandRegion(region) {
  const map = {
    'na': 'USA Canada Mexico',
    'eu': 'Germany France UK Italy Spain',
    'sea': 'Vietnam Thailand Malaysia Indonesia Singapore',
    'me': 'UAE Saudi Arabia Dubai Qatar',
    'latam': 'Brazil Mexico Colombia Chile',
    'africa': 'South Africa Nigeria Kenya Egypt',
  }
  return map[region.toLowerCase()] || ''
}

/**
 * 提取域名（用于公司名推断）
 */
function extractDomain(url) {
  if (!url) return ''
  try {
    const u = new URL(url)
    return u.hostname.replace('www.', '')
  } catch { return '' }
}

/**
 * 判断搜索结果是否为真实买家询盘（非平台聚合页）
 *
 * 核心原则：
 *   ✅ 真实买家页面：公司采购页、论坛询盘帖、含询盘关键词的页面
 *   ❌ 平台聚合页/社交媒体：已被 EXCLUDED_URL_PATTERNS 硬性排除
 */
function isInquiryResult(title, snippet, link) {
  const text = (title + ' ' + snippet).toLowerCase()
  const url = (link || '').toLowerCase()

  // ========== 硬性排除：所有 B2B 平台 + 社交媒体 + 非商业网站 ==========
  for (const pattern of EXCLUDED_URL_PATTERNS) {
    if (url.includes(pattern)) return false
  }

  // 排除：非商业内容（PDF、登录页等）
  const exclude = [
    '.pdf', 'file:', 'javascript:',
    'home page', 'welcome to', 'about us', 'our company',
    'login', 'sign up', 'register', 'cart', 'checkout',
  ]
  if (exclude.some(e => text.includes(e))) return false

  // ========== 正向判断：真实询盘特征 ==========
  const inquiryKeywords = [
    'want to buy', 'looking for', 'inquiry', 'enquiry',
    'rfq', 'request for quotation', 'sourcing', 'procurement',
    'buying request', 'purchase', 'import', 'supplier wanted',
    'need to buy', 'interested in buying', 'quotation required',
    'send me your price', 'please quote', 'looking for supplier',
    'we are looking to buy', 'we need', 'we are in need of',
    'seeking supplier', 'sourcing for', 'procurement requirement',
    'buyer looking for', 'purchase inquiry', 'buying inquiry',
    'we require', 'we are interested in', 'looking to purchase',
    'requirement for', 'looking to source', 'need quotation for',
  ]
  const hasInquiry = inquiryKeywords.some(e => text.includes(e))
  if (hasInquiry) return true

  // 正向判断：URL 路径含询盘特征（真实买家自己的页面，非平台）
  const inquiryPaths = [
    '/contact', '/inquiry', '/rfq', '/buying-request', '/sourcing',
    '/procurement', '/purchase', '/quote', '/request-quote',
    '/buy', '/order', '/get-quote', '/request-quote',
    '/contact-us', '/request-for-quotation', '/enquiry',
  ]
  const hasInquiryPath = inquiryPaths.some(p => url.includes(p))
  // 但必须不是平台域名（上面已经排除了）
  if (hasInquiryPath) return true

  return false
}

/**
 * 从标题/摘要中提取询盘详情
 * 返回：{ product, quantity, budget, contact, inquiryText }
 */
function extractInquiryDetails(title, snippet) {
  const text = (title + ' ' + snippet).toLowerCase()
  const result = {
    product: '',
    quantity: '',
    budget: '',
    contact: '',
    inquiryText: (snippet || title || '').trim(),
  }

  // 提取产品名（标题中常见模式）
  const productMatch = title.match(/^(.{10,80}?)(?:\s*[-–|]\s*|\s+inquiry|\s+RFQ)/i)
  if (productMatch) {
    result.product = productMatch[1].trim()
  } else {
    // 取标题前 80 个字符作为产品描述
    result.product = title.trim().substring(0, 80)
  }

  // 提取数量
  const qtyMatch = text.match(/(\d[\d,]*)\s*(piece|pcs|units|tons|kg|mt|set|ea)\b/)
  if (qtyMatch) result.quantity = qtyMatch[0]

  // 提取预算/价格
  const budgetMatch = text.match(/budget[:\s]*\$?[\d,\.]+|price[:\s]*\$?[\d,\.]+|\$[\d,\.]+\s*(per|each)/)
  if (budgetMatch) result.budget = budgetMatch[0]

  // 提取联系方式（邮箱）
  const emailMatch = snippet.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/)
  if (emailMatch) result.contact = emailMatch[0]

  return result
}

/**
 * 从标题提取公司名（如果是询盘，标题可能是产品名而非公司名）
 */
function extractCompanyFromResult(title, link) {
  // B2B 平台询盘：标题通常是产品名，公司名在链接或 snippet 中
  // 但我们已经排除了所有 B2B 平台，所以这里只处理普通公司网站

  // 从域名提取公司名
  const domain = extractDomain(link)
  if (domain) {
    const parts = domain.split('.')
    if (parts.length >= 2) return parts[0].charAt(0).toUpperCase() + parts[0].slice(1)
  }

  // 普通公司网站：从标题提取公司名
  let name = title.trim()
  name = name
    .replace(/\s*[-–|]\s*.+$/, '')
    .replace(/^\d+\.\s*/, '')
    .replace(/^(Home|Welcome|About|Contact|Products?|Catalog)\s*/i, '')
    .trim()

  if (name.length < 3 || name.length > 80) return title.trim()
  return name
}

/**
 * 解析国家代码
 */
function guessCountry(link, snippet, region) {
  const text = (link + ' ' + snippet).toLowerCase()
  const tldMap = {
    '.de': 'DE', '.uk': 'GB', '.fr': 'FR', '.it': 'IT', '.es': 'ES',
    '.nl': 'NL', '.be': 'BE', '.at': 'AT', '.se': 'SE', '.pl': 'PL',
    '.us': 'US', '.ca': 'CA', '.mx': 'MX', '.br': 'BR',
    '.au': 'AU', '.in': 'IN', '.ae': 'AE', '.za': 'ZA',
    '.vn': 'VN', '.th': 'TH', '.my': 'MY', '.sg': 'SG', '.id': 'ID',
    '.com': '', '.net': '', '.org': '',
  }

  for (const [tld, code] of Object.entries(tldMap)) {
    if (link.includes(tld)) return code || null
  }

  const regionCountry = {
    'na': 'US', 'eu': 'DE', 'sea': 'VN', 'me': 'AE', 'latam': 'BR', 'africa': 'ZA',
  }
  return regionCountry[region] || null
}

/**
 * 主搜索函数：用 SerpAPI 获取真实买家询盘
 *
 * @param {Object} params
 * @param {string} params.keyword - 用户搜索关键词（产品名）
 * @param {string} params.region - 地区缩写 na/eu/sea/me/latam/africa
 * @param {string} params.industry - 行业
 * @param {number} params.count - 返回数量（默认10）
 * @param {Array}  params.exclude - 排除的公司名列表
 * @returns {Promise<{leads: Array, usage: object}>}
 */
export async function searchRealLeads(params) {
  const { keyword, region = '', industry = '', count = 10, exclude = [] } = params

  if (!SERP_API_KEY) {
    throw new Error('未配置 VITE_SERP_API_KEY，请在 .env 文件中设置 SerpAPI Key。免费申请：https://serpapi.com/')
  }

  const regionText = expandRegion(region)
  const query = buildSearchQuery(keyword, regionText)

  console.log(`[SerpAPI] 询盘搜索: ${query}`)

  // 构造 SerpAPI URL（加 tbs=qdr:w 取最近一周，最新询盘）
  const isDev = import.meta.env.DEV
  const serpParams = new URLSearchParams({
    engine: 'google',
    q: query,
    num: String(count + 10),
    hl: 'en',
    gl: 'us',
    api_key: SERP_API_KEY,
    // 只取最近一周的结果（最新询盘优先）
    tbs: 'qdr:w',
  })

  let fetchUrl
  if (isDev) {
    fetchUrl = `/api/serpapi/search?${serpParams.toString()}`
  } else {
    fetchUrl = `${SERP_BASE_URL}?${serpParams.toString()}`
  }

  console.log(`[SerpAPI] fetch: ${isDev ? '(dev proxy)' : fetchUrl.replace(SERP_API_KEY, '***')}`)

  const response = await nativeFetch(fetchUrl)
  if (!response.ok) {
    const status = response.status
    if (status === 402 || status === 429) {
      const body = await response.text().catch(() => '')
      throw new Error(`HTTP ${status}: ${body || 'SerpAPI quota exceeded'}`)
    }
    throw new Error(`SerpAPI 错误: HTTP ${status}`)
  }

  const data = await response.json()

  if (data.error) {
    throw new Error(`SerpAPI: ${data.error}`)
  }

  const results = data.organic_results || []
  console.log(`[SerpAPI] 返回 ${results.length} 条结果`)

  // 过滤并转换为 leads 格式（只保留真实询盘）
  const leads = []
  const excludedSet = new Set((exclude || []).map(e => e.toLowerCase()))

  for (const r of results) {
    if (!r.title || !r.link) continue

    // 排除已展示的公司
    const companyName = extractCompanyFromResult(r.title, r.link)
    if (excludedSet.has(companyName.toLowerCase())) continue

    // 判断是否为真实询盘结果（非平台页）
    if (!isInquiryResult(r.title, r.snippet || '', r.link)) continue

    const domain = extractDomain(r.link)
    const country = guessCountry(r.link, r.snippet || '', region)
    const inquiry = extractInquiryDetails(r.title, r.snippet || '')

    // 邮箱：只保留从网页内容中真实提取到的，不捏造
    const bestEmail = inquiry.contact || ''

    leads.push({
      company: companyName,
      country: country || '--',
      region: region || 'na',
      industry: industry || '',
      desc: inquiry.inquiryText || r.snippet || `Inquiry found via Google search for "${keyword}"`,
      score: Math.max(65, 95 - leads.length * 3),
      email: bestEmail,
      website: r.link,
      // 询盘专属字段
      inquiryProduct: inquiry.product,
      inquiryQuantity: inquiry.quantity,
      inquiryBudget: inquiry.budget,
      _source: 'serpapi_inquiry',
      _realData: true,
      _isInquiry: true,
      _snippet: r.snippet || '',
    })

    if (leads.length >= count) break
  }

  // 如果真实询盘结果太少（< 3条），补充一些公司结果
  // 但这些公司结果也必须是真实买家，不能是平台
  if (leads.length < 3) {
    console.log(`[SerpAPI] 真实询盘结果仅 ${leads.length} 条，补充公司结果...`)
    for (const r of results) {
      if (leads.length >= count) break
      if (!r.title || !r.link) continue

      const companyName = extractCompanyFromResult(r.title, r.link)
      if (excludedSet.has(companyName.toLowerCase())) continue
      if (leads.some(l => l.company.toLowerCase() === companyName.toLowerCase())) continue

      // 排除平台结果
      const url = (r.link || '').toLowerCase()
      if (EXCLUDED_URL_PATTERNS.some(d => url.includes(d))) continue

      // 排除纯零售/百科结果
      const text = (r.title + ' ' + (r.snippet || '')).toLowerCase()
      if (text.includes('wikipedia') || text.includes('amazon.com') || text.includes('ebay.com')) continue

      const domain = extractDomain(r.link)
      const country = guessCountry(r.link, r.snippet || '', region)

      leads.push({
        company: companyName,
        country: country || '--',
        region: region || 'na',
        industry: industry || '',
        desc: r.snippet || `Company found via Google search for "${keyword}"`,
        score: Math.max(55, 80 - leads.length * 2),
        email: '', // 补充公司结果不捏造邮箱
        website: r.link,
        inquiryProduct: '',
        inquiryQuantity: '',
        inquiryBudget: '',
        _source: 'serpapi_company',
        _realData: true,
        _isInquiry: false,
        _snippet: r.snippet || '',
      })
    }
  }

  return {
    leads,
    usage: {
      source: 'serpapi',
      count: leads.length,
      totalResults: results.length,
      query,
      inquiryCount: leads.filter(l => l._isInquiry).length,
    },
  }
}
