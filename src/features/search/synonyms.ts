/**
 * Search synonyms, shared by the account search box and the site's live search.
 * A query that touches one word of a group also searches the other words in it,
 * so "purchase" finds Orders and "2fa" finds the two-step setting. English only:
 * a label or page in another language still matches on its own text.
 * Words are kept at three letters or more so a short query cannot expand by accident.
 * Pure: no DOM, no network, no database.
 */

export const SYNONYM_MIN_CHARS = 2

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

/** The query plus every synonym it reaches, lower case. The query itself comes first. */
export function searchTerms(raw: string): string[] {
  const query = raw.replace(/\s+/g, ' ').trim().toLowerCase()
  const terms = new Set<string>([query])
  if (query.length < SYNONYM_MIN_CHARS) return [...terms]
  for (const group of SYNONYM_GROUPS) {
    if (group.some((word) => word.includes(query) || query.includes(word))) group.forEach((word) => terms.add(word))
  }
  return [...terms]
}
