/**
 * Affiliate tracking, pure parts (Task 31a). A visitor who arrives with `?ref=CODE` for an active
 * affiliate gets a first-party cookie for 30 days (last click wins unless the first-click rule is
 * used); each landing is logged. No commissions yet (31b). Nothing here touches a database.
 */

export const REF_COOKIE = 'eg_ref'
export const DEFAULT_COOKIE_DAYS = 30
export const MAX_AFFILIATES = 500

export type AffiliateStatus = 'pending' | 'active' | 'suspended'
export const STATUSES: readonly AffiliateStatus[] = ['pending', 'active', 'suspended']

/** A code is 3 to 32 lowercase letters, digits and dashes. Returns null when it is not. */
export function normaliseCode(value: unknown): string | null {
  const code = typeof value === 'string' ? value.trim().toLowerCase() : ''
  return /^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$/.test(code) ? code : null
}

/** A starter code from a name, plus a short random suffix so two people named Sam differ. */
export function suggestCode(name: string, random: () => number = Math.random): string {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 20) || 'partner'
  const suffix = Math.floor(random() * 36 ** 3).toString(36).padStart(3, '0')
  return `${base.length >= 2 ? base : `${base}x`}-${suffix}`
}

/** Which code the visitor carries after a new landing. `first` keeps the earliest, `last` takes the newest. */
export function chooseCode(existing: string | null, incoming: string, rule: 'first' | 'last' = 'last'): string {
  return rule === 'first' && existing ? existing : incoming
}

export const REF_UTM_COOKIE = 'eg_ref_utm'
export type ConsentCategory = 'necessary' | 'preferences' | 'analytics' | 'marketing'
export const CONSENT_CATEGORY_OPTIONS: readonly ConsentCategory[] = ['necessary', 'preferences', 'analytics', 'marketing']
export const toConsentCategory = (v: unknown): ConsentCategory => (CONSENT_CATEGORY_OPTIONS as readonly unknown[]).includes(v) ? (v as ConsentCategory) : 'necessary'

/** The coupon code kept for an affiliate: lowercase, letters, digits, dashes and underscores, 3 to 40 characters, or empty. */
export function normaliseCoupon(value: unknown): string {
  const code = typeof value === 'string' ? value.trim().toLowerCase() : ''
  return /^[a-z0-9][a-z0-9_-]{1,38}[a-z0-9]$/.test(code) ? code : ''
}

export type Utm = { source: string; medium: string; campaign: string }

const clip = (v: string | null): string => (v ?? '').trim().slice(0, 80)
export function parseUtm(params: { get(name: string): string | null }): Utm {
  return { source: clip(params.get('utm_source')), medium: clip(params.get('utm_medium')), campaign: clip(params.get('utm_campaign')) }
}

const BOT = /bot|crawl|spider|slurp|facebookexternalhit|preview|monitor|headless|curl|wget|python-requests|httpclient|scrapy/i
/** True for crawlers and scripts, which are not logged as visits. An empty agent counts as a bot. */
export const looksLikeBot = (userAgent: string | null | undefined): boolean => !userAgent || BOT.test(userAgent)

export function refCookie(code: string, days: number = DEFAULT_COOKIE_DAYS): string {
  return `${REF_COOKIE}=${encodeURIComponent(code)}; Path=/; Max-Age=${Math.round(days * 86400)}; SameSite=Lax`
}

export function readRefCookie(cookieHeader: string | null | undefined): string | null {
  for (const part of (cookieHeader ?? '').split(';')) {
    const [name, ...rest] = part.trim().split('=')
    if (name === REF_COOKIE) return normaliseCode(decodeURIComponent(rest.join('=')))
  }
  return null
}

/** The share link for an affiliate on a site origin. */
export const referralLink = (origin: string, code: string): string => `${origin.replace(/\/+$/, '')}/?ref=${encodeURIComponent(code)}`

/** Only a same-site path is stored as the landing page. */
export const cleanPath = (value: unknown): string => (typeof value === 'string' && value.startsWith('/') && !value.startsWith('//') ? value.slice(0, 200) : '/')

/** A private dashboard token: 48 hex characters from the platform's secure random source. */
export function newToken(): string {
  const bytes = new Uint8Array(24)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

export const isToken = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{48}$/.test(value)

export const DEFAULT_TERMS =
  'Share your link. When someone follows it and buys, you earn a commission on their order. Commission becomes payable after the waiting period, is reduced if the order is refunded, and is paid by the site owner. Buying through your own link does not earn commission. The site owner may suspend an affiliate who breaks these rules.'

export type SetupStep = { key: string; label: string; done: boolean; hint: string }

/** The affiliate set-up checklist, worked out from what exists (Task 31e). Nothing is stored. */
export function setupSteps(f: { configured: boolean; affiliates: number; active: number; visits: number; commissions: number; payouts: number }): SetupStep[] {
  return [
    { key: 'rules', label: 'Choose your rules', done: f.configured, hint: 'Set the commission, days before payable and cookie days below, then press Save settings.' },
    { key: 'first', label: 'Get your first affiliate', done: f.active > 0, hint: 'Add one below, or share the sign-up page and approve people when they apply.' },
    { key: 'visit', label: 'See a first visit', done: f.visits > 0, hint: 'Send an affiliate their link (use Copy share kit). Visits show in the table.' },
    { key: 'sale', label: 'Earn a first commission', done: f.commissions > 0, hint: 'It appears when someone buys after following a link.' },
    { key: 'payout', label: 'Record a first payout', done: f.payouts > 0, hint: 'Pay outside the site, then press Record payout.' },
  ]
}

/** A ready-to-send message for a new affiliate: their link, the sign-up page and the dashboard link. */
export function shareKit(v: { name: string; link: string; dashboard: string; commissionPct: number; cookieDays: number }): string {
  return [
    `Hi ${v.name},`,
    '',
    `Thanks for joining our affiliate program. You earn ${v.commissionPct}% commission on every order from people who follow your link and buy within ${v.cookieDays} days.`,
    '',
    `Your link: ${v.link}`,
    `Your private results page: ${v.dashboard}`,
    '',
    'Add your link to your posts, videos, emails or bio. Please say clearly that it is an affiliate link.',
  ].join('\n')
}

/** The UTM values of the landing, kept in a small cookie beside eg_ref so the order can carry them. */
export function utmCookie(utm: Utm, days: number = DEFAULT_COOKIE_DAYS): string {
  const value = [utm.source, utm.medium, utm.campaign].map((v) => v.replace(/[|;,\s]+/g, '_')).join('|')
  return `${REF_UTM_COOKIE}=${encodeURIComponent(value)}; Path=/; Max-Age=${Math.round(days * 86400)}; SameSite=Lax`
}

export function readUtmCookie(cookieHeader: string | null | undefined): Utm {
  for (const part of (cookieHeader ?? '').split(';')) {
    const [name, ...rest] = part.trim().split('=')
    if (name !== REF_UTM_COOKIE) continue
    let decoded = ''
    try {
      decoded = decodeURIComponent(rest.join('='))
    } catch {
      return { source: '', medium: '', campaign: '' }
    }
    const [source = '', medium = '', campaign = ''] = decoded.split('|')
    return { source: source.slice(0, 80), medium: medium.slice(0, 80), campaign: campaign.slice(0, 80) }
  }
  return { source: '', medium: '', campaign: '' }
}
