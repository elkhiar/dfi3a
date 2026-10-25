import { Capacitor } from '@capacitor/core'

const nativeUrlScheme = 'dfi3a'

export function getAppRedirectUrl(path: string) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  if (Capacitor.isNativePlatform()) {
    return `${nativeUrlScheme}://${normalizedPath.slice(1)}`
  }
  return new URL(normalizedPath, window.location.origin).toString()
}

export function getNativeRoute(url: string) {
  if (!url.startsWith(`${nativeUrlScheme}://`)) return null

  const parsed = new URL(url)
  return `/${parsed.host}${parsed.pathname}${parsed.search}${parsed.hash}`
}
