/**
 * SerpAPI 集成 — 用 Google 真实搜索结果获取真实买家/进口商
 *
 * 工作原理：
 *   用户输入 "地毯 进口商 德国"
 * → 构造 Google 搜索查询："carpet importer Germany" 或 "carpet distributor Europe"
 * → 调用 SerpAPI 返回真实 organic_results（标题、链接、摘要）
 * → 从结果中提取公司名、网站、描述
 * → 推断邮箱（info@ / sales@ / procurement@ 基于域名）
 * → 返回真实数据，非AI虚构
 */

const SERP_API_KEY = import.meta.env.VITE_SERP_API_KEY || ''
const SERP_BASE_URL = 'https://serpapi.com/search'

/**
 * 根据用户关键词和地区构造 Google 搜索查询
 */
function buildSearchQuery(keyword, region = '') {
  // 关键词映射：将中文关键词转为英文搜索词
  const query = keyword.replace(/进口商|importer|buyer/gi, 'importer')
    .replace(/分销商|distributor/gi, 'distributor')
    .replace(/供应商|supplier/gi, 'wholesale supplier')
    .replace(/买家|buyer/gi, 'buyer')
    .replace(/制造商|manufacturer/gi, 'manufacturer')

  return region ? `${query} ${region}` : query
}

/**
 * 将 region 缩写扩展为可用的搜索词
 */
function expandRegion(region) {
  const map = {
    'na': 'North America USA Canada',
    'eu': 'Europe Germany France UK Italy Spain',
    'sea': 'Southeast Asia Vietnam Thailand Malaysia Indonesia Singapore',
    'me': 'Middle East UAE Saudi Arabia Dubai',
    'latam': 'Latin America Brazil Mexico Colombia Chile',
    'africa': 'Africa South Africa Nigeria Kenya Egypt',
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
  const prefixes = ['info', 'sales', 'contact', 'procurement', 'enquiry', 'export', 'import', 'trade']
  return prefixes.map(p => `${p}@${domain}`)
}

/**
 * 判断搜索结果是否为 B2B 买家相关（排除零售、百科、新闻等）
 */
function isB2BBuyerResult(title, snippet) {
  const text = (title + ' ' + snippet).toLowerCase()
  // 排除项：非商业页面
  const exclude = [
    'wikipedia', 'amazon.', 'ebay.', 'alibaba.', 'made-in-china.',
    'youtube.com', 'facebook.com', 'linkedin.com/in/',
    'reddit', 'quora', 'pinterest',
    '.pdf', 'file:', 'javascript:',
  ]
  if (exclude.some(e => text.includes(e))) return false

  // 包含项：B2B 相关词
  const include = [
    'importer', 'import', 'distributor', 'distribut', 'wholesale', 'supplier',
    'trading', 'buy', 'purchase', 'procure', 'sourcing', 'b2b',
    'company', 'ltd', 'llc', 'gmbh', 'inc.', 'corp', 'co.',
    'manufacturer', 'export', 'factory', 'group',
    'product', 'catalog', 'collection', 'range',
  ]
  return include.some(e => text.includes(e))
}

/**
 * 解析国家代码从链接或描述中
 */
function guessCountry(link, snippet, region) {
  const text = (link + ' ' + snippet).toLowerCase()
  // TLD 映射
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

  // region hint
  const regionCountry = {
    'na': 'US', 'eu': 'DE', 'sea': 'VN', 'me': 'AE', 'latam': 'BR', 'africa': 'ZA',
  }
  return regionCountry[region] || null
}

/**
 * 从标题提取公司名
 */
function extractCompany(title) {
  let name = title.trim()
  // 清理常见后缀和前缀
  name = name
    .replace(/\s*[-–|]\s*.+$/, '')     // 移除 | 后面的内容
    .replace(/^\d+\.\s*/, '')           // 移除编号
    .replace(/^(Home|Welcome|About|Contact|Products?|Catalog)\s*/i, '')
    .trim()

  // 如果太短或太长，返回原标题
  if (name.length < 3 || name.length > 80) return title.trim()
  return name
}

/**
 * 主搜索函数：用 SerpAPI 获取真实的买家公司
 *
 * @param {Object} params
 * @param {string} params.keyword - 用户搜索关键词
 * @param {string} params.region - 地区缩写 na/eu/sea/me/latam/africa
 * @param {string} params.industry - 行业
 * @param {number} params.count - 返回数量（默认10）
 * @returns {Promise<{leads: Array, source: string}>}
 */
export async function searchRealLeads(params) {
  const { keyword, region = '', industry = '', count = 10 } = params

  if (!SERP_API_KEY) {
    throw new Error('未配置 VITE_SERP_API_KEY，请在 .env 文件中设置 SerpAPI Key。免费申请：https://serpapi.com/')
  }

  const regionText = expandRegion(region)
  const query = buildSearchQuery(keyword, regionText)

  console.log(`[SerpAPI] 搜索: ${query}`)

  const url = `${SERP_BASE_URL}?engine=google&q=${encodeURIComponent(query)}&num=${count + 5}&hl=en&api_key=${SERP_API_KEY}`

  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`SerpAPI 错误: HTTP ${response.status}`)
  }

  const data = await response.json()

  if (data.error) {
    throw new Error(`SerpAPI: ${data.error}`)
  }

  const results = data.organic_results || []
  console.log(`[SerpAPI] 返回 ${results.length} 条结果`)

  // 过滤并转换为 leads 格式
  const leads = []
  for (const r of results) {
    if (!isB2BBuyerResult(r.title, r.snippet)) continue

    const domain = extractDomain(r.link)
    const country = guessCountry(r.link, r.snippet, region)

    // 推断邮箱（取最可能的前缀）
    const bestEmail = inferEmails(domain)[0] // info@domain

    leads.push({
      company: extractCompany(r.title),
      country: country || '--',
      region: region || 'na',
      industry: industry || '',
      desc: r.snippet || `Company found via Google search for "${keyword}"`,
      score: Math.max(60, Math.min(95, 85 - leads.length * 2)), // 递减分数
      email: bestEmail,
      website: r.link,
      _source: 'serpapi',
      _realData: true,
      _snippet: r.snippet || '',
    })

    if (leads.length >= count) break
  }

  return {
    leads,
    usage: {
      source: 'serpapi',
      count: leads.length,
      totalResults: results.length,
      query,
    },
  }
}
