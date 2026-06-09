// nativeHttp.js — 统一 HTTP 层
// Capacitor App 环境：走原生 Java HttpURLConnection（绕过 WebView 限制）
// 浏览器 / dev 环境：走原生 window.fetch()

import { Capacitor } from '@capacitor/core'

const isNative = Capacitor.isNativePlatform()

/**
 * 统一 HTTP 请求
 * @param {string} url
 * @param {object} [opts] - { method, headers, body }
 * @returns {Promise<{ ok: boolean, status: number, json(): Promise }>}
 */
export async function nativeFetch(url, opts = {}) {
  if (!isNative) {
    // 浏览器 / dev：直接用 fetch
    const response = await window.fetch(url, opts)
    const text = await response.text()
    return {
      ok: response.ok,
      status: response.status,
      json: async () => JSON.parse(text),
      text: async () => text,
    }
  }

  // Native App：通过 Capacitor 插件桥接调用 Java
  const NativeHttp = Capacitor.getPlugin('NativeHttp') || Capacitor.plugins.NativeHttp
  if (!NativeHttp) {
    throw new Error('NativeHttp plugin not registered. Please rebuild the App.')
  }

  const method = (opts.method || 'GET').toUpperCase()
  const headersObj = {}
  if (opts.headers) {
    for (const [k, v] of Object.entries(opts.headers)) {
      headersObj[k] = String(v)
    }
  }

  const result = await NativeHttp.request({
    url,
    method,
    headers: headersObj,
    body: opts.body || null,
  })

  // 把 Java 返回的结果包装成和 fetch() 兼容的形状
  const responseBody = result.body || ''
  return {
    ok: result.ok,
    status: result.status,
    json: async () => JSON.parse(responseBody),
    text: async () => responseBody,
  }
}
