import { resolveD1Binding } from '@/cms/db/connect'
import { decryptSecret, encryptSecret } from '@/utilities/secretField'

import { emptyProviderConfig, EXTRA_PROVIDER_IDS, isExtraProviderId, type ExtraProviderId, type ProviderConfig, type SocialConfig } from './providers'

/**
 * Settings for the providers that do not live on the Security settings page
 * (X, LinkedIn, TikTok, Slack and the free-form one) and for Google One Tap.
 * One row per provider in `eg_social_providers`, created the first time it is
 * used (like the theme styles table), so no migration runs and a site that never
 * uses these carries nothing extra. The client secret is stored encrypted with
 * the site secret. Reads never throw: unreadable settings mean "off".
 */

export const EXTRA_TABLE = 'eg_social_providers'
/** The One Tap switch is a row of its own, so it does not widen any other table. */
export const ONE_TAP_ROW = 'google-one-tap'

type Statement = { first<T>(): Promise<T | null>; all<T>(): Promise<{ results?: T[] }>; run(): Promise<unknown> }
export type ExtraD1 = { prepare(sql: string): { bind(...values: unknown[]): Statement } }

export type ExtraRow = {
  provider: string
  enabled: boolean
  clientId: string
  /** Decrypted. Server use only. */
  clientSecret: string
  redirectConfirmed: boolean
  /** Non-secret options (free-form provider addresses, claim names, label). */
  settings: Record<string, unknown>
}

type Raw = { provider: string; enabled: number; client_id: string | null; client_secret: string | null; redirect_confirmed: number; settings: string | null }

const CREATE = `CREATE TABLE IF NOT EXISTS ${EXTRA_TABLE} (provider TEXT PRIMARY KEY NOT NULL, enabled INTEGER NOT NULL DEFAULT 0, client_id TEXT, client_secret TEXT, redirect_confirmed INTEGER NOT NULL DEFAULT 0, settings TEXT, updated_at TEXT)`

let ensured: Promise<void> | null = null

async function defaultDb(): Promise<ExtraD1> {
  const d1 = (await resolveD1Binding()) as unknown as ExtraD1
  if (!ensured) {
    ensured = d1
      .prepare(CREATE)
      .bind()
      .run()
      .then((): void => undefined)
      .catch((error: unknown): never => {
        ensured = null
        throw error
      })
  }
  await ensured
  return d1
}

const parse = (text: string | null): Record<string, unknown> => {
  if (!text) return {}
  try {
    const value = JSON.parse(text) as unknown
    return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
  } catch {
    return {}
  }
}

export async function readExtraRows(getDb: () => Promise<ExtraD1> = defaultDb): Promise<ExtraRow[]> {
  try {
    const db = await getDb()
    const result = await db.prepare(`SELECT * FROM ${EXTRA_TABLE}`).bind().all<Raw>()
    return (result.results ?? []).map((raw) => {
      const secret = decryptSecret(raw.client_secret ?? '')
      return {
        provider: raw.provider,
        enabled: Number(raw.enabled) === 1,
        clientId: raw.client_id ?? '',
        clientSecret: typeof secret === 'string' ? secret : '',
        redirectConfirmed: Number(raw.redirect_confirmed) === 1,
        settings: parse(raw.settings),
      }
    })
  } catch {
    return []
  }
}

export async function writeExtraRow(row: ExtraRow, getDb: () => Promise<ExtraD1> = defaultDb): Promise<void> {
  const db = await getDb()
  await db
    .prepare(
      `INSERT INTO ${EXTRA_TABLE} (provider, enabled, client_id, client_secret, redirect_confirmed, settings, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
       ON CONFLICT(provider) DO UPDATE SET enabled = ?2, client_id = ?3, client_secret = ?4, redirect_confirmed = ?5, settings = ?6, updated_at = ?7`,
    )
    .bind(
      row.provider,
      row.enabled ? 1 : 0,
      row.clientId,
      row.clientSecret ? encryptSecret(row.clientSecret) : '',
      row.redirectConfirmed ? 1 : 0,
      JSON.stringify(row.settings),
      new Date().toISOString(),
    )
    .run()
}

const str = (value: unknown, max = 500): string => (typeof value === 'string' ? value.trim().slice(0, max) : '')

/** The saved settings of one provider as the sign-in code reads them. */
export function configFromRow(row: ExtraRow | undefined): ProviderConfig {
  const cfg = emptyProviderConfig()
  if (!row) return cfg
  cfg.enabled = row.enabled
  cfg.clientId = row.clientId.trim()
  cfg.clientSecret = row.clientSecret.trim()
  cfg.redirectConfirmed = row.redirectConfirmed
  const s = row.settings
  cfg.label = str(s.label, 40)
  cfg.discoveryUrl = str(s.discoveryUrl)
  cfg.authUrl = str(s.authUrl)
  cfg.tokenUrl = str(s.tokenUrl)
  cfg.userinfoUrl = str(s.userinfoUrl)
  cfg.scopes = str(s.scopes, 300)
  cfg.subjectClaim = str(s.subjectClaim, 60)
  cfg.emailClaim = str(s.emailClaim, 60)
  cfg.verifiedClaim = str(s.verifiedClaim, 60)
  cfg.trustEmail = s.trustEmail === true
  return cfg
}

/** Adds the extra providers and the One Tap switch to a config read from the Security settings. */
export function applyExtraRows(config: SocialConfig, rows: readonly ExtraRow[]): SocialConfig {
  for (const id of EXTRA_PROVIDER_IDS) config.providers[id] = configFromRow(rows.find((r) => r.provider === id))
  config.googleOneTap = rows.find((r) => r.provider === ONE_TAP_ROW)?.enabled === true
  return config
}

export const extraRowFor = (rows: readonly ExtraRow[], id: ExtraProviderId): ExtraRow =>
  rows.find((r) => r.provider === id) ?? { provider: id, enabled: false, clientId: '', clientSecret: '', redirectConfirmed: false, settings: {} }

export { isExtraProviderId }
