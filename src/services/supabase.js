/**
 * Supabase 后端服务层
 * 提供用户认证、积分管理、客户数据持久化
 *
 * 使用前需配置环境变量：
 *   VITE_SUPABASE_URL - Supabase 项目 URL
 *   VITE_SUPABASE_ANON_KEY - Supabase anon/public key
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

// 检测是否为有效配置（排除占位符）
function isRealConfig() {
  if (!supabaseUrl || !supabaseAnonKey) return false
  // 排除常见占位符
  const placeholders = ['xxxxx', 'your-project', 'example', 'placeholder', 'todo']
  const urlLower = supabaseUrl.toLowerCase()
  const keyLower = supabaseAnonKey.toLowerCase()
  if (placeholders.some(p => urlLower.includes(p) || keyLower.includes(p))) return false
  // URL 必须是以 https:// 开头的有效 supabase 域名
  return /^https:\/\/[a-z0-9-]+\.supabase\.(co|in|net)$/i.test(supabaseUrl)
}

let client = null

/**
 * 初始化 Supabase 客户端（懒加载）
 */
export function getSupabase() {
  if (!supabaseUrl || !supabaseAnonKey) {
    return null // 未配置时返回 null，App 以本地模式运行
  }
  if (!client) {
    client = createClient(supabaseUrl, supabaseAnonKey)
  }
  return client
}

/**
 * 检查 Supabase 是否已配置
 */
export function isSupabaseConfigured() {
  return isRealConfig()
}

// ===================== 用户认证 =====================

/**
 * 手机号 + 验证码登录（国内常用）
 */
export async function signInWithPhone(phone, code) {
  const sb = getSupabase()
  if (!sb) throw new Error('后端未配置')
  const { data, error } = await sb.auth.verifyOtp({
    phone,
    token: code,
    type: 'sms',
  })
  if (error) throw error
  return data.user
}

/**
 * 发送登录验证码
 */
export async function sendLoginCode(phone) {
  const sb = getSupabase()
  if (!sb) throw new Error('后端未配置')
  const { error } = await sb.auth.signInWithOtp({ phone })
  if (error) throw error
  return true
}

/**
 * 邮箱密码登录（海外客户/备用）
 */
export async function signInWithEmail(email, password) {
  const sb = getSupabase()
  if (!sb) throw new Error('后端未配置')
  const { data, error } = await sb.auth.signInWithPassword({ email, password })
  if (error) throw error
  return data.user
}

/**
 * 注册新用户
 */
export async function signUp(email, password, userData = {}) {
  const sb = getSupabase()
  if (!sb) throw new Error('后端未配置')
  const { data, error } = await sb.auth.signUp({
    email,
    password,
    options: { data: userData },
  })
  if (error) throw error
  return data.user
}

/**
 * 退出登录
 */
export async function signOut() {
  const sb = getSupabase()
  if (!sb) return
  await sb.auth.signOut()
}

/**
 * 获取当前登录用户
 */
export async function getCurrentUser() {
  const sb = getSupabase()
  if (!sb) return null
  const { data: { user } } = await sb.auth.getUser()
  return user
}

// ===================== 积分系统 =====================

const TABLE_CREDITS = 'user_credits'
const TABLE_USAGE_LOGS = 'usage_logs'

/**
 * 获取或创建用户积分账户
 */
export async function getCreditsAccount(userId) {
  const sb = getSupabase()
  if (!sb) return null

  const { data, error } = await sb
    .from(TABLE_CREDITS)
    .select('*')
    .eq('user_id', userId)
    .single()

  if (error && error.code === 'PGRST116') {
    // 不存在，创建新账户（送 500 积分）
    const { data: newAcc, err: createErr } = await sb
      .from(TABLE_CREDITS)
      .insert({
        user_id: userId,
        balance: 500,
        total_recharged: 0,
        total_used: 0,
      })
      .select()
      .single()

    if (createErr) throw createErr
    return newAcc
  }

  if (error) throw error
  return data
}

/**
 * 扣除积分（原子操作，通过 RPC 调用数据库函数）
 */
export async function deductCredits(userId, amount, action) {
  const sb = getSupabase()
  if (!sb) return false

  // 使用 Supabase RPC 调用数据库函数保证原子性
  const { data, error } = await sb.rpc('deduct_credits', {
    p_user_id: userId,
    p_amount: amount,
    p_action: action,
  })

  if (error) throw error
  return data
}

/**
 * 充值积分
 */
export async function rechargeCredits(userId, pkgKey) {
  const sb = getSupabase()
  if (!sb) return false

  const packages = {
    trial:   { price: 9.9,  credits: 100 },
    basic:   { price: 49,   credits: 600 },
    pro:     { price: 99,  credits: 1500 },
    premium: { price: 199, credits: 3500 },
  }

  const pkg = packages[pkgKey]
  if (!pkg) throw new Error('无效的充值包')

  const { data, error } = await sb.rpc('recharge_credits', {
    p_user_id: userId,
    p_amount: pkg.credits,
    p_price: pkg.price,
    p_pkg_key: pkgKey,
  })

  if (error) throw error
  return data
}

// ===================== 客户数据 =====================

const TABLE_CLIENTS = 'clients'

/**
 * 获取客户的客户列表
 */
export async function getClients(userId) {
  const sb = getSupabase()
  if (!sb) return []

  const { data, error } = await sb
    .from(TABLE_CLIENTS)
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data || []
}

/**
 * 添加客户
 */
export async function addClient(userId, clientData) {
  const sb = getSupabase()
  if (!sb) return null

  const { data, error } = await sb
    .from(TABLE_CLIENTS)
    .insert({ user_id: userId, ...clientData })
    .select()
    .single()

  if (error) throw error
  return data
}

/**
 * 更新客户状态
 */
export async function updateClientStatus(clientId, status, note) {
  const sb = getSupabase()
  if (!sb) return false

  const updates = { status }
  if (note !== undefined) updates.note = note
  updates.updated_at = new Date().toISOString()

  const { error } = await sb
    .from(TABLE_CLIENTS)
    .update(updates)
    .eq('id', clientId)

  if (error) throw error
  return true
}

/**
 * 删除客户
 */
export async function deleteClient(clientId) {
  const sb = getSupabase()
  if (!sb) return false

  const { error } = await sb
    .from(TABLE_CLIENTS)
    .delete()
    .eq('id', clientId)

  if (error) throw error
  return true
}

// ===================== 开发信历史 =====================

const TABLE_EMAIL_HISTORY = 'email_history'

/**
 * 保存开发信记录
 */
export async function saveEmailHistory(userId, emailData) {
  const sb = getSupabase()
  if (!sb) return null

  const { data, error } = await sb
    .from(TABLE_EMAIL_HISTORY)
    .insert({ user_id: userId, ...emailData })
    .select()
    .single()

  if (error) throw error
  return data
}

/**
 * 获取开发信历史
 */
export async function getEmailHistory(userId, limit = 50) {
  const sb = getSupabase()
  if (!sb) return []

  const { data, error } = await sb
    .from(TABLE_EMAIL_HISTORY)
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw error
  return data || []
}
