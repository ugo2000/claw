/**
 * 在 Capacitor 应用中打开外部链接
 * - 浏览器环境：window.open(url, '_blank')
 * - Capacitor Android/iOS：用 @capacitor/browser 打开
 */
import { Browser } from '@capacitor/browser'

export async function openExternalUrl(url) {
  if (!url) return

  // 确保在浏览器环境下也能工作（开发时）
  const isCapacitor = typeof window !== 'undefined' && !!window.Capacitor

  if (isCapacitor) {
    try {
      await Browser.open({ url })
    } catch (err) {
      console.warn('[browser] Browser.open failed, fallback to window.open', err)
      window.open(url, '_blank')
    }
  } else {
    window.open(url, '_blank')
  }
}
