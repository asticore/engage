import type { Engine } from '@/engine'

import { applyExtraRows, readExtraRows } from './extraStore'
import {
  GLOBAL_PROVIDER_IDS,
  PROVIDER_IDS,
  emptySocialConfig,
  isUsable,
  providerLabel,
  safeTenant,
  type ProviderId,
  type SocialConfig,
} from './providers'
import { readMatrix } from '@/features/security/authMatrix'

import { capitalise } from './util'

/** Reads the `socialLogin` group of the Security settings global. Secrets are decrypted: server use only. */

const text = (v: unknown): string => (typeof v === 'string' ? v.trim() : '')

export function configFromDoc(doc: Record<string, unknown> | null | undefined): SocialConfig {
  const config = emptySocialConfig()
  if (!doc) return config
  const group = (doc.socialLogin && typeof doc.socialLogin === 'object' ? doc.socialLogin : {}) as Record<string, unknown>
  const get = (key: string): unknown => (key in group ? group[key] : doc[`socialLogin${capitalise(key)}`])

  config.allowSignupViaSocial = get('allowSignupViaSocial') !== false
  config.allowAdminSocialLogin = get('allowAdminSocialLogin') === true
  for (const id of GLOBAL_PROVIDER_IDS) {
    const p = config.providers[id]
    p.enabled = get(`${id}Enabled`) === true
    p.clientId = text(get(`${id}ClientId`))
    p.clientSecret = text(get(`${id}ClientSecret`))
    p.redirectConfirmed = get(`${id}RedirectConfirmed`) === true
  }
  const apple = config.providers.apple
  apple.teamId = text(get('appleTeamId'))
  apple.keyId = text(get('appleKeyId'))
  apple.privateKey = text(get('applePrivateKey'))
  config.providers.microsoft.tenant = safeTenant(text(get('microsoftTenant')))
  return config
}

export async function readSocialConfig(engine: Pick<Engine, 'findGlobal'>): Promise<SocialConfig> {
  try {
    const doc = await engine.findGlobal({ slug: 'security-settings', depth: 0, overrideAccess: true })
    const config = applyExtraRows(configFromDoc(doc as Record<string, unknown> | null), await readExtraRows())
    const matrix = await readMatrix()
    const socialOf = (list: string[]): string[] => list.filter((m) => m.startsWith('social-')).map((m) => m.slice(7))
    config.blocked = { admin: socialOf(matrix.admin), account: socialOf(matrix.account), members: socialOf(matrix.members) }
    return config
  } catch {
    // Unreadable settings means no provider is usable: fail closed.
    return emptySocialConfig()
  }
}

export type PublicProvider = { id: ProviderId; label: string }

/** What the sign-in screens may know: which providers to offer. No credentials. */
export function usableProviders(config: SocialConfig, area: 'account' | 'admin' | 'members' = 'account'): PublicProvider[] {
  if (area === 'admin' && !config.allowAdminSocialLogin) return []
  return PROVIDER_IDS.filter((id) => !(config.blocked?.[area] ?? []).includes(id) && isUsable(id, config.providers[id])).map((id) => ({ id, label: providerLabel(id, config.providers[id]) }))
}
