/**
 * Font Awesome Pro for one site (Task 12, 31g). The owner adds their own licence as a kit code or a Pro stylesheet address;
 * nothing from Pro is bundled in the repo. Without it the icon pickers keep to the free built-in set. Pure: no database, no request.
 */
export type FontAwesomeMode = 'off' | 'kit' | 'cdn'
export type FontAwesomeConfig = { mode: FontAwesomeMode; kitCode: string; cdnUrl: string }

export const EMPTY_FONT_AWESOME: FontAwesomeConfig = { mode: 'off', kitCode: '', cdnUrl: '' }

/** Pro style prefixes the picker offers once a licence is added. The free set only has solid, regular (a few) and brands. */
export const FA_PRO_STYLES = ['fa-solid', 'fa-regular', 'fa-light', 'fa-thin', 'fa-duotone', 'fa-sharp'] as const

const KIT_CODE = /^[a-f0-9]{10}$/i
const PRO_HOSTS = new Set(['use.fontawesome.com', 'kit.fontawesome.com', 'kit-pro.fontawesome.com', 'pro.fontawesome.com', 'site-assets.fontawesome.com'])

/** Kit codes are 10 hex characters; the owner may paste the whole kit address or script tag, so the code is pulled out of it. */
export function cleanKitCode(value: unknown): string {
  if (typeof value !== 'string') return ''
  const raw = value.trim()
  const fromUrl = /kit\.fontawesome\.com\/([a-f0-9]{10})(?:\.js)?/i.exec(raw)
  const code = (fromUrl?.[1] ?? raw).toLowerCase()
  return KIT_CODE.test(code) ? code : ''
}

/** A Pro stylesheet address: https, on a Font Awesome host, with no credentials. Anything else is refused. */
export function cleanProUrl(value: unknown): string {
  if (typeof value !== 'string') return ''
  try {
    const url = new URL(value.trim())
    if (url.protocol !== 'https:' || url.username || url.password || !PRO_HOSTS.has(url.hostname)) return ''
    return url.toString()
  } catch {
    return ''
  }
}

export function normaliseFontAwesome(input: unknown): FontAwesomeConfig {
  const r = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>
  const kitCode = cleanKitCode(r.kitCode)
  const cdnUrl = cleanProUrl(r.cdnUrl)
  // A mode only counts when its value is valid, so a half filled form never writes a broken tag.
  if (r.mode === 'kit' && kitCode) return { mode: 'kit', kitCode, cdnUrl: '' }
  if (r.mode === 'cdn' && cdnUrl) return { mode: 'cdn', kitCode: '', cdnUrl }
  return EMPTY_FONT_AWESOME
}

/** A message for the first problem in a posted value, or null (run on the raw input). */
export function validateFontAwesome(input: unknown): string | null {
  if (input === undefined || input === null) return null
  const r = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>
  if (r.mode === 'kit' && !cleanKitCode(r.kitCode)) return 'The Font Awesome kit code is 10 letters and numbers, for example 1a2b3c4d5e (or paste the kit address).'
  if (r.mode === 'cdn' && !cleanProUrl(r.cdnUrl)) return 'The Pro stylesheet address must start with https:// and be on a Font Awesome address (use.fontawesome.com, kit-pro.fontawesome.com or pro.fontawesome.com).'
  return null
}

/** The one tag the public site writes, or null when Pro is off. A kit is a script; a CDN address is a stylesheet. */
export function fontAwesomeTag(config: FontAwesomeConfig): { kind: 'css' | 'js'; url: string } | null {
  if (config.mode === 'kit' && config.kitCode) return { kind: 'js', url: `https://kit.fontawesome.com/${config.kitCode}.js` }
  if (config.mode === 'cdn' && config.cdnUrl) return { kind: 'css', url: config.cdnUrl }
  return null
}

/** True when the picker may offer the Pro styles. */
export const proStylesAvailable = (config: FontAwesomeConfig): boolean => fontAwesomeTag(config) !== null

/** The class names of the chosen icon. Pro styles fall back to solid when Pro is off, so a removed licence never leaves a blank. */
export function iconClass(stored: string, config: FontAwesomeConfig): string {
  const pro = proStylesAvailable(config)
  const parts = stored.trim().split(/\s+/).filter(Boolean)
  const style = parts.find((p) => (FA_PRO_STYLES as readonly string[]).includes(p))
  const name = parts.find((p) => p.startsWith('fa-') && !(FA_PRO_STYLES as readonly string[]).includes(p))
  if (!name) return 'fa-solid fa-star'
  if (!style) return `fa-solid ${name}`
  return pro || style === 'fa-solid' ? `${style} ${name}` : `fa-solid ${name}`
}

/** Hosts the tag needs in the Content-Security-Policy. A kit script also pulls its own stylesheet and fonts from Font Awesome. */
export function fontAwesomeCsp(config: FontAwesomeConfig): { script: string[]; style: string[]; font: string[] } {
  const tag = fontAwesomeTag(config)
  if (!tag) return { script: [], style: [], font: [] }
  const origin = new URL(tag.url).origin
  if (tag.kind === 'css') return { script: [], style: [origin], font: [origin, 'https://site-assets.fontawesome.com'] }
  return { script: [origin], style: ['https://ka-p.fontawesome.com', origin], font: ['https://ka-p.fontawesome.com', origin] }
}
