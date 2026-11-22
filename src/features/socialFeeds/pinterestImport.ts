import { safeHttpUrl } from './parse'

/**
 * Pinterest import: the pure parts. A pasted pin address gives a pin id; the API answer gives the picture address.
 * Only pictures on Pinterest's own image host are ever downloaded.
 */

const PIN_PATH = /^\/pin\/(?:[^/]*--)?(\d{6,25})\/?$/

/** The pin id in a pinterest.com pin address (any country site, with or without www), or '' for anything else. */
export function pinIdFromAddress(raw: string): string {
  try {
    const u = new URL(raw.trim())
    if (u.protocol !== 'https:' || u.username || u.password) return ''
    if (!/^(?:(?:[a-z]{2}|www)\.)?pinterest\.(?:com|co\.[a-z]{2}|com\.[a-z]{2}|[a-z]{2})$/i.test(u.hostname)) return ''
    return PIN_PATH.exec(u.pathname)?.[1] ?? ''
  } catch {
    return ''
  }
}

export const pinApiUrl = (id: string): string => `https://api.pinterest.com/v5/pins/${encodeURIComponent(id)}`

/** True for a picture on Pinterest's image host (pinimg.com or a subdomain), https only. */
export function isPinimgUrl(raw: string): boolean {
  try {
    const u = new URL(raw)
    return u.protocol === 'https:' && !u.username && /(^|\.)pinimg\.com$/i.test(u.hostname)
  } catch {
    return false
  }
}

/** The largest picture address in a pin API answer (originals first), or '' when there is none. */
export function pinImageFromApi(body: string): string {
  try {
    const json = JSON.parse(body) as { media?: { images?: Record<string, { url?: unknown }> } }
    const images = json.media?.images ?? {}
    for (const key of ['originals', '1200x', '600x', '400x300', ...Object.keys(images)]) {
      const url = safeHttpUrl(images[key]?.url)
      if (url && isPinimgUrl(url)) return url
    }
  } catch {
    /* not JSON */
  }
  return ''
}
