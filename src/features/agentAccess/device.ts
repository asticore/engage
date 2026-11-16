/**
 * Task 25c: device authorisation (RFC 8628) for agent tokens. A command-line tool or AI agent asks for a code,
 * shows the person a short code and an address, the person approves it in the admin while signed in, and the
 * tool collects a normal agent token by polling. Pure rules; storage is in deviceStore.ts.
 */

export const DEVICE_TTL_MS = 10 * 60 * 1000
export const POLL_INTERVAL_S = 5
export const MAX_PENDING = 50
export const GRANT_TYPE = 'urn:ietf:params:oauth:grant-type:device_code'
/** No vowels, no look-alikes: easy to read aloud and type. */
const ALPHABET = 'BCDFGHJKLMNPQRSTVWXZ'

const b64url = (bytes: Uint8Array): string => {
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export const newDeviceCode = (): string => `dc_${b64url(crypto.getRandomValues(new Uint8Array(32)))}`

export function newUserCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(8))
  const chars = Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join('')
  return `${chars.slice(0, 4)}-${chars.slice(4)}`
}

/** `bcdf ghjk`, `BCDF-GHJK` and `bcdfghjk` all mean the same code; anything else is null. */
export function normaliseUserCode(input: unknown): string | null {
  if (typeof input !== 'string') return null
  const raw = input.toUpperCase().replace(/[^A-Z]/g, '')
  if (raw.length !== 8 || [...raw].some((c) => !ALPHABET.includes(c))) return null
  return `${raw.slice(0, 4)}-${raw.slice(4)}`
}

export const deviceCodeShape = (v: unknown): v is string => typeof v === 'string' && /^dc_[A-Za-z0-9_-]{43}$/.test(v)

export async function hashDeviceCode(code: string): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(code)))
  return Array.from(digest, (b) => b.toString(16).padStart(2, '0')).join('')
}

export type DeviceStatus = 'pending' | 'approved' | 'denied' | 'used'
export type DeviceRow = {
  id: number
  userCode: string
  clientName: string
  scope: 'read' | 'write'
  status: DeviceStatus
  /** The encrypted token, present only between approval and the first successful poll. */
  tokenEnc: string | null
  expiresAt: number
  lastPollAt: number
  interval: number
}

export type PollResult = { kind: 'token' } | { kind: 'error'; error: 'authorization_pending' | 'slow_down' | 'access_denied' | 'expired_token' | 'invalid_grant'; interval?: number }

/** What a poll for this row should answer. Polling faster than the interval earns slow_down and a longer interval. */
export function pollDecision(row: DeviceRow, now: number): PollResult {
  if (now > row.expiresAt) return { kind: 'error', error: 'expired_token' }
  if (row.status === 'used') return { kind: 'error', error: 'invalid_grant' }
  if (row.status === 'denied') return { kind: 'error', error: 'access_denied' }
  if (now - row.lastPollAt < row.interval * 1000 - 250) return { kind: 'error', error: 'slow_down', interval: row.interval + 5 }
  if (row.status === 'approved' && row.tokenEnc) return { kind: 'token' }
  return { kind: 'error', error: 'authorization_pending' }
}

export const cleanClientName = (v: unknown): string => (typeof v === 'string' ? v.trim().replace(/[\u0000-\u001f<>]/g, '').slice(0, 60) : '') || 'An AI tool'
export const cleanScope = (v: unknown): 'read' | 'write' => (v === 'write' ? 'write' : 'read')
