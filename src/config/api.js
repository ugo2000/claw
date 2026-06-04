// API 配置
// 部署时请将 API_KEY 替换为你的真实密钥
// 建议通过环境变量 VITE_DEEPSEEK_API_KEY 传入，避免提交到代码仓库

const config = {
  // DeepSeek API 配置
  deepseek: {
    baseUrl: 'https://api.deepseek.com/v1',
    apiKey: import.meta.env.VITE_DEEPSEEK_API_KEY || '',
    // 推荐用 deepseek-chat（便宜、快、中文强）
    model: 'deepseek-chat',
    // 备选：deepseek-reasoner（推理更强，但更贵更慢）
  },

  // 功能 → 积分消耗映射
  creditCosts: {
    emailGenerate: 5,      // AI 开发信生成
    emailTranslate: 2,     // 翻译
    customerAnalysis: 10,  // 客户分析
    subjectLine: 2,       // 邮件标题优化
    replySuggest: 3,      // 回复建议
  },

  // 模型参数
  defaultParams: {
    temperature: 0.7,
    max_tokens: 2000,
    top_p: 0.9,
  },
}

export default config
