/**
 * 微信/支付宝 个人收款 + 支付凭证上传
 * 流程：用户扫码支付 → 上传支付截图 → 自动验证（选填）→ 积分到账
 */

const PAYMENT_CONFIG = {
  wechat: {
    enabled: true,
    qrImageUrl: '/wechat-qr.png',   // 把你的微信收款码放到 public/ 下
    wechatId: 'your_wechat_id',      // 微信号（用户无法扫码时手动添加）
    payeeName: 'Claw 客服',          // 收款人姓名
  },
  alipay: {
    enabled: true,
    qrImageUrl: '/alipay-qr.png',   // 把你的支付宝收款码放到 public/ 下
    alipayId: 'your_alipay_id',     // 支付宝账号
    payeeName: 'Claw 客服',
  },
  // 自动审核：true = 用户上传截图后自动到账（适合小额）
  //          false = 需要你手动审核
  autoApprove: false,
  adminEmail: 'admin@yourdomain.com',
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
