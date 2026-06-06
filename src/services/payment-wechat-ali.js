/**
 * 微信/支付宝 个人收款 + 支付凭证上传
 * 流程：用户扫码支付 → 上传支付截图 → 自动验证（选填）→ 积分到账
 */

const PAYMENT_CONFIG = {
  wechat: {
    enabled: true,
    qrImageUrl: '/wechat-qr.png',   // 微信收款码（已放在 public/wechat-qr.png）
    wechatId: '',                    // 留空 = 不显示微信号文字
    payeeName: '贸虾',
  },
  alipay: {
    enabled: true,
    qrImageUrl: '/alipay-qr.png',   // 支付宝收款码（已放在 public/alipay-qr.png）
    alipayId: '',                    // 留空 = 不显示账号文字
    payeeName: '贸虾',
  },
  // autoApprove: false = 用户上传截图后等待人工审核后到账
  // autoApprove: true  = 用户上传截图后立即到账（小额信任模式）
  autoApprove: true,
  adminEmail: 'admin@tradeclaw.com',
}

const ORDERS_KEY = 'claw_payment_orders'

function getOrders() {
  try { return JSON.parse(localStorage.getItem(ORDERS_KEY) || '[]') }
  catch { return [] }
}
function saveOrders(orders) {
  localStorage.setItem(ORDERS_KEY, JSON.stringify(orders))
}

/**
 * 创建支付订单
 * @returns {{ orderId, payUrl }}
 */
export function createPaymentOrder(packageKey, pkg, method, user) {
  const orderId = 'ORD' + Date.now() + Math.random().toString(36).slice(2, 7)
  const order = {
    orderId,
    packageKey,
    packageLabel: pkg.label,
    amount: pkg.price,
    credits: pkg.credits,
    method,           // 'wechat' | 'alipay'
    status: 'pending', // pending → paid → approved
    userId: user?.id || 'unknown',
    userEmail: user?.email || '',
    userName: user?.name || '',
    proofImage: null,  // 支付凭证图片（base64 或 URL）
    createdAt: Date.now(),
    paidAt: null,
    approvedAt: null,
  }

  const orders = getOrders()
  orders.unshift(order)
  saveOrders(orders)
  return { orderId, order }
}

/**
 * 用户上传支付凭证
 */
export function uploadProof(orderId, proofImageBase64) {
  const orders = getOrders()
  const order = orders.find(o => o.orderId === orderId)
  if (!order) return { success: false, error: 'Order not found' }
  if (order.status !== 'pending') {
    return { success: false, error: 'Order already processed' }
  }
  order.proofImage = proofImageBase64
  order.status = 'paid'   // 已支付，等待审核
  order.paidAt = Date.now()
  saveOrders(orders)

  // 如果开启自动审核，直接到账
  if (PAYMENT_CONFIG.autoApprove) {
    return approveOrder(orderId)
  }

  return { success: true, autoApprove: false }
}

/**
 * 管理员审核通过
 */
export function approveOrder(orderId, creditsStore) {
  const orders = getOrders()
  const order = orders.find(o => o.orderId === orderId)
  if (!order) return { success: false, error: 'Order not found' }
  if (order.status === 'approved') {
    return { success: false, error: 'Already approved' }
  }
  order.status = 'approved'
  order.approvedAt = Date.now()
  saveOrders(orders)

  // 给用户加积分
  if (creditsStore) {
    creditsStore.recharge(order.packageKey)
  }
  return { success: true, credits: order.credits }
}

/**
 * 获取所有订单（管理员用）
 */
export function getAllOrders() {
  return getOrders()
}

/**
 * 获取用户订单
 */
export function getUserOrders(userEmail) {
  return getOrders().filter(o => o.userEmail === userEmail)
}

/**
 * 获取支付配置
 */
export function getPaymentConfig() {
  return {
    wechat: PAYMENT_CONFIG.wechat,
    alipay: PAYMENT_CONFIG.alipay,
    autoApprove: PAYMENT_CONFIG.autoApprove,
  }
}

/**
 * 更新支付配置（管理员用）
 */
export function updatePaymentConfig(newConfig) {
  if (newConfig.wechat) Object.assign(PAYMENT_CONFIG.wechat, newConfig.wechat)
  if (newConfig.alipay) Object.assign(PAYMENT_CONFIG.alipay, newConfig.alipay)
  if (newConfig.autoApprove !== undefined) {
    PAYMENT_CONFIG.autoApprove = newConfig.autoApprove
  }
  localStorage.setItem('claw_payment_config', JSON.stringify(PAYMENT_CONFIG))
}

// 初始化：从 localStorage 恢复配置
try {
  const saved = localStorage.getItem('claw_payment_config')
  if (saved) Object.assign(PAYMENT_CONFIG, JSON.parse(saved))
} catch {}
