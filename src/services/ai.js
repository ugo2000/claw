/**
 * AI 服务层 - DeepSeek API 集成
 * 支持功能：开发信生成、翻译、客户分析、标题优化、回复建议
 */
import config from '../config/api.js'
import { normalizeUrl, normalizeEmail } from '../utils/validators'

/**
 * 调用 DeepSeek Chat API
 * @param {Array} messages - 对话消息数组
 * @param {Object} options - 可选参数（temperature, max_tokens 等）
 * @returns {Promise<{content: string, usage: Object}>}
 */
async function callDeepseek(messages, options = {}) {
  const { baseUrl, apiKey, model } = config.deepseek

  if (!apiKey) {
    throw new Error('未配置 API Key，请在 .env 文件中设置 VITE_DEEPSEEK_API_KEY')
  }

  const params = {
    model,
    messages,
    ...config.defaultParams,
    ...options,
  }

  // 开发环境使用 Vite 代理绕过 CORS；生产/ Capacitor 直连
  const isDev = import.meta.env.DEV
  const fetchUrl = isDev
    ? '/api/deepseek/v1/chat/completions'
    : `${baseUrl}/chat/completions`

  const response = await fetch(fetchUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(params),
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw new Error(error.error?.message || `API 请求失败 (${response.status})`)
  }

  const data = await response.json()
  return {
    content: data.choices[0]?.message?.content || '',
    usage: data.usage || {},
  }
}

// ===================== Prompt 模板 =====================

const SYSTEM_PROMPT = `你是一位专业的外贸开发信撰写专家，拥有15年B2B外贸经验。你的任务是根据用户提供的信息，撰写高质量的外贸开发邮件。

写作原则：
1. 简洁有力，避免冗长套话
2. 突出客户利益（不是罗列产品参数）
3. 包含明确的 Call-to-Action
4. 语气根据用户指定风格调整
5. 邮件主题要吸引人但不夸张
6. 只输出邮件正文，不要解释或额外说明`

/**
 * AI 生成开发信
 * @param {Object} params - { company, contactName, product, type, tone }
 * @returns {Promise<{email: string, subject: string, usage: Object}>}
 */
export async function generateEmail(params) {
  const { company, contactName, product, type, tone } = params

  const typeGuide = {
    intro: '这是一封首次开发的冷邮件，目标是引起对方兴趣并争取回复',
    followup: '这是跟进邮件，对方已表示过兴趣但尚未成交',
    quote: '这是报价邮件，需要清晰展示价格和条款',
  }

  const toneGuide = {
    professional: '正式商务风格，用词专业、结构严谨',
    friendly: '亲切友好风格， warmer tone，适当使用柔和表达',
    concise: '极简风格，直奔主题，不超过150词',
  }

  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    {
      role: 'user',
      content: `请为以下场景撰写一封开发信：

**收件人公司**: ${company}
**联系人**: ${contactName || '未知'}
**我的产品/服务**: ${product}
**邮件类型**: ${typeGuide[type] || typeGuide.intro}
**语气风格**: ${toneGuide[tone] || toneGuide.professional}

请直接输出邮件正文。格式要求：
- 第一行是邮件主题（Subject: ...）
- 空一行后是正文`,
    },
  ]

  const result = await callDeepseek(messages, { max_tokens: 2000 })

  // 解析主题和正文
  let subject = ''
  let body = result.content

  const subjectMatch = result.content.match(/^Subject:\s*(.+)$/m)
  if (subjectMatch) {
    subject = subjectMatch[1].trim()
    body = result.content.replace(/^Subject:\s*.+$/m, '').trim()
  }

  return {
    email: body,
    subject: subject || `${product} - ${company} 合作洽谈`,
    usage: result.usage,
  }
}

/**
 * AI 翻译
 * @param {string} text - 待翻译文本
 * @param {string} from - 源语言 ('zh', 'en')
 * @param {string} to - 目标语言
 * @returns {Promise<{translated: string, usage: Object}>}
 */
export async function translateText(text, from = 'zh', to = 'en') {
  const langMap = { zh: '中文', en: '英文' }

  const messages = [
    {
      role: 'system',
      content: `你是一位专业的商务翻译。将${langMap[from]}翻译成${langMap[to]}，保持商务语调和专业术语准确。只输出翻译结果，不要解释。`,
    },
    {
      role: 'user',
      content: text,
    },
  ]

  const result = await callDeepseek(messages, { temperature: 0.3, max_tokens: 1000 })
  return { translated: result.content.trim(), usage: result.usage }
}

/**
 * 客户分析
 * @param {Object} clientInfo - { companyName, country, industry, website, description }
 * @returns {Promise<{analysis: string, usage: Object}>}
 */
export async function analyzeClient(clientInfo) {
  const messages = [
    {
      role: 'system',
      content: `你是一位资深外贸市场分析师。基于客户提供的信息，输出结构化分析报告。

分析维度：
1. 客户画像（规模、采购习惯、决策链）
2. 需求匹配度评估（高/中/低 + 原因）
3. 开发策略建议（最佳联系方式、切入点、注意事项）
4. 潜在风险提示

以简洁的要点形式输出，每项2-3句话。`,
    },
    {
      role: 'user',
      content: `请分析以下潜在客户：

**公司名称**: ${clientInfo.companyName}
**国家/地区**: ${clientInfo.country}
**行业**: ${clientInfo.industry || '未知'}
**网站**: ${clientInfo.website || '无'}
**已知信息**: ${clientInfo.description || '无'}`,
    },
  ]

  const result = await callDeepseek(messages, { temperature: 0.5, max_tokens: 1500 })
  return { analysis: result.content, usage: result.usage }
}

/**
 * 邮件标题优化
 * @param {string} originalSubject - 原始标题
 * @param {string} context - 上下文（产品名、收件人等）
 * @returns {Promise<{subjects: string[], usage: Object}>}
 */
export async function optimizeSubject(originalSubject, context = '') {
  const messages = [
    {
      role: 'system',
      content: '你是邮件营销专家。根据用户提供的原始标题和上下文，生成5个更有吸引力的邮件标题。每个标题单独一行，编号1-5。只输出标题列表。',
    },
    {
      role: 'user',
      content: `原始标题：${originalSubject}\n上下文：${context || '外贸开发信'}`,
    },
  ]

  const result = await callDeepseek(messages, { temperature: 0.8, max_tokens: 300 })
  const subjects = result.content
    .split('\n')
    .filter(line => line.trim())
    .map(line => line.replace(/^\d+[\.\、]\s*/, '').trim())

  return { subjects, usage: result.usage }
}

/**
 * 回复建议
 * @param {string} originalEmail - 收到的原始邮件
 * @param {string} myGoal - 我的回复目标
 * @returns {Promise<{reply: string, usage: Object}>}
 */
export async function suggestReply(originalEmail, myGoal = '') {
  const messages = [
    {
      role: 'system',
      content: `You are a foreign trade communication consultant. Help draft professional replies to client emails.
Requirements: polite and professional, advance negotiations, include specific action items. Output only the reply body.`,
    },
    {
      role: 'user',
      content: `Client's email:
${originalEmail}

${myGoal ? `My reply goal: ${myGoal}` : ''}`,
    },
  ]

  const result = await callDeepseek(messages, { temperature: 0.6, max_tokens: 1500 })
  return { reply: result.content, usage: result.usage }
}

// ===================== AI Lead Generation =====================

/**
 * Generate potential client leads using AI search intelligence
 * User inputs a keyword like "LED lighting distributor in Germany"
 * DeepSeek returns structured list of potential buyers/companies
 *
 * @param {Object} params - { keyword, region, industry, count }
 * @returns {Promise<{leads: Array, usage: Object}>}
 */
export async function generateLeads(params) {
  const { keyword, region = '', industry = '', count = 8 } = params

  const regionHint = region ? `Target region: ${region}. ` : ''
  const industryHint = industry ? `Target industry: ${industry}. ` : ''

  const messages = [
    {
      role: 'system',
      content: `You are an expert B2B lead generation specialist for international trade. Your task is to find potential buyer companies based on the user's search query.

For each lead, output EXACTLY this JSON format (no markdown, no explanation):
{
  "leads": [
    {
      "company": "Company Name",
      "country": "Country Code (e.g. USA, DE, VN)",
      "region": "Region code (na/eu/sea/me/latam/africa)",
      "industry": "Industry description",
      "desc": "Brief company profile (2-3 sentences about what they do, their scale, procurement needs). Be realistic but note these are AI-generated leads for prospecting.",
      "score": 85,
      "email": "procurement@domain.com (best guess or placeholder)",
      "website": "https://www.domain.com (must include https:// prefix, use real-looking domain)"
    }
  ]
}

Rules:
- Return ${count} leads maximum
- Companies should be realistic and relevant to the search query
- Score should be between 60-95 based on relevance to the query
- desc must be specific and useful for sales outreach
- Use real-looking company names that could plausibly exist
- website MUST start with https:// (e.g. https://www.companyname.com or https://companyname.com)
- email should look realistic, avoid generic placeholders like info@domain.com when possible
- If the query is vague, make reasonable assumptions
- OUTPUT ONLY THE JSON, nothing else`,
    },
    {
      role: 'user',
      content: `${regionHint}${industryHint}Search query: "${keyword}"

Find ${count} potential buyer/importer/distributor companies that match this search. These are for cold email outreach.`,
    },
  ]

  const result = await callDeepseek(messages, {
    temperature: 0.7,
    max_tokens: 3000,
  })

  // Parse JSON from response
  let parsed
  const text = result.content.trim()

  // Try to extract JSON if wrapped in markdown code blocks
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (jsonMatch) {
    try {
      parsed = JSON.parse(jsonMatch[0])
    } catch (e) {
      // Fall through to full parse attempt
    }
  }

  if (!parsed) {
    try {
      parsed = JSON.parse(text)
    } catch (e) {
      throw new Error('Failed to parse AI response. Please try again.')
    }
  }

  // Validate structure
  if (!parsed.leads || !Array.isArray(parsed.leads)) {
    throw new Error('Invalid response format from AI')
  }

  // Post-process: validate and normalize URL/email in each lead
  const processedLeads = parsed.leads.map(lead => {
    const processed = { ...lead }

    // Normalize & validate website
    if (processed.website) {
      const urlResult = normalizeUrl(processed.website)
      if (urlResult.valid) {
        processed.website = urlResult.url
      }
      // Keep original if invalid - UI layer will show warning
    }

    // Normalize & validate email
    if (processed.email) {
      const emailResult = normalizeEmail(processed.email)
      processed.email = emailResult.email
      // Mark if it's a placeholder/invalid
      if (!emailResult.valid) {
        processed._emailPlaceholder = true
      }
    }

    return processed
  })

  return { leads: processedLeads, usage: result.usage }
}

/**
 * Enrich a single lead with additional AI analysis
 * @param {Object} lead - Basic lead info
 * @returns {Promise<{enrichedLead: Object, analysis: string, usage: Object}>}
 */
export async function enrichLead(lead) {
  const messages = [
    {
      role: 'system',
      content: `You are a corporate research analyst. Given a company name and basic details, provide deeper business intelligence.

Output a brief analysis covering:
1. Likely company size (SME/Mid-size/Enterprise)
2. Estimated annual procurement volume
3. Decision maker likely roles (CPO, Procurement Manager, Owner)
4. Best approach strategy for initial contact
5. Potential objections and how to handle them

Keep it concise, 150-200 words total.`,
    },
    {
      role: 'user',
      content: `Company: ${lead.company}
Country: ${lead.country}
Industry: ${lead.industry}
Description: ${lead.desc}`,
    },
  ]

  const result = await callDeepseek(messages, { temperature: 0.5, max_tokens: 800 })
  return { analysis: result.content, usage: result.usage }
}

export default {
  generateEmail,
  translateText,
  analyzeClient,
  optimizeSubject,
  suggestReply,
  generateLeads,
  enrichLead,
  callDeepseek,
}
