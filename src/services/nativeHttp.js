// nativeHttp.js — 统一 HTTP 层
// Capacitor App 环境：走原生 Java HttpURLConnection（绕过 WebView 限制）
// 浏览器 / dev 环境：走原生 window.fetch()

import { Capacitor } from '@capacitor/core'

/**
 * 获取 NativeHttp 插件实例（已在 MainActivity.java 中注册）
 */
function getNativeHttp() {
  const plugin = window?.Capacitor?.Plugins?.NativeHttp
  if (!plugin) {
    throw new Error('NativeHttp plugin not found. Make sure registerPlugin(NativeHttp.class) is in MainActivity.java and the APK is rebuilt.')
  }
  return plugin
}

/**
 * 统一 HTTP 请求，接口与 window.fetch 兼容
 * @param {string} url
 * @param {object} [opts] - { method, headers, body }
 * @returns {Promise<{ ok: boolean, status: number, json(): Promise, text(): Promise }>}
 */
export async function nativeFetch(url, opts = {}) {
  // 非原生环境：直接用浏览器 fetch
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

  // Native App：通过原生插件发请求（绕过 WebView 的 CORS/SSL 限制）
  const NativeHttp = getNativeHttp()

  const method = (opts.method || 'GET').toUpperCase()

  // 把 Headers 对象或普通 object 都转为普通 {}
  const headersObj = {}
  if (opts.headers) {
    const src = opts.headers
    if (typeof src.entries === 'function') {
      for (const [k, v] of src.entries()) headersObj[k] = String(v)
    } else {
      for (const [k, v] of Object.entries(src)) headersObj[k] = String(v)
    }
  }

  const result = await NativeHttp.request({
    url,
    method,
    headers: headersObj,
    body: opts.body ?? null,
  })

  const responseBody = result.body ?? ''
  return {
    ok: !!result.ok,
    status: result.status,
    json: async () => JSON.parse(responseBody),
    text: async () => responseBody,
  }
}
