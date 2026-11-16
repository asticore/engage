import { b64urlEncode, sha256, toHex } from '@/features/socialLogin/util'

import type { TokenD1 } from './tables'
import { ONE_TIME_TOKENS_TABLE } from './tables'

/**
 * One-time tokens for links and handoffs. Only the SHA-256 of a token is stored.
 * A token works once, for the purpose it was made for, until it expires.
 */

export const ONE_TIME_PREFIX = 'egot_'
export const DEFAULT_ONE_TIME_SECONDS = 300
export const MAX_ONE_TIME_SECONDS = 3600
export const MAX_PAYLOAD_BYTES = 1024
/** Purposes made through the API always start with this, so they can never collide with a purpose the site itself uses. */
export const API_PURPOSE_PREFIX = 'app:'

export type OneTimeStore = {
  insert(row: { tokenHash: string; purpose: string; userId: number | null; payload: string | null; createdAt: string; expiresAt: string }): Promise<void>
  /** Marks a live, unused token used. True only for the one caller that got it. */
  claim(tokenHash: string, purpose: string, at: string): Promise<boolean>
  read(tokenHash: string): Promise<{ purpose: string; userId: number | null; payload: string | null; createdAt: string } | null>
  /** Deletes tokens that expired or were used before `before`. */
  purge(before: string): Promise<void>
}

export const hashOneTimeToken = async (token: string): Promise<string> => toHex(await sha256(token))

const PURPOSE_SHAPE = /^[a-z0-9][a-z0-9:_-]{0,39}$/

export const normalisePurpose = (value: unknown): string | null => {
  if (typeof value !== 'string') return null
  const purpose = value.trim().toLowerCase()
  return PURPOSE_SHAPE.test(purpose) ? purpose : null
}

export type IssueInput = { purpose: string; userId: number | null; payload?: unknown; seconds?: unknown; now: number }

export async function issueOneTimeToken(store: OneTimeStore, input: IssueInput): Promise<{ ok: true; token: string; expiresAt: string } | { ok: false; error: string }> {
  const purpose = normalisePurpose(input.purpose)
  if (!purpose) return { ok: false, error: 'The purpose must be 1 to 40 characters: letters, numbers, colon, dash or underscore.' }
  const asked = input.seconds === undefined || input.seconds === null || input.seconds === '' ? DEFAULT_ONE_TIME_SECONDS : Number(input.seconds)
  if (!Number.isInteger(asked) || asked < 1 || asked > MAX_ONE_TIME_SECONDS) return { ok: false, error: `Choose a lifetime between 1 and ${MAX_ONE_TIME_SECONDS} seconds.` }
  let payload: string | null = null
  if (input.payload !== undefined && input.payload !== null) {
    payload = JSON.stringify(input.payload)
    if (payload === undefined || new TextEncoder().encode(payload).length > MAX_PAYLOAD_BYTES) return { ok: false, error: `The payload must be JSON of at most ${MAX_PAYLOAD_BYTES} bytes.` }
  }
  const token = ONE_TIME_PREFIX + b64urlEncode(crypto.getRandomValues(new Uint8Array(32)))
  const createdAt = new Date(input.now).toISOString()
  const expiresAt = new Date(input.now + asked * 1000).toISOString()
  await store.insert({ tokenHash: await hashOneTimeToken(token), purpose, userId: input.userId, payload, createdAt, expiresAt })
  // Housekeeping on the write path: tokens dead for a day are removed.
  await store.purge(new Date(input.now - 86_400_000).toISOString()).catch((): void => undefined)
  return { ok: true, token, expiresAt }
}

export type Consumed = { purpose: string; userId: number | null; payload: unknown; issuedAt: string }

/** Uses a token up. Null for unknown, wrong purpose, expired or already used - the caller cannot tell which. */
export async function consumeOneTimeToken(store: OneTimeStore, token: unknown, purpose: string, now: number): Promise<Consumed | null> {
  if (typeof token !== 'string' || !token.startsWith(ONE_TIME_PREFIX) || token.length > 100) return null
  const wanted = normalisePurpose(purpose)
  if (!wanted) return null
  const hash = await hashOneTimeToken(token)
  if (!(await store.claim(hash, wanted, new Date(now).toISOString()))) return null
  const row = await store.read(hash)
  if (!row) return null
  let payload: unknown = null
  if (row.payload) {
    try {
      payload = JSON.parse(row.payload)
    } catch {
      payload = null
    }
  }
  return { purpose: row.purpose, userId: row.userId, payload, issuedAt: row.createdAt }
}

export const createD1OneTimeStore = (getDb: () => Promise<TokenD1>): OneTimeStore => ({
  async insert(row) {
    const db = await getDb()
    await db
      .prepare(`INSERT INTO ${ONE_TIME_TOKENS_TABLE} (token_hash, purpose, user_id, payload, created_at, expires_at, used_at) VALUES (?, ?, ?, ?, ?, ?, NULL)`)
      .bind(row.tokenHash, row.purpose, row.userId, row.payload, row.createdAt, row.expiresAt)
      .run()
  },
  async claim(tokenHash, purpose, at) {
    const db = await getDb()
    const result = (await db
      .prepare(`UPDATE ${ONE_TIME_TOKENS_TABLE} SET used_at = ? WHERE token_hash = ? AND purpose = ? AND used_at IS NULL AND expires_at > ?`)
      .bind(at, tokenHash, purpose, at)
      .run()) as { meta?: { changes?: number } }
    return Number(result.meta?.changes ?? 0) === 1
  },
  async read(tokenHash) {
    const db = await getDb()
    const raw = await db
      .prepare(`SELECT purpose, user_id, payload, created_at FROM ${ONE_TIME_TOKENS_TABLE} WHERE token_hash = ?`)
      .bind(tokenHash)
      .first<{ purpose: string; user_id: number | null; payload: string | null; created_at: string }>()
    return raw ? { purpose: raw.purpose, userId: raw.user_id === null ? null : Number(raw.user_id), payload: raw.payload, createdAt: raw.created_at } : null
  },
  async purge(before) {
    const db = await getDb()
    await db.prepare(`DELETE FROM ${ONE_TIME_TOKENS_TABLE} WHERE expires_at < ? OR (used_at IS NOT NULL AND used_at < ?)`).bind(before, before).run()
  },
})
