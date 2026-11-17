/**
 * The places that can ask for the CAPTCHA, and the mode each one runs in (Task 19a and 21a).
 *
 * Modes:
 *  - default:  what the site did before modes existed (sign-in places follow "Also require the challenge on sign-in",
 *              comments and chat follow the challenge switch, every other place is off).
 *  - off:      never asks (a low Cloudflare bot score can still ask, see Bot detection).
 *  - always:   asks every time.
 *  - failures: asks only after the visitor's address has failed or tried more than N times in a window. Places with a
 *              failed step (sign-in, codes) count failures; places without one (comments, reviews, ...) count tries.
 */

export type PlaceMode = 'default' | 'off' | 'always' | 'failures'
export type PlaceKind = 'auth' | 'public'

export const CAPTCHA_PLACES = [
  { id: 'signIn', label: 'Member sign-in', kind: 'auth', legacy: 'protectSignIn', counts: 'failures' },
  { id: 'adminSignIn', label: 'Admin sign-in', kind: 'auth', legacy: 'off', counts: 'failures' },
  { id: 'register', label: 'Create account', kind: 'auth', legacy: 'protectSignIn', counts: 'tries' },
  { id: 'reset', label: 'Forgot password (request)', kind: 'auth', legacy: 'protectSignIn', counts: 'tries' },
  { id: 'resetConfirm', label: 'Forgot password (choose a new one)', kind: 'auth', legacy: 'off', counts: 'failures' },
  { id: 'passwordlessRequest', label: 'Magic link and email code request', kind: 'auth', legacy: 'off', counts: 'tries' },
  { id: 'passwordlessVerify', label: 'Email code entry', kind: 'auth', legacy: 'off', counts: 'failures' },
  { id: 'comments', label: 'Comments', kind: 'public', legacy: 'challenge', counts: 'tries' },
  { id: 'chatbot', label: 'Chat and live chat', kind: 'public', legacy: 'challenge', counts: 'tries' },
  { id: 'reviews', label: 'Product reviews', kind: 'public', legacy: 'off', counts: 'tries' },
  { id: 'backInStock', label: 'Back-in-stock sign-up', kind: 'public', legacy: 'off', counts: 'tries' },
  { id: 'rsvp', label: 'Event RSVP', kind: 'public', legacy: 'off', counts: 'tries' },
  { id: 'cardCheckout', label: 'Checkout: card and PayPal payment', kind: 'public', legacy: 'off', counts: 'tries' },
  { id: 'offlineOrder', label: 'Checkout: bank transfer, cheque and cash orders', kind: 'public', legacy: 'off', counts: 'tries' },
] as const

export type PlaceId = (typeof CAPTCHA_PLACES)[number]['id']

export const PLACE_IDS: readonly PlaceId[] = CAPTCHA_PLACES.map((p) => p.id)

export const isPlaceId = (value: unknown): value is PlaceId => typeof value === 'string' && (PLACE_IDS as readonly string[]).includes(value)

export const normalisePlaceMode = (value: unknown): PlaceMode =>
  value === 'off' || value === 'always' || value === 'failures' ? value : 'default'

export const DEFAULT_FAILURE_THRESHOLD = 3
export const DEFAULT_FAILURE_WINDOW_MINUTES = 15

/** The settings field a place's mode is saved in: `modeSignIn`, `modeBackInStock`, ... */
export const modeFieldOf = (id: PlaceId): string => `mode${id[0].toUpperCase()}${id.slice(1)}`

/** The three switches the old settings had, which the "default" mode still follows. */
export type LegacySwitches = { turnstile: boolean; protectSignIn: boolean }

/** The mode a place really runs in once "default" is resolved. */
export function effectiveMode(id: PlaceId, mode: PlaceMode, legacy: LegacySwitches): 'off' | 'always' | 'failures' {
  if (mode !== 'default') return mode
  const place = CAPTCHA_PLACES.find((p) => p.id === id)
  if (!place) return 'off'
  if (place.legacy === 'protectSignIn') return legacy.protectSignIn ? 'always' : 'off'
  if (place.legacy === 'challenge') return legacy.turnstile ? 'always' : 'off'
  return 'off'
}

/** True when the failure count asks for the challenge. */
export const failuresReached = (count: number, threshold: number): boolean => count >= Math.max(1, threshold)

export const defaultPlaceModes = (): Record<PlaceId, PlaceMode> =>
  Object.fromEntries(PLACE_IDS.map((id) => [id, 'default'])) as Record<PlaceId, PlaceMode>

/** Reads every place's saved mode from the `spam` group of Form settings. */
export function readPlaceModes(spam: Record<string, unknown> | null | undefined): Record<PlaceId, PlaceMode> {
  const modes = defaultPlaceModes()
  for (const id of PLACE_IDS) modes[id] = normalisePlaceMode(spam?.[modeFieldOf(id)])
  return modes
}
