import { resolveD1Binding } from '@/cms/db/connect'

import { TOKEN_PREFIX } from './core'
import type { ScimLink } from './handler'

/**
 * The two small tables behind SCIM, created the first time they are used (like the social providers table), so no
 * migration runs and a site that never uses SCIM carries nothing extra. Only the SHA-256 of a token is stored.
 */

type Statement = { first<T>(): Promise<T | null>; all<T>(): Promise<{ results?: T[] }>; run(): Promise<unknown> }
export type ScimD1 = { prepare(sql: string): { bind(...values: unknown[]): Statement } }

const CREATE = [
  'CREATE TABLE IF NOT EXISTS eg_org_scim (org_id TEXT PRIMARY KEY NOT NULL, token_hash TEXT NOT NULL, prefix TEXT NOT NULL, enabled INTEGER NOT NULL DEFAULT 1, created_at TEXT, last_used_at TEXT)',
  'CREATE UNIQUE INDEX IF NOT EXISTS eg_org_scim_hash_idx ON eg_org_scim (token_hash)',
  'CREATE TABLE IF NOT EXISTS eg_org_scim_users (org_id TEXT NOT NULL, user_id INTEGER NOT NULL, external_id TEXT, active INTEGER NOT NULL DEFAULT 1, updated_at TEXT, PRIMARY KEY (org_id, user_id))',
]

let ensured: Promise<void> | null = null

async function defaultDb(): Promise<ScimD1> {
  const d1 = (await resolveD1Binding()) as unknown as ScimD1
  if (!ensured) {
    ensured = (async () => {
      for (const statement of CREATE) await d1.prepare(statement).bind().run()
    })().catch((error: unknown): never => {
      ensured = null
      throw error
    })
  }
  await ensured
  return d1
}

export const generateToken = (): string => {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return TOKEN_PREFIX + btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export async function hashToken(token: string): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token)))
  return Array.from(digest, (b) => b.toString(16).padStart(2, '0')).join('')
}

export type TokenInfo = { orgId: string; prefix: string; enabled: boolean; createdAt: string; lastUsedAt: string | null }

type RawToken = { org_id: string; prefix: string; enabled: number; created_at: string; last_used_at: string | null }
const toInfo = (r: RawToken): TokenInfo => ({ orgId: r.org_id, prefix: r.prefix, enabled: Number(r.enabled) === 1, createdAt: r.created_at, lastUsedAt: r.last_used_at })

/** The organisation a bearer token belongs to, or null. Disabled tokens find nothing. */
export async function orgForToken(token: string, d1?: ScimD1): Promise<string | null> {
  const db = d1 ?? (await defaultDb())
  const r = await db.prepare('SELECT org_id FROM eg_org_scim WHERE token_hash = ?1 AND enabled = 1').bind(await hashToken(token)).first<{ org_id: string }>()
  return r ? r.org_id : null
}

export async function touchToken(orgId: string, nowIso: string, d1?: ScimD1): Promise<void> {
  const db = d1 ?? (await defaultDb())
  await db.prepare('UPDATE eg_org_scim SET last_used_at = ?2 WHERE org_id = ?1').bind(orgId, nowIso).run()
}

/** Replaces the organisation's token with a fresh one. Returns the plain token once. */
export async function rotateToken(orgId: string, nowIso: string, d1?: ScimD1): Promise<string> {
  const db = d1 ?? (await defaultDb())
  const token = generateToken()
  await db
    .prepare('INSERT INTO eg_org_scim (org_id, token_hash, prefix, enabled, created_at, last_used_at) VALUES (?1,?2,?3,1,?4,NULL) ON CONFLICT(org_id) DO UPDATE SET token_hash = ?2, prefix = ?3, enabled = 1, created_at = ?4, last_used_at = NULL')
    .bind(orgId, await hashToken(token), token.slice(0, 10), nowIso)
    .run()
  return token
}

export async function disableToken(orgId: string, d1?: ScimD1): Promise<void> {
  const db = d1 ?? (await defaultDb())
  await db.prepare('UPDATE eg_org_scim SET enabled = 0 WHERE org_id = ?1').bind(orgId).run()
}

export async function listTokens(d1?: ScimD1): Promise<TokenInfo[]> {
  try {
    const db = d1 ?? (await defaultDb())
    return ((await db.prepare('SELECT org_id, prefix, enabled, created_at, last_used_at FROM eg_org_scim').bind().all<RawToken>()).results ?? []).map(toInfo)
  } catch {
    return []
  }
}

export function createLinkStore(d1?: ScimD1): {
  get(orgId: string, userId: number): Promise<ScimLink | null>
  upsert(orgId: string, userId: number, externalId: string | null, active: boolean, at: string): Promise<void>
} {
  return {
    async get(orgId, userId) {
      const db = d1 ?? (await defaultDb())
      const r = await db.prepare('SELECT user_id, external_id, active FROM eg_org_scim_users WHERE org_id = ?1 AND user_id = ?2').bind(orgId, userId).first<{ user_id: number; external_id: string | null; active: number }>()
      return r ? { userId: Number(r.user_id), externalId: r.external_id, active: Number(r.active) === 1 } : null
    },
    async upsert(orgId, userId, externalId, active, at) {
      const db = d1 ?? (await defaultDb())
      await db
        .prepare('INSERT INTO eg_org_scim_users (org_id, user_id, external_id, active, updated_at) VALUES (?1,?2,?3,?4,?5) ON CONFLICT(org_id, user_id) DO UPDATE SET external_id = ?3, active = ?4, updated_at = ?5')
        .bind(orgId, userId, externalId, active ? 1 : 0, at)
        .run()
    },
  }
}

/** Privacy erase. Tables may not exist yet. */
export async function eraseScimForUser(userId: number, d1: ScimD1): Promise<void> {
  await d1.prepare('DELETE FROM eg_org_scim_users WHERE user_id = ?1').bind(userId).run()
}
