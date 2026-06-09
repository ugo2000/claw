/**
 * Native HTTP bridge — 在 Capacitor App 里用原生代码发 HTTP 请求
 * 绕过 Android WebView 的网络限制（CORS、SSL、scheme 等）
 *
 * 使用方式（与 fetch() 兼容）：
 *   import { nativeFetch } from './nativeHttp.js'
 *   const res = await nativeFetch('https://serpapi.com/...')
 *   const data = await res.json()
 */

import { Capacitor } from '@capacitor/core'
import { registerPlugin } from '@capacitor/core'

// 注册原生插件（与 Android 端 NativeHttp.java 对应）
const NativeHttp = registerPlugin('NativeHttp')

/**
 * 判断当前是否运行在原生 App 中
 */
export function isNativeApp() {
  return Capacitor.isNativePlatform()
}

/**
 * 原生 fetch 封装 — 与 window.fetch() 保持兼容
 *
 * @param {string} url - 请求 URL
 * @param {Object} [options] - 标准 fetch options
 * @returns {Promise<{ok: boolean, status: number, json(): Promise, text(): Promise}>}
 */
export async function nativeFetch(url, options = {}) {
  // 非原生环境：直接用浏览器 fetch
  if (!isNativeApp()) {
    return window.fetch(url, options)
  }

  // === 原生环境：通过 Java 插件发请求 ===
  const method = (options?.method || 'GET').toUpperCase()

  // 构造 headers 对象
  const headers = {}
  if (options?.headers) {
    if (options.headers instanceof Headers) {
      options.headers.forEach((v, k) => { headers[k] = v })
    } else if (typeof options.headers === 'object') {
      Object.assign(headers, options.headers)
    }
  }

  // 获取 body 字符串
  let body = undefined
  if (options?.body) {
    body = typeof options.body === 'string' ? options.body : JSON.stringify(options.body)
  }

  console.log(`[NativeHttp] ${method} ${url}`)

  try {
    const result = await NativeHttp.request({ url, method, headers, body })

    return {
      ok: result.ok,
      status: result.status,
      async json() { return JSON.parse(result.body) },
      async text() { return result.body },
    }
  } catch (err) {
    console.error('[NativeHttp] Error:', err)
    throw new Error(err.message || 'Native HTTP request failed')
  }
}

export default { nativeFetch, isNativeApp }
