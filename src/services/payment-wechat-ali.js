/**
 * 微信/支付宝 个人收款服务
 * 适用场景：SOHO个人，无企业资质
 * 流程：用户扫码支付 → 点击"已支付" → 积分即时到账（信任模式）
 * 管理后台可查看所有支付记录
 */
import { ref } from 'vue'

// ============ 配置区（你需要替换成自己的收款码）================
// 把你的微信/支付宝收款码图片放到 public/ 目录下，然后在这里配置路径
const PAYMENT_CONFIG = {
  wechat: {
    enabled: true,
    // 微信收款码图片路径（上传到 public/wechat-qr.png）
    qrImageUrl: '/wechat-qr.png',
    // 微信号（用户无法扫码时手动添加）
    wechatId: 'your_wechat_id',
    // 收款人姓名
    payeeName: 'Your Name',
  },
  alipay: {
    enabled: true,
    // 支付宝收款码图片路径（上传到 public/alipay-qr.png）
    qrImageUrl: '/alipay-qr.png',
    // 支付宝账号
    alipayId: 'your_alipay_id',
    payeeName: 'Your Name',
  },
  // 管理员审核模式（false = 信任模式，支付后立即到账）
  // 设为 true 需要管理员审核后才到账
  requireApproval: false,
  adminEmail: 'admin@yourdomain.com',
}
// ================================================================

// 支付记录（localStorage 持久化）
const ORDERS_KEY = 'claw_payment_orders'
const PENDING_ORDERS_KEY = 'claw_pending_orders'

function getOrders() {
  try { return JSON.parse(localStorage.getItem(ORDERS_KEY) || '[]') }
  catch { return [] }
}
function saveOrders(orders) {
  localStorage.setItem(ORDERS_KEY, JSON.stringify(orders))
}

/**
 * 创建支付订单
 * @param {string} packageKey - starter/standard/pro/enterprise
 * @param {object} pkg - 套餐信息 { price, credits }
 * @param {string} method - 'wechat' | 'alipay'
 * @param {object} user - 当前用户
 * @returns {{ orderId: string, payUrl: string }}
 */
export function createPaymentOrder(packageKey, pkg, method, user) {
  const orderId = 'ORD' + Date.now() + Math.random().toString(36).slice(2, 7)
  const order = {
    orderId,
    packageKey,
    packageLabel: pkg.label,
    amount: pkg.price,
    credits: pkg.credits,
    method, // 'wechat' | 'alipay'
    status: 'pending', // pending → paid → approved
    userId: user?.id || 'unknown',
    userEmail: user?.email || '',
    userName: user?.name || '',
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
 * 用户确认已支付（信任模式：立即到账）
 * 审核模式：仅标记 paid，等待管理员审核
 */
export function confirmPayment(orderId, creditsStore) {
  const orders = getOrders()
  const order = orders.find(o => o.orderId === orderId)
  if (!order) return { success: false, error: 'Order not found' }

  if (order.status !== 'pending') {
    return { success: false, error: 'Order already processed' }
  }

  order.status = PAYMENT_CONFIG.requireApproval ? 'paid' : 'approved'
  order.paidAt = Date.now()
  if (!PAYMENT_CONFIG.requireApproval) {
    order.approvedAt = Date.now()
    // 信任模式：立即到账
    if (creditsStore) {
      creditsStore.recharge(order.packageKey)
    }
  }
  saveOrders(orders)

  return {
    success: true,
    requireApproval: PAYMENT_CONFIG.requireApproval,
    credits: PAYMENT_CONFIG.requireApproval ? 0 : order.credits,
  }
}

/**
 * 管理员审核通过（审核模式下调用）
 */
export function approveOrder(orderId, creditsStore) {
  const orders = getOrders()
  const order = orders.find(o => o.orderId === orderId)
  if (!order) return { success: false, error: 'Order not found' }

  order.status = 'approved'
  order.approvedAt = Date.now()
  if (creditsStore) {
    creditsStore.recharge(order.packageKey)
  }
  saveOrders(orders)
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
 * 获取支付配置（供前端显示）
 */
export function getPaymentConfig() {
  return {
    wechat: PAYMENT_CONFIG.wechat,
    alipay: PAYMENT_CONFIG.alipay,
    requireApproval: PAYMENT_CONFIG.requireApproval,
  }
}

/**
 * 更新支付配置（管理员用）
 */
export function updatePaymentConfig(newConfig) {
  if (newConfig.wechat) Object.assign(PAYMENT_CONFIG.wechat, newConfig.wechat)
  if (newConfig.alipay) Object.assign(PAYMENT_CONFIG.alipay, newConfig.alipay)
  if (newConfig.requireApproval !== undefined) {
    PAYMENT_CONFIG.requireApproval = newConfig.requireApproval
  }
  // 持久化配置到 localStorage
  localStorage.setItem('claw_payment_config', JSON.stringify(PAYMENT_CONFIG))
}

// 初始化时从 localStorage 恢复配置
try {
  const saved = localStorage.getItem('claw_payment_config')
  if (saved) {
    const parsed = JSON.parse(saved)
    Object.assign(PAYMENT_CONFIG, parsed)
  }
} catch {}
