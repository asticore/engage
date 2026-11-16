import { isSafeHttpsUrl } from './endpoints'
import { configFromRow, extraRowFor, type ExtraRow } from './extraStore'
import { isExtraProviderId, missingCredentials, PROVIDERS, type ExtraProviderId } from './providers'

/**
 * The server-side rules for saving one of the separately stored providers. The
 * screen shows the same messages, but this is the check that counts: an API call
 * to the action cannot skip it. A blank secret keeps the saved one.
 */

export type ExtraInput = {
  enabled?: unknown
  clientId?: unknown
  clientSecret?: unknown
  redirectConfirmed?: unknown
  label?: unknown
  discoveryUrl?: unknown
  authUrl?: unknown
  tokenUrl?: unknown
  userinfoUrl?: unknown
  scopes?: unknown
  subjectClaim?: unknown
  emailClaim?: unknown
  verifiedClaim?: unknown
  trustEmail?: unknown
}

export type ExtraResult = { ok: true; row: ExtraRow } | { ok: false; message: string }

const text = (value: unknown, max: number): string => (typeof value === 'string' ? value.trim().slice(0, max) : '')
const CLAIM = /^[A-Za-z0-9_.:/-]{1,60}$/
const SCOPE = /^[A-Za-z0-9_.:/-]{1,60}$/

export function validateExtraInput(id: unknown, input: ExtraInput, existing: readonly ExtraRow[]): ExtraResult {
  if (!isExtraProviderId(id)) return { ok: false, message: 'Unknown provider.' }
  const provider: ExtraProviderId = id
  const label = PROVIDERS[provider].label
  const saved = extraRowFor(existing, provider)
  const secret = text(input.clientSecret, 500)
  const settings: Record<string, unknown> = {}

  if (provider === 'oidc') {
    const names = { discoveryUrl: 'discovery URL', authUrl: 'authorize URL', tokenUrl: 'token URL', userinfoUrl: 'user info URL' } as const
    for (const key of Object.keys(names) as Array<keyof typeof names>) {
      const value = text(input[key], 500)
      if (value && !isSafeHttpsUrl(value)) return { ok: false, message: `The ${names[key]} must be an https address on a public host name.` }
      settings[key] = value
    }
    settings.label = text(input.label, 40)
    const scopes = text(input.scopes, 300).split(/[\s,]+/).filter(Boolean)
    if (scopes.some((s) => !SCOPE.test(s))) return { ok: false, message: 'Scopes can only hold letters, numbers and : . _ / - separated by spaces.' }
    settings.scopes = scopes.join(' ')
    for (const key of ['subjectClaim', 'emailClaim', 'verifiedClaim'] as const) {
      const value = text(input[key], 60)
      if (value && !CLAIM.test(value)) return { ok: false, message: 'Claim names can only hold letters, numbers and : . _ / -.' }
      settings[key] = value
    }
    settings.trustEmail = input.trustEmail === true
  }

  const row: ExtraRow = {
    provider,
    enabled: input.enabled === true,
    clientId: text(input.clientId, 300),
    clientSecret: secret || saved.clientSecret,
    redirectConfirmed: input.redirectConfirmed === true,
    settings,
  }
  if (row.enabled) {
    const missing = missingCredentials(provider, configFromRow(row))
    if (missing.length > 0) return { ok: false, message: `${label} sign-in cannot be switched on yet. Save the ${missing.join(', ')} first.` }
  }
  return { ok: true, row }
}
