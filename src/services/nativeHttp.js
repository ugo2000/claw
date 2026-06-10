// nativeHttp.js — 统一 HTTP 层
// Capacitor App 环境：走原生 Java HttpURLConnection（绕过 WebView 限制）
// 浏览器 / dev 环境：走原生 window.fetch()

import { Capacitor, registerPlugin } from '@capacitor/core'

let _NativeHttp = null

function getNativeHttp() {
  if (_NativeHttp) return _NativeHttp

  // Capacitor 5+：用 registerPlugin 注册原生插件
  // 返回的是一个 Proxy，直接调用 request() 即可
  try {
    _NativeHttp = registerPlugin('NativeHttp')
  } catch (e) {
    // fallback：旧版 Capacitor
    _NativeHttp = Capacitor.Plugins?.NativeHttp
    if (!_NativeHttp) {
      throw new Error('NativeHttp plugin not registered. Please rebuild the App.')
    }
  }

  return _NativeHttp
}

/**
 * 统一 HTTP 请求
 * @param {string} url
 * @param {object} [opts] - { method, headers, body }
 * @returns {Promise<{ ok: boolean, status: number, json(): Promise, text(): Promise }>}
 */
export async function nativeFetch(url, opts = {}) {
  // 非原生环境：直接用 fetch
  if (!Capacitor.isNativePlatform()) {
    const response = await window.fetch(url, opts)
    const text = await response.text()
    return {
      ok: response.ok,
      status: response.status,
      json: async () => JSON.parse(text),
      text: async () => text,
    }
  }

  // Native App：通过 Capacitor 原生插件发请求
  const NativeHttp = getNativeHttp()

  const method = (opts.method || 'GET').toUpperCase()
  const headersObj = {}
  if (opts.headers) {
    const entries = opts.headers.entries
      ? opts.headers.entries()
      : Object.entries(opts.headers)
    for (const [k, v] of entries) {
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
