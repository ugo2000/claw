/**
 * 支付服务层 - Stripe 集成
 * 支持：信用卡、Apple Pay、Google Pay
 *
 * 配置方式：
 *   1. 开发模式：用 Stripe CLI 登录后获取测试 key
 *   2. 生产模式：在 Stripe Dashboard 获取 live key
 *
 * 环境变量（.env）：
 *   VITE_STRIPE_PUBLISHABLE_KEY=pk_test_xxx
 *   STRIPE_SECRET_KEY=sk_test_xxx   （后端用，不暴露在前端）
 */

// ========== 配置 ==========
const STRIPE_PK = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || ''

// ========== Stripe 实例（懒加载）=============
let stripeInstance = null
let elementsInstance = null

/**
 * 获取 Stripe 实例（单例）
 */
export async function getStripe() {
  if (stripeInstance) return stripeInstance
  if (!STRIPE_PK) {
    console.warn('Stripe 未配置，将使用本地模拟模式')
    return null
  }
  const { loadStripe } = await import('@stripe/stripe-js')
  stripeInstance = await loadStripe(STRIPE_PK)
  return stripeInstance
}

/**
 * 创建支付 Intent（调用后端 API）
 * @param {number} amount - 金额（单位：分，如 990 = ¥9.90）
 * @param {number} credits - 对应积分数量
 * @param {string} packageKey - 套餐 key
 * @returns {Promise<{clientSecret: string, error: string|null}>}
 */
export async function createPaymentIntent(amount, credits, packageKey) {
  try {
    const response = await fetch('/api/payment/create-intent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount,
        currency: 'cny',       // 人民币；如需美元改用 'usd'
        metadata: {
          credits: String(credits),
          package: packageKey,
          userId: getUserId(),
        },
      }),
    })

    if (!response.ok) {
      const err = await response.json().catch(() => ({}))
      return { clientSecret: null, error: err.message || `HTTP ${response.status}` }
    }

    const data = await response.json()
    return { clientSecret: data.clientSecret, error: null }
  } catch (err) {
    return { clientSecret: null, error: err.message }
  }
}

/**
 * 显示 Stripe 支付弹窗（最佳实践：用 Stripe Checkout）
 * @param {Object} params - { amount, credits, packageKey, packageLabel }
 * @returns {Promise<{success: boolean, error: string|null}>}
 */
export async function openStripeCheckout(params) {
  const { amount, credits, packageKey } = params

  // ---- 模式 1：Stripe 已配置 → 真实支付 ----
  const stripe = await getStripe()
  if (stripe) {
    return await realStripeCheckout(stripe, { amount, credits, packageKey })
  }

  // ---- 模式 2：未配置 Stripe → 本地模拟 ----
  return simulatePayment(params)
}

async function realStripeCheckout(stripe, { amount, credits, packageKey }) {
  try {
    // 调用后端创建 Checkout Session
    const response = await fetch('/api/payment/create-checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount,
        credits,
        packageKey,
        userId: getUserId(),
        successUrl: window.location.origin + '/profile?payment=success',
        cancelUrl: window.location.origin + '/profile?payment=cancel',
      }),
    })

    if (!response.ok) {
      const err = await response.json().catch(() => ({}))
      return { success: false, error: err.message || 'Payment creation failed' }
    }

    const { url, sessionId } = await response.json()

    // 跳转到 Stripe Checkout 页面
    const { error } = await stripe.redirectToCheckout({ sessionId })
    if (error) {
      return { success: false, error: error.message }
    }

    return { success: true, error: null }
  } catch (err) {
    return { success: false, error: err.message }
  }
}

/**
 * 本地模拟支付（开发/演示用）
 */
async function simulatePayment({ amount, credits, packageKey, packageLabel }) {
  const confirmed = window.confirm(
    `[模拟支付] ${packageLabel}\n` +
    `金额：¥${(amount / 100).toFixed(2)}\n` +
    `积分：+${credits}\n\n点击"确定"模拟支付成功，"取消"模拟支付失败。`
  )

  if (!confirmed) {
    return { success: false, error: 'Payment cancelled by user' }
  }

  // 模拟网络延迟
  await new Promise(resolve => setTimeout(resolve, 800))

  return { success: true, error: null }
}

/**
 * 查询支付结果（前端轮询或从 URL 参数读取）
 */
export async function verifyPayment(sessionId) {
  try {
    const response = await fetch(`/api/payment/verify?session_id=${sessionId}`)
    if (!response.ok) return { verified: false, error: 'Verification failed' }
    const data = await response.json()
    return { verified: data.uccess, credits: data.credits, error: null }
  } catch (err) {
    return { verified: false, error: err.message }
  }
}

// ========== 辅助函数 ==========

function getUserId() {
  try {
    const user = JSON.parse(localStorage.getItem('claw_local_user') || 'null')
    return user?.id || 'local_' + (localStorage.getItem('claw_local_user_id') || 'anonymous')
  } catch {
    return 'anonymous'
  }
}

export function isStripeConfigured() {
  return !!STRIPE_PK
}
