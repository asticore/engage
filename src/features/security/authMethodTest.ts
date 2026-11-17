import { missingCredentials, providerLabel, type ProviderConfig, type ProviderId } from '@/features/socialLogin/providers'

/** Methods whose Test button sends an email to the admin. */
export const EMAIL_TEST_METHODS = ['magic-link', 'email-code', 'email-verification'] as const

export function testKind(id: string): 'email' | 'provider' | null {
  if ((EMAIL_TEST_METHODS as readonly string[]).includes(id)) return 'email'
  if (id.startsWith('social-')) return 'provider'
  return null
}

/** Provider configuration check: credentials complete and the switch on. No network call. */
export function checkProviderConfig(id: ProviderId, cfg: ProviderConfig): { ok: boolean; message: string } {
  const missing = missingCredentials(id, cfg)
  if (missing.length) return { ok: false, message: `Missing: ${missing.join(', ')}.` }
  if (!cfg.enabled) return { ok: true, message: `${providerLabel(id, cfg)} is set up but switched off.` }
  return { ok: true, message: `${providerLabel(id, cfg)} has all its credentials and is shown on the sign-in form.` }
}
