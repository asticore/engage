import { resolveD1Binding } from '@/cms/db/connect'

/**
 * Tables for signing keys and one-time tokens. They are created the first time
 * they are used (`CREATE TABLE IF NOT EXISTS`), like the theme styles table, so
 * a site that never uses tokens carries nothing extra and no migration runs.
 */

export type TokenStatement = {
  first<T>(): Promise<T | null>
  all<T>(): Promise<{ results?: T[] }>
  run(): Promise<unknown>
}
export type TokenD1 = { prepare(sql: string): { bind(...values: unknown[]): TokenStatement } }

export const SIGNING_KEYS_TABLE = 'eg_signing_keys'
export const ONE_TIME_TOKENS_TABLE = 'eg_one_time_tokens'

const STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS ${SIGNING_KEYS_TABLE} (kid TEXT PRIMARY KEY NOT NULL, public_jwk TEXT NOT NULL, private_jwk TEXT NOT NULL, created_at TEXT NOT NULL, retired_at TEXT)`,
  `CREATE TABLE IF NOT EXISTS ${ONE_TIME_TOKENS_TABLE} (id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, token_hash TEXT NOT NULL, purpose TEXT NOT NULL, user_id INTEGER, payload TEXT, created_at TEXT NOT NULL, expires_at TEXT NOT NULL, used_at TEXT)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS eg_one_time_tokens_hash_idx ON ${ONE_TIME_TOKENS_TABLE} (token_hash)`,
]

let ensured: Promise<void> | null = null

export async function defaultTokenD1(): Promise<TokenD1> {
  const d1 = (await resolveD1Binding()) as unknown as TokenD1
  if (!ensured) {
    ensured = (async (): Promise<void> => {
      for (const statement of STATEMENTS) await d1.prepare(statement).bind().run()
    })().catch((error: unknown): never => {
      ensured = null
      throw error
    })
  }
  await ensured
  return d1
}
