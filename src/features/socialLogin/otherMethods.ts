import { resolveD1Binding } from '@/cms/db/connect'
import { getSecuritySettings } from '@/features/security/settings'
import type { getEngine } from '@/lib/engine'

type EngineT = Awaited<ReturnType<typeof getEngine>>

/** True when the account has a registered passkey, or an emailed sign-in (magic link or email code) is switched on. Any failure counts as no. */
export async function userHasPasskeyOrEmailedMethod(engine: EngineT, userId: number): Promise<boolean> {
  try {
    const d1 = await resolveD1Binding()
    const row = await d1.prepare('SELECT COUNT(*) AS n FROM `eg_passkeys` WHERE user_id = ?').bind(userId).first<{ n: number }>()
    if (Number(row?.n ?? 0) > 0) return true
  } catch {
    // No passkey table: none registered.
  }
  try {
    const settings = await getSecuritySettings(engine as never)
    return Boolean(settings.passwordless.magicLinkEnabled || settings.passwordless.emailCodeEnabled)
  } catch {
    return false
  }
}
