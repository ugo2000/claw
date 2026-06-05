/**
 * Supabase Edge Function: 创建支付宝 App 支付订单
 *
 * 环境变量（在 Supabase Dashboard → Settings → Edge Functions 中配置）:
 *   ALIPAY_APP_ID         - 支付宝开放平台应用 APPID
 *   ALIPAY_PRIVATE_KEY    - 应用私钥（PKCS#8 格式，注意换行用 \n）
 *   ALIPAY_PUBLIC_KEY     - 支付宝公钥（对应应用公钥证书）
 *   ALIPAY_NOTIFY_URL     - 回调地址，例如 https://<project>.supabase.co/functions/v1/alipay-callback
 *   SUPABASE_URL           - 自动注入
 *   SUPABASE_SERVICE_ROLE_KEY - 自动注入
 *
 * 请求体: { packageKey: "trial"|"basic"|"pro"|"premium", userId: string, userEmail: string }
 * 响应:   { success: true, orderId: string, payParams: string }  // payParams 直接传给支付宝 SDK
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'
import { crypto } from 'https://deno.land/std@0.188.0/crypto/mod.ts'

// --------  helpers  --------
function sortParams(params: Record<string, string>): string {
  return Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join('&')
}

async function signRSA2(
  content: string,
  privateKeyPem: string,
): Promise<string> {
  // 把 PKCS#1 私钥转成可用于 WebCrypto 的 PKCS#8 格式（如果用户提供的是 PKCS#1）
  // 这里假定 ALIPAY_PRIVATE_KEY 已经是 PKCS#8 格式（-----BEGIN PRIVATE KEY-----）
  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToArrayBuffer(privateKeyPem),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    new TextEncoder().encode(content),
  )
  return btoa(String.fromCharCode(...new Uint8Array(sig)))
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const b64 = pem
    .replace(/-----BEGIN[^-]+-----/, '')
    .replace(/-----END[^-]+-----/, '')
    .replace(/\s+/g, '')
  const bin = atob(b64)
  const buf = new ArrayBuffer(bin.length)
  const view = new Uint8Array(buf)
  for (let i = 0; i < bin.length; i++) view[i] = bin.charCodeAt(i)
  return buf
}

function arrayBufferToPem(buf: ArrayBuffer, type: string): string {
  const b64 = btoa(String.fromCharCode(...new Uint8Array(buf)))
  const lines = b64.match(/.{1,64}/g) || []
  return `-----BEGIN ${type}-----\n${lines.join('\n')}\n-----END ${type}-----\n`
}

// --------  套餐配置  --------
const PACKAGES: Record<string, { name: string; price: number; credits: number }> = {
  trial:   { name: 'Starter Pack',   price: 9.90,  credits: 100  },
  basic:   { name: 'Standard Pack',  price: 49.00, credits: 600  },
  pro:     { name: 'Pro Pack',       price: 99.00, credits: 1500 },
  premium: { name: 'Enterprise Pack',price: 199.00,credits: 3500 },
}

Deno.serve(async (req) => {
  // CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin':  '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    })
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ success: false, error: 'Method not allowed' }), { status: 405 })
  }

  try {
    const { packageKey, userId, userEmail } =
      (await req.json()) as { packageKey: string; userId: string; userEmail: string }

    const pkg = PACKAGES[packageKey]
    if (!pkg) {
      return new Response(JSON.stringify({ success: false, error: 'Invalid package' }), { status: 400 })
    }

    const ALIPAY_APP_ID      = Deno.env.get('ALIPAY_APP_ID')!
    const ALIPAY_PRIVATE_KEY = Deno.env.get('ALIPAY_PRIVATE_KEY')!
    const NOTIFY_URL         = Deno.env.get('ALIPAY_NOTIFY_URL')!
    const SUPABASE_URL        = Deno.env.get('SUPABASE_URL')!
    const SERVICE_KEY        = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    if (!ALIPAY_APP_ID || !ALIPAY_PRIVATE_KEY) {
      return new Response(
        JSON.stringify({ success: false, error: 'Alipay credentials not configured' }),
        { status: 500 },
      )
    }

    const orderId = `ALI${Date.now()}${Math.random().toString(36).slice(2, 7)}`

    // 构造支付宝 app_pay 参数（alipay.trade.app.pay）
    const params: Record<string, string> = {
      app_id:         ALIPAY_APP_ID,
      method:         'alipay.trade.app.pay',
      charset:        'utf-8',
      sign_type:      'RSA2',
      timestamp:      new Date().toISOString().replace(/[-:]/g, '').slice(0, 14),
      version:        '1.0',
      notify_url:     NOTIFY_URL,
      biz_content:    JSON.stringify({
        out_trade_no: orderId,
        total_amount:  pkg.price.toFixed(2),
        subject:       `Claw - ${pkg.name}`,
        product_code:  'QUICK_MSECURITY_PAY',
      }),
    }

    const unsigned = sortParams(params)
    params.sign = await signRSA2(unsigned, ALIPAY_PRIVATE_KEY)

    // 把参数编码成 URL query string（支付宝 SDK 需要这种格式）
    const payParams = Object.entries(params)
      .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
      .join('&')

    // 写入 Supabase claw_orders 表
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY)
    await supabase.from('claw_orders').insert({
      order_id:   orderId,
      user_id:    userId,
      user_email: userEmail,
      package_key: packageKey,
      amount:     pkg.price,
      credits:    pkg.credits,
      method:     'alipay',
      status:     'pending',
      created_at: new Date().toISOString(),
    })

    return new Response(
      JSON.stringify({ success: true, orderId, payParams }),
      {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      },
    )
  } catch (err) {
    console.error('create-alipay-order error:', err)
    return new Response(
      JSON.stringify({ success: false, error: String(err) }),
      { status: 500 },
    )
  }
})
