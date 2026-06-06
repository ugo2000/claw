/**
 * Wikidata 免费真实公司数据源
 * 使用 Wikidata SPARQL API（无需 API Key）
 * 作为 generateLeads 的真实数据第一来源
 */
import config from '../config/api.js'

const COUNTRY_LABEL_TO_CODE = {
  'United States of America': 'USA',
  'United States': 'USA',
  'China': 'CN',
  'Germany': 'DE',
  'France': 'FR',
  'United Kingdom': 'GBR',
  'Japan': 'JP',
  'South Korea': 'KOR',
  'India': 'IND',
  'Australia': 'AUS',
  'Canada': 'CAN',
  'Brazil': 'BRA',
  'Mexico': 'MEX',
  'Italy': 'ITA',
  'Spain': 'ESP',
  'Netherlands': 'NLD',
  'Switzerland': 'CHE',
  'Sweden': 'SWE',
  'Norway': 'NOR',
  'Denmark': 'DNK',
  'Finland': 'FIN',
  'Poland': 'POL',
  'Turkey': 'TUR',
  'Argentina': 'ARG',
  'Chile': 'CHL',
  'Colombia': 'COL',
  'Vietnam': 'VNM',
  'Thailand': 'THA',
  'Malaysia': 'MYS',
  'Singapore': 'SGP',
  'Indonesia': 'IDN',
  'Philippines': 'PHL',
  'New Zealand': 'NZL',
  'Israel': 'ISR',
  'Saudi Arabia': 'SAU',
  'United Arab Emirates': 'ARE',
  'Egypt': 'EGY',
  'South Africa': 'ZAF',
  'Nigeria': 'NGA',
  'Kenya': 'KEN',
  'Russia': 'RUS',
}

function mapRegion(countryCode) {
  const map = {
    'USA': 'na', 'CAN': 'na', 'MEX': 'na',
    'DE': 'eu', 'FR': 'eu', 'GBR': 'eu', 'ITA': 'eu', 'ESP': 'eu',
    'NL': 'eu', 'CH': 'eu', 'SE': 'eu', 'NO': 'eu', 'DK': 'eu', 'FI': 'eu', 'PL': 'eu',
    'CN': 'asia', 'JP': 'asia', 'KR': 'asia', 'IN': 'asia',
    'AU': 'asia', 'NZ': 'asia',
    'SG': 'asia', 'MY': 'asia', 'TH': 'asia', 'VN': 'asia', 'ID': 'asia', 'PH': 'asia',
    'BR': 'latam', 'AR': 'latam', 'CL': 'latam', 'CO': 'latam',
    'ZA': 'africa', 'EG': 'africa', 'NG': 'africa', 'KE': 'africa',
    'SA': 'me', 'AE': 'me', 'IL': 'me', 'TR': 'me', 'RU': 'other',
  }
  // Wikidata 返回的是 3 字母代码，需要映射
  const threeMap = {
    'USA': 'na', 'CAN': 'na', 'MEX': 'na',
    'DEU': 'eu', 'FRA': 'eu', 'GBR': 'eu', 'ITA': 'eu', 'ESP': 'eu',
    'NLD': 'eu', 'CHE': 'eu', 'SWE': 'eu', 'NOR': 'eu', 'DNK': 'eu', 'FIN': 'eu', 'POL': 'eu',
    'CHN': 'asia', 'JPN': 'asia', 'KOR': 'asia', 'IND': 'asia',
    'AUS': 'asia', 'NZL': 'asia',
    'SGP': 'asia', 'MYS': 'asia', 'THA': 'asia', 'VNM': 'asia', 'IDN': 'asia', 'PHL': 'asia',
    'BRA': 'latam', 'ARG': 'latam', 'CHL': 'latam', 'COL': 'latam',
    'ZAF': 'africa', 'EGY': 'africa', 'NGA': 'africa', 'KEN': 'africa',
    'SAU': 'me', 'ARE': 'me', 'ISR': 'me', 'TUR': 'me', 'RUS': 'other',
  }
  return threeMap[countryCode] || map[countryCode] || 'other'
}

/**
 * 从 Wikidata SPARQL 获取真实公司数据
 * 完全免费，无需 API Key
 */
export async function fetchFromWikidata(params) {
  const { keyword, region = '', industry = '', count = 10, exclude = [] } = params

  // 构建 SPARQL 查询
  // 查找公司（Q4830453），按标签模糊匹配 keyword
  const sparql = `
PREFIX wd: <http://www.wikidata.org/entity/>
PREFIX wdt: <http://www.wikidata.org/prop/direct/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX schema: <http://schema.org/>
PREFIX bd: <http://www.bigdata.com/rdf#>

SELECT ?company ?companyLabel ?website ?countryLabel ?desc WHERE {
  ?company wdt:P31/wdt:P279* wd:Q4830453 .
  ?company rdfs:label ?companyLabel .
  FILTER(CONTAINS(LCASE(?companyLabel), LCASE("${keyword.replace(/"/g, '""')}")))
  OPTIONAL { ?company wdt:P856 ?website . }
  OPTIONAL { ?company wdt:P17 ?country . }
  OPTIONAL {
    ?company schema:description ?desc .
    FILTER(LANG(?desc) = "en")
  }
  SERVICE wikibase:label {
    bd:serviceParam wikibase:language "en" .
  }
}
LIMIT ${count}
`.trim()

  const url = 'https://query.wikidata.org/sparql?query=' + encodeURIComponent(sparql) + '&format=json'

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 15000)

  try {
    const response = await fetch(url, {
      headers: { 'Accept': 'application/json' },
      signal: controller.signal,
    })
    clearTimeout(timeoutId)

    if (!response.ok) {
      throw new Error(`Wikidata SPARQL request failed: ${response.status}`)
    }

    const data = await response.json()
    const bindings = data.results?.bindings || []

    if (bindings.length === 0) return []

    const leads = bindings
      .filter(b => b.companyLabel && b.companyLabel.value)
      .map(b => {
        const countryLabel = b.countryLabel?.value || ''
        const countryCode = COUNTRY_LABEL_TO_CODE[countryLabel] || countryLabel

        return {
          company: b.companyLabel.value,
          country: countryCode,
          region: mapRegion(countryCode),
          industry: industry || '',
          desc: b.desc?.value || `${b.companyLabel.value} - company profile from Wikidata.`,
          score: 82,
          email: '',
          website: b.website?.value || '',
          _source: 'wikidata',
        }
      })
      .filter(lead => !exclude.includes(lead.company))

    return leads
  } catch (e) {
    if (e.name === 'AbortError') {
      console.warn('[Wikidata] Request timed out after 15s')
    } else {
      console.warn('[Wikidata] Fetch failed:', e.message)
    }
    return []
  }
}
