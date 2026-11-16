/** Digital asset manager: expiring share links. Pure helpers: tokens, state and the form that creates a link. */

export type ShareKind = 'file' | 'collection'

export type Share = {
  id: number
  kind: ShareKind
  targetId: number
  expiresAt: string | null
  hasPassword: boolean
  maxDownloads: number
  downloads: number
  revoked: boolean
  createdAt: string
}

/** A random link token (43 characters of URL-safe text). Only its hash is stored, so a leaked database does not leak links. */
export function newToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  let text = ''
  for (const b of bytes) text += String.fromCharCode(b)
  return btoa(text).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export async function hashToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
}

export const isToken = (value: unknown): value is string => typeof value === 'string' && /^[A-Za-z0-9_-]{43}$/.test(value)

export type ShareState = 'ok' | 'expired' | 'revoked' | 'used_up'

/** Whether a link still works. Expiry is a moment in time (ISO date and time). */
export function shareState(share: Pick<Share, 'expiresAt' | 'revoked' | 'maxDownloads' | 'downloads'>, now: Date): ShareState {
  if (share.revoked) return 'revoked'
  if (share.expiresAt && Date.parse(share.expiresAt) <= now.getTime()) return 'expired'
  if (share.maxDownloads > 0 && share.downloads >= share.maxDownloads) return 'used_up'
  return 'ok'
}

export const SHARE_MESSAGES: Record<Exclude<ShareState, 'ok'>, string> = {
  expired: 'This link has expired.',
  revoked: 'This link is no longer available.',
  used_up: 'This link has reached its download limit.',
}

export type ShareInput = { kind: ShareKind; targetId: number; expiresAt: string | null; password: string; maxDownloads: number }

/** Validates the create-link form. `days` is how long the link lasts (0 means it does not expire, which is refused unless allowed). */
export function parseShareInput(input: Record<string, unknown>, now: Date): { ok: true; value: ShareInput } | { ok: false; error: string } {
  const kind = input.kind === 'collection' ? 'collection' : input.kind === 'file' ? 'file' : null
  const targetId = Number(input.targetId)
  if (!kind || !Number.isInteger(targetId) || targetId <= 0) return { ok: false, error: 'Choose what to share.' }
  const days = Number(input.days)
  if (!Number.isInteger(days) || days < 1 || days > 365) return { ok: false, error: 'Choose how many days the link works for (1 to 365).' }
  const maxDownloads = input.maxDownloads === undefined || input.maxDownloads === '' ? 0 : Number(input.maxDownloads)
  if (!Number.isInteger(maxDownloads) || maxDownloads < 0 || maxDownloads > 100_000) return { ok: false, error: 'The download limit must be a whole number (0 for no limit).' }
  const password = typeof input.password === 'string' ? input.password : ''
  if (password && (password.length < 6 || password.length > 200)) return { ok: false, error: 'A link password needs 6 to 200 characters.' }
  return { ok: true, value: { kind, targetId, expiresAt: new Date(now.getTime() + days * 86_400_000).toISOString(), password, maxDownloads } }
}
