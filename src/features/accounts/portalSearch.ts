/**
 * Pure helpers for the account search box. No DOM and no network: account
 * screens and settings fields are matched here, the signed-in customer's own
 * orders, bookings and subscriptions come from /api/account-search (matched
 * on the server with the same helpers), and site results come from
 * /api/search-suggest.
 */
import type { PortalStringKey } from '@/features/uiStrings/portalAdapter'

export type ScreenLink = { href: string; label: string; keywords?: string[] }

export const PORTAL_SEARCH_MIN_CHARS = 2
export const PORTAL_SEARCH_MAX_QUERY = 80
export const PORTAL_SEARCH_MAX_RESULTS = 10

/** Trims, collapses spaces and caps the length. Keeps the query the user typed otherwise. */
export function normaliseQuery(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim().slice(0, PORTAL_SEARCH_MAX_QUERY).trim()
}

/**
 * Synonym groups. A query that touches one word of a group also searches the
 * other words in it, so "purchase" finds Orders and "2fa" finds the two-step
 * setting. English only: a label in another language still matches on its own text.
 * Words are kept at three letters or more so a short query cannot expand by accident.
 */
export const SYNONYM_GROUPS: readonly (readonly string[])[] = [
  ['order', 'orders', 'purchase', 'purchases', 'receipt', 'receipts', 'invoice', 'invoices', 'bought', 'parcel'],
  ['booking', 'bookings', 'reservation', 'reservations', 'appointment', 'appointments', 'rsvp', 'ticket', 'tickets'],
  ['subscription', 'subscriptions', 'recurring', 'membership', 'renewal', 'renew', 'plan', 'plans', 'billing'],
  ['address', 'addresses', 'delivery', 'shipping', 'postcode', 'postal', 'location'],
  ['password', 'passwords', 'passphrase', 'login', 'log in', 'sign in'],
  ['email', 'e-mail', 'mail', 'inbox'],
  ['language', 'languages', 'locale', 'translation', 'translate'],
  ['passkey', 'passkeys', 'fingerprint', 'biometric', 'face id', 'touch id', 'security key'],
  ['two-step', 'two step', 'two-factor', 'two factor', '2fa', 'mfa', 'verification', 'one-time code'],
  ['session', 'sessions', 'devices', 'sign out', 'logout', 'log out'],
  ['api', 'api key', 'api keys', 'token', 'developer'],
  ['credit', 'store credit', 'balance', 'wallet', 'refund', 'gift card'],
  ['name', 'display name', 'username', 'first name', 'last name'],
  ['connected', 'linked', 'social', 'google'],
  ['account', 'profile', 'details', 'personal'],
]

/** The query plus every synonym it reaches, lower case. */
export function searchTerms(raw: string): string[] {
  const query = normaliseQuery(raw).toLowerCase()
  const terms = new Set<string>([query])
  if (query.length < PORTAL_SEARCH_MIN_CHARS) return [...terms]
  for (const group of SYNONYM_GROUPS) {
    if (group.some((word) => word.includes(query) || query.includes(word))) group.forEach((word) => terms.add(word))
  }
  return [...terms]
}

/** True when any of the texts contains any of the terms (case-insensitive). */
export function matchesTerms(texts: Array<string | null | undefined>, terms: string[]): boolean {
  return texts.some((text) => {
    const lower = (text ?? '').toLowerCase()
    return lower !== '' && terms.some((term) => lower.includes(term))
  })
}

/**
 * Entries (account screens or settings fields) whose label or keywords match the
 * query, or a synonym of it. Empty below the minimum length; keeps the list order.
 * With two or more words, every word of three letters or more must also match the
 * entry's own text, so "default address" does not match "Email address".
 */
export function matchEntries(entries: ScreenLink[], raw: string): ScreenLink[] {
  const query = normaliseQuery(raw).toLowerCase()
  if (query.length < PORTAL_SEARCH_MIN_CHARS) return []
  const terms = searchTerms(query)
  const words = query.includes(' ') ? query.split(' ').filter((word) => word.length >= 3) : []
  return entries.filter((entry) => {
    const texts = [entry.label, ...(entry.keywords ?? [])]
    return matchesTerms(texts, terms) && words.every((word) => matchesTerms(texts, [word]))
  })
}

/** Account screens whose label or keywords match the query. */
export const matchScreens = matchEntries

/** Extra words for account screens whose label alone is not how people search for them. */
export const SCREEN_KEYWORDS: Record<string, string[]> = {
  '/account': ['home', 'dashboard', 'summary'],
  '/account/store-credit': ['gift card', 'refund'],
  '/account/profile': ['details', 'personal info'],
}

/** A settings field on the profile or addresses screens. The label is a portal string key; the href is the field's own anchor. */
export type SettingsField = { href: string; key: PortalStringKey; keywords: string[] }

export const SETTINGS_FIELDS: readonly SettingsField[] = [
  { href: '/account/profile#name', key: 'profile.name', keywords: ['display name', 'username', 'first name', 'last name'] },
  { href: '/account/profile#language', key: 'profile.language', keywords: ['portal language', 'locale'] },
  { href: '/account/profile#email', key: 'profile.emailHeading', keywords: ['e-mail', 'email address'] },
  { href: '/account/profile#password', key: 'auth.password', keywords: ['change password', 'passphrase'] },
  { href: '/account/profile#security', key: 'profile.twoStepHeading', keywords: ['two-step', 'two-factor', '2fa', 'mfa', 'verification code'] },
  { href: '/account/profile#security', key: 'profile.passkeysHeading', keywords: ['passkey', 'fingerprint', 'face id', 'touch id', 'biometric', 'security key'] },
  { href: '/account/profile#security', key: 'profile.apiKeysHeading', keywords: ['api key', 'token', 'developer'] },
  { href: '/account/profile#connected', key: 'profile.connectedHeading', keywords: ['google', 'linked accounts', 'social sign-in'] },
  { href: '/account/profile#sessions', key: 'profile.sessionsHeading', keywords: ['devices', 'signed in', 'sign out'] },
  { href: '/account/addresses', key: 'search.defaultAddress', keywords: ['default address', 'shipping address', 'delivery address'] },
]

/**
 * The order number a query names: "12", "#12", "order 12", "no. 12". Anything else
 * (words, several numbers) names no order. Only the number is matched, never the customer.
 */
export function orderNumberIn(raw: string): number | null {
  const match = normaliseQuery(raw).toLowerCase().match(/^(?:[a-z.]+\s+)?#?(\d{1,9})$/)
  if (!match) return null
  const number = Number(match[1])
  return number > 0 ? number : null
}

/** One result row from the account search: a link inside the account area. */
export type AccountItem = { id: number; label: string; href: string }

export type AccountSearchResults = { orders: AccountItem[]; bookings: AccountItem[]; subscriptions: AccountItem[] }

export const EMPTY_ACCOUNT_RESULTS: AccountSearchResults = { orders: [], bookings: [], subscriptions: [] }

/**
 * Reads the JSON from /api/account-search. Anything malformed becomes an empty
 * list, and a link must be a path inside /account (never another site).
 */
export function parseAccountSearch(json: unknown): AccountSearchResults {
  const body = (json && typeof json === 'object' ? json : {}) as Record<string, unknown>
  const pick = (value: unknown): AccountItem[] => {
    if (!Array.isArray(value)) return []
    const items: AccountItem[] = []
    for (const item of value) {
      const row = (item ?? {}) as Record<string, unknown>
      const href = typeof row.href === 'string' ? row.href : ''
      const valid =
        typeof row.id === 'number' &&
        typeof row.label === 'string' &&
        row.label.trim() !== '' &&
        href.startsWith('/account') &&
        !href.startsWith('//')
      if (valid) items.push({ id: row.id as number, label: row.label as string, href })
      if (items.length >= PORTAL_SEARCH_MAX_RESULTS) break
    }
    return items
  }
  return { orders: pick(body.orders), bookings: pick(body.bookings), subscriptions: pick(body.subscriptions) }
}
