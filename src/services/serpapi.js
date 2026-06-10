/**
 * SerpAPI 集成 — 搜索真实买家询盘/RFQ/采购需求
 *
 * 目标：找到真实的询盘（询盘 = buyer inquiry / RFQ / buying request）
 * 而不是公司官网首页
 *
 * 搜索策略：
 *   1. 用 Google 搜索含 "want to buy" / "inquiry" / "RFQ" / "sourcing" 的页面
 *   2. 优先返回询盘页面、采购需求帖子、B2B 平台公开询盘
 *   3. 从 snippet 中提取询盘详情（产品、数量、联系方式）
 */

// 优先读环境变量（开发模式），fallback 到内嵌 key（生产/App 打包）
const SERP_API_KEY = import.meta.env.VITE_SERP_API_KEY || '5d15ea1c5bfe916160a769c67bd61715315b9f443ebd2ea98eb57c15c74911de'
const SERP_BASE_URL = 'https://serpapi.com/search'

// 原生 HTTP 桥接：Capacitor App 用 Java 发请求，浏览器/dev 用原生 fetch
import { nativeFetch } from './nativeHttp.js'

/**
 * 构造搜索查询 —— 重点搜索真实买家询盘，排除 B2B 平台聚合页
 *
 * 搜索策略：
 *   1. 用 Google 搜索含询盘关键词的页面
 *   2. 用 -site: 排除 B2B 平台（Alibaba/IndiaMART 等）
 *   3. 优先返回真实买家自己的页面（公司采购页、论坛帖、LinkedIn 动态）
 */
function buildSearchQuery(keyword, region = '') {
  const kw = keyword.trim()

  // 询盘相关词（Google 支持 OR，必须大写）
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
  ].join(' OR ')

  // 排除 B2B 平台（这些平台的 RFQ 频道页不是真实买家询盘）
  // 只用 -site:域名 排除整个域名下的 RFQ 聚合页
  const excludeDomains = [
    'alibaba.com',
    'globalsources.com',
    'made-in-china.com',
    'indiamart.com',
    'tradeindia.com',
    'exportersindia.com',
    'ec21.com',
    'ecplaza.net',
    'dhgate.com',
    'thomasnet.com',
    'justdial.com',
  ].map(d => `-site:${d}`).join(' ')

  // 构造查询：询盘词 + 产品词，排除平台
  let query = `(${inquiryTerms}) "${kw}" ${excludeDomains}`

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
 * 提取域名（用于邮箱推断）
 */
function extractDomain(url) {
  if (!url) return ''
  try {
    const u = new URL(url)
    return u.hostname.replace('www.', '')
  } catch { return '' }
}

/**
 * 从域名推断可能的联系邮箱
 */
function inferEmails(domain) {
  if (!domain) return ['info@' + domain]
  const prefixes = ['info', 'sales', 'contact', 'procurement', 'enquiry', 'export', 'import', 'trade', 'purchase', 'sourcing']
  return prefixes.map(p => `${p}@${domain}`)
}

/**
 * 判断搜索结果是否为真实询盘/采购需求
 * 优先：包含询盘关键词的结果
 * 排除：零售平台、百科、社交媒体积
 */
function isInquiryResult(title, snippet, link) {
  const text = (title + ' ' + snippet).toLowerCase()

  // 排除项：非商业/非询盘页面（含平台聚合页）
  const exclude = [
    'wikipedia', 'amazon.', 'ebay.', 'made-in-china.',
    'youtube.com', 'facebook.com', 'linkedin.com/in/',
    'reddit', 'quora', 'pinterest',
    '.pdf', 'file:', 'javascript:',
    'home page', 'welcome to', 'about us', 'our company',
  ]
  if (exclude.some(e => text.includes(e))) return false

  // ========== 硬性排除：B2B 平台聚合页（不是真实买家询盘）==========
  // 这些页面是平台自己的求购频道，不是买家自己发的询盘帖
  const url = (link || '').toLowerCase()
  const platformPatterns = [
    'alibaba.com/rfq', 'alibaba.com/inquiry', 'alibaba.com/buying-request', 'alibaba.com/sourcing',
    'made-in-china.com/rfq', 'made-in-china.com/inquiry', 'made-in-china.com/buying-request',
    'globalsources.com/rfq', 'globalsources.com/inquiry',
    'indiamart.com/rfq', 'indiamart.com/buy-lead', 'indiamart.com/buying-request',
    'tradeindia.com/rfq', 'tradeindia.com/buyer', 'tradeindia.com/buying-request',
    'exportersindia.com/buy-lead', 'exportersindia.com/rfq',
    'justdial.com/rfq', 'justdial.com/buy-requirement',
    'ec21.com/rfq', 'ec21.com/buying-request',
    'ecplaza.net/rfq', 'ecplaza.net/buying-request',
    'thomasnet.com/rfq', 'thomasnet.com/buying-request',
    'dhgate.com/rfq', 'dhgate.com/buying-request',
  ]
  for (const pattern of platformPatterns) {
    if (url.includes(pattern)) return false
  }

  // 排除：平台域名 + RFQ/询盘路径（动态检测）
  const platformDomains = [
    'alibaba.com', 'globalsources.com', 'made-in-china.com',
    'indiamart.com', 'tradeindia.com', 'exportersindia.com',
    'ec21.com', 'ecplaza.net', 'dhgate.com', 'thomasnet.com',
  ]
  const platformRfqPaths = ['/rfq', '/inquiry', '/buying-request', '/sourcing', '/buy-lead', '/buyer', '/request-for-quotation']
  for (const domain of platformDomains) {
    if (url.includes(domain)) {
      if (platformRfqPaths.some(p => url.includes(p))) return false
      // 平台产品页也不是询盘
      if (url.includes('/product/') || url.includes('/p/')) return false
    }
  }

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
  ]
  const hasInquiry = inquiryKeywords.some(e => text.includes(e))
  if (hasInquiry) return true

  // 正向判断：URL 路径含询盘特征（真实买家自己的页面，非平台）
  const inquiryPaths = [
    '/contact', '/inquiry', '/rfq', '/buying-request', '/sourcing',
    '/procurement', '/purchase', '/quote', '/request-quote',
    '/buy', '/order', '/get-quote', '/request-quote',
  ]
  const hasInquiryPath = inquiryPaths.some(p => url.includes(p))
  // 但必须不是平台域名
  const isPlatform = platformDomains.some(d => url.includes(d))
  if (hasInquiryPath && !isPlatform) return true

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
    // 取标题前 60 个字符作为产品描述
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
  if (link.includes('alibaba.com') || link.includes('globalsources.com')) {
    // 从域名提取
    const domain = extractDomain(link)
    if (domain) {
      const parts = domain.split('.')
      if (parts.length >= 2) return parts[0].charAt(0).toUpperCase() + parts[0].slice(1)
    }
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

  const isDev = import.meta.env.DEV
  let fetchUrl
  if (isDev) {
    fetchUrl = `/api/serpapi/search?engine=google&q=${encodeURIComponent(query)}&num=${count + 10}&hl=en&gl=us&api_key=${SERP_API_KEY}`
  } else {
    fetchUrl = `${SERP_BASE_URL}?engine=google&q=${encodeURIComponent(query)}&num=${count + 10}&hl=en&gl=us&api_key=${SERP_API_KEY}`
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

  // 过滤并转换为 leads 格式（优先询盘结果）
  const leads = []
  const excludedSet = new Set((exclude || []).map(e => e.toLowerCase()))

  for (const r of results) {
    if (!r.title || !r.link) continue

    // 排除已展示的公司
    const companyName = extractCompanyFromResult(r.title, r.link)
    if (excludedSet.has(companyName.toLowerCase())) continue

    // 判断是否为询盘结果
    if (!isInquiryResult(r.title, r.snippet || '', r.link)) continue

    const domain = extractDomain(r.link)
    const country = guessCountry(r.link, r.snippet || '', region)
    const inquiry = extractInquiryDetails(r.title, r.snippet || '')

    // 推断邮箱（优先用询盘中提取的，否则推断）
    const bestEmail = inquiry.contact || inferEmails(domain)[0]

    leads.push({
      company: companyName,
      country: country || '--',
      region: region || 'na',
      industry: industry || '',
      desc: inquiry.inquiryText || r.snippet || `Inquiry found via Google search for "${keyword}"`,
      score: Math.max(65, 95 - leads.length * 3), // 询盘结果分数更高
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

  // 如果询盘结果太少（< 3条），也保留一些公司结果作为补充
  if (leads.length < 3) {
    console.log(`[SerpAPI] 询盘结果仅 ${leads.length} 条，补充公司结果...`)
    for (const r of results) {
      if (leads.length >= count) break
      if (!r.title || !r.link) continue

      const companyName = extractCompanyFromResult(r.title, r.link)
      if (excludedSet.has(companyName.toLowerCase())) continue
      if (leads.some(l => l.company.toLowerCase() === companyName.toLowerCase())) continue

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
        email: inferEmails(domain)[0],
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
