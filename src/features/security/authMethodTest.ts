import { UI_STRING_SOURCE, interpolate, type UiStringKey, type UiStringVars } from '@/features/uiStrings'
import { missingCredentials, providerLabel, type ProviderConfig, type ProviderId } from '@/features/socialLogin/providers'

/** Methods whose Test button sends an email to the admin. */
export const EMAIL_TEST_METHODS = ['magic-link', 'email-code', 'email-verification'] as const

export function testKind(id: string): 'email' | 'provider' | null {
  if ((EMAIL_TEST_METHODS as readonly string[]).includes(id)) return 'email'
  if (id.startsWith('social-')) return 'provider'
  return null
}

/** Provider configuration check: credentials complete and the switch on. No network call. */
export function checkProviderConfig(id: ProviderId, cfg: ProviderConfig, tr: (key: UiStringKey, vars?: UiStringVars) => string = (key, vars) => interpolate(UI_STRING_SOURCE[key], vars)): { ok: boolean; message: string } {
  const missing = missingCredentials(id, cfg)
  if (missing.length) return { ok: false, message: tr('auth.msg.providerMissing', { list: missing.join(', ') }) }
  if (!cfg.enabled) return { ok: true, message: tr('auth.msg.providerOff', { provider: providerLabel(id, cfg) }) }
  return { ok: true, message: tr('auth.msg.providerReady', { provider: providerLabel(id, cfg) }) }
}
