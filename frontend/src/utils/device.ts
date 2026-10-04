// Phone detection for sending phone users to the 手机版 (/m) from 登录 and 首页

const PREFER_DESKTOP_KEY = 'flora.preferDesktop'

/** Phones by user agent; small touch screens as a fallback. Tablets get the computer version. */
export function isMobileDevice(): boolean {
  if (/Mobi|iPhone|iPod/i.test(navigator.userAgent)) return true
  const coarse = window.matchMedia?.('(pointer: coarse)').matches ?? false
  return coarse && Math.min(window.screen.width, window.screen.height) < 600
}

/** 切换到电脑版 / 电脑版查看: stay on the computer version until this tab is closed */
export function preferDesktop() {
  try { sessionStorage.setItem(PREFER_DESKTOP_KEY, '1') } catch { /* ignore */ }
}

function prefersDesktop(): boolean {
  try { return sessionStorage.getItem(PREFER_DESKTOP_KEY) === '1' } catch { return false }
}

export function shouldUseMobile(): boolean {
  return isMobileDevice() && !prefersDesktop()
}
