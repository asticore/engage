import { decryptSecret, encryptSecret } from '@/utilities/secretField'

import type { TokenD1 } from './tables'
import { SIGNING_KEYS_TABLE } from './tables'

/**
 * Rotating ES256 signing keys for API access tokens.
 *
 * One key signs at a time (the newest that is not retired). A key older than
 * ROTATE_AFTER_MS is replaced the next time anything signs; the old key is
 * retired but stays in the published key set until every token it signed has
 * expired (tokens last at most an hour) plus a margin, then it is deleted.
 * Private keys are stored encrypted with the site secret; public keys are
 * published at /.well-known/jwks.json.
 */

export const ROTATE_AFTER_MS = 30 * 86_400_000
export const RETIRED_KEEP_MS = 25 * 3_600_000

export type PublicJwk = { kty: 'EC'; crv: 'P-256'; x: string; y: string; kid: string; alg: 'ES256'; use: 'sig' }

export type SigningKeyRow = {
  kid: string
  publicJwk: PublicJwk
  /** Decrypted. Server use only. */
  privateJwk: JsonWebKey
  createdAt: string
  retiredAt: string | null
}

export type SigningKeyStore = {
  list(): Promise<SigningKeyRow[]>
  insert(row: SigningKeyRow): Promise<void>
  retire(kid: string, at: string): Promise<void>
  remove(kid: string): Promise<void>
}

type Raw = { kid: string; public_jwk: string; private_jwk: string; created_at: string; retired_at: string | null }

const parse = <T>(text: string): T | null => {
  try {
    return JSON.parse(text) as T
  } catch {
    return null
  }
}

export const createD1SigningKeyStore = (getDb: () => Promise<TokenD1>): SigningKeyStore => ({
  async list() {
    const db = await getDb()
    const result = await db.prepare(`SELECT * FROM ${SIGNING_KEYS_TABLE} ORDER BY created_at DESC`).bind().all<Raw>()
    const rows: SigningKeyRow[] = []
    for (const raw of result.results ?? []) {
      const publicJwk = parse<PublicJwk>(raw.public_jwk)
      const privateText = decryptSecret(raw.private_jwk)
      const privateJwk = typeof privateText === 'string' && privateText ? parse<JsonWebKey>(privateText) : null
      // A key whose private half cannot be read (site secret rotated) is skipped, so a new one takes over.
      if (publicJwk && privateJwk) rows.push({ kid: raw.kid, publicJwk, privateJwk, createdAt: raw.created_at, retiredAt: raw.retired_at })
    }
    return rows
  },
  async insert(row) {
    const db = await getDb()
    await db
      .prepare(`INSERT INTO ${SIGNING_KEYS_TABLE} (kid, public_jwk, private_jwk, created_at, retired_at) VALUES (?, ?, ?, ?, NULL)`)
      .bind(row.kid, JSON.stringify(row.publicJwk), encryptSecret(JSON.stringify(row.privateJwk)), row.createdAt)
      .run()
  },
  async retire(kid, at) {
    const db = await getDb()
    await db.prepare(`UPDATE ${SIGNING_KEYS_TABLE} SET retired_at = ? WHERE kid = ? AND retired_at IS NULL`).bind(at, kid).run()
  },
  async remove(kid) {
    const db = await getDb()
    await db.prepare(`DELETE FROM ${SIGNING_KEYS_TABLE} WHERE kid = ?`).bind(kid).run()
  },
})

const toBase64Url = (bytes: Uint8Array): string => {
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export async function generateSigningKey(now: number): Promise<SigningKeyRow> {
  const pair = (await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])) as CryptoKeyPair
  const publicRaw = (await crypto.subtle.exportKey('jwk', pair.publicKey)) as JsonWebKey
  const privateJwk = (await crypto.subtle.exportKey('jwk', pair.privateKey)) as JsonWebKey
  const kid = toBase64Url(crypto.getRandomValues(new Uint8Array(12)))
  const publicJwk: PublicJwk = { kty: 'EC', crv: 'P-256', x: String(publicRaw.x), y: String(publicRaw.y), kid, alg: 'ES256', use: 'sig' }
  return { kid, publicJwk, privateJwk, createdAt: new Date(now).toISOString(), retiredAt: null }
}

const activeKeys = (rows: readonly SigningKeyRow[]): SigningKeyRow[] =>
  rows.filter((r) => !r.retiredAt).sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))

/** The key that should sign now: a fresh one is made when none exists or the newest is due for rotation. */
export async function currentSigningKey(store: SigningKeyStore, now: number): Promise<SigningKeyRow> {
  const rows = await store.list()
  const active = activeKeys(rows)
  const newest = active[0]
  if (newest && now - Date.parse(newest.createdAt) < ROTATE_AFTER_MS) return newest
  return rotateSigningKeys(store, now, rows)
}

/** Makes a new signing key, retires the others and deletes retired keys past the keep window. */
export async function rotateSigningKeys(store: SigningKeyStore, now: number, existing?: SigningKeyRow[]): Promise<SigningKeyRow> {
  const rows = existing ?? (await store.list())
  const fresh = await generateSigningKey(now)
  await store.insert(fresh)
  const at = new Date(now).toISOString()
  for (const row of rows) {
    if (!row.retiredAt) await store.retire(row.kid, at)
    else if (now - Date.parse(row.retiredAt) > RETIRED_KEEP_MS) await store.remove(row.kid)
  }
  return fresh
}

/** Every key a verifier may need: the active one and recently retired ones. Public halves only. */
export async function publishedKeys(store: SigningKeyStore, now: number): Promise<PublicJwk[]> {
  const rows = await store.list()
  return rows.filter((r) => !r.retiredAt || now - Date.parse(r.retiredAt) <= RETIRED_KEEP_MS).map((r) => r.publicJwk)
}
