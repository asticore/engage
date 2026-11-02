/**
 * Log redaction. A delivery body is kept in the log for replay and for the admin to read. Once a
 * delivery has finished, values under secret-looking keys (and values that look like credentials)
 * are replaced before the row is written back, so the log never keeps a password, token or key that
 * a payload happened to carry. Pending rows keep the exact body until they are sent, because a retry
 * has to send what the receiver expects. A redacted row cannot be replayed (see delivery.ts).
 *
 * Pure: no database, no request. Bodies are always JSON (renderBody builds them), so a body that does
 * not parse is redacted as a whole rather than kept.
 */

export const REDACTED = '[redacted]'

/** Keys are compared after lower-casing and removing every non-letter and non-digit, so Api-Key, api_key and apiKey match alike. */
const SECRET_KEY_FRAGMENTS = [
  'password',
  'passwd',
  'passphrase',
  'secret',
  'token',
  'apikey',
  'authorization',
  'cookie',
  'session',
  'privatekey',
  'credential',
  'cardnumber',
] as const

/** Short keys only count as a whole key: "ssn" must not match "classname", "pin" must not match "shipping". */
const SECRET_KEYS_EXACT = new Set(['pin', 'cvv', 'ssn', 'otp'])

/** Values that look like a credential whatever their key: bearer and basic headers, JWTs and well-known key prefixes. */
const SECRET_VALUE_PATTERNS: RegExp[] = [
  /^(bearer|basic)\s+\S+$/i,
  /^eyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}$/,
  /^(whsec_|sk_live_|sk_test_|rk_live_|pk_live_|ghp_|github_pat_|xox[abprs]-|AKIA[0-9A-Z]{16})/,
]

const MAX_DEPTH = 32

export const isSecretKey = (key: string): boolean => {
  const folded = key.toLowerCase().replace(/[^a-z0-9]/g, '')
  if (SECRET_KEYS_EXACT.has(folded)) return true
  return SECRET_KEY_FRAGMENTS.some((fragment) => folded.includes(fragment))
}

export const isSecretValue = (value: string): boolean =>
  SECRET_VALUE_PATTERNS.some((pattern) => pattern.test(value.trim()))

function walk(value: unknown, depth: number, state: { changed: boolean }): unknown {
  if (depth > MAX_DEPTH) {
    state.changed = true
    return REDACTED
  }
  if (Array.isArray(value)) return value.map((item) => walk(item, depth + 1, state))
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [key, item] of Object.entries(value)) {
      if (isSecretKey(key) && item !== null && item !== undefined && item !== '') {
        state.changed = true
        out[key] = REDACTED
      } else {
        out[key] = walk(item, depth + 1, state)
      }
    }
    return out
  }
  if (typeof value === 'string' && isSecretValue(value)) {
    state.changed = true
    return REDACTED
  }
  return value
}

/**
 * Returns the body with secret-looking content replaced, and whether anything changed. Key order is
 * kept. A body that is not JSON comes back as the redacted marker, so a failure leaks nothing.
 */
export function redactBody(body: string): { body: string; redacted: boolean } {
  if (body === '') return { body, redacted: false }
  let parsed: unknown
  try {
    parsed = JSON.parse(body)
  } catch {
    return { body: JSON.stringify(REDACTED), redacted: true }
  }
  const state = { changed: false }
  const cleaned = walk(parsed, 0, state)
  if (!state.changed) return { body, redacted: false }
  return { body: JSON.stringify(cleaned), redacted: true }
}
