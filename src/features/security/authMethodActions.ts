
import { headers } from 'next/headers'

import { getAdminContext } from '@/admin/auth'
import { getAdminUi } from '@/admin/i18n/serverUi'
import { refuseWhileImpersonating } from '@/features/impersonation/policy'
import { extraRowFor, readExtraRows, writeExtraRow } from '@/features/socialLogin/extraStore'
import { isExtraProviderId, isProviderId, missingCredentials, PROVIDER_IDS, type ProviderId } from '@/features/socialLogin/providers'
import { readSocialConfig } from '@/features/socialLogin/settings'

import { audit, auditContext } from './auditLog'
import { readMatrix, setBlocked, writeMatrix, type MatrixArea } from './authMatrix'
import { checkProviderConfig, testKind } from './authMethodTest'
import { placeHasWayIn, togglePatch } from './authMethods'
import { getSecuritySettings } from './settings'

export type ToggleResult = { ok: boolean; message: string }

/** Admin only: switches one sign-in method on or off from the Authentication overview. A switched-off method disappears from the sign-in form and is refused by the server. */
export async function toggleAuthMethodAction(id: string, on: boolean): Promise<ToggleResult> {
  const ui = await getAdminUi()
  const incoming = await headers()
  const blocked = refuseWhileImpersonating(incoming)
  if (blocked) return { ok: false, message: blocked }
  const context = await getAdminContext()
  if (!context.user || !context.isAdmin) return { ok: false, message: ui.t('auth.msg.adminOnlyChange') }
  const extra = id.startsWith('social-') ? id.slice('social-'.length) : ''
  const patch = isExtraProviderId(extra) ? {} : togglePatch(id, on === true)
  if (!patch) return { ok: false, message: ui.t('auth.msg.noSwitch') }
  try {
    const engine = context.engine as never as { updateGlobal: (a: Record<string, unknown>) => Promise<unknown> }
    if (id.startsWith('social-') && on) {
      const provider = id.slice('social-'.length) as ProviderId
      if (!(PROVIDER_IDS as readonly string[]).includes(provider)) return { ok: false, message: ui.t('auth.msg.unknownProvider') }
      const social = await readSocialConfig(context.engine as never)
      const missing = missingCredentials(provider, social.providers[provider])
      if (missing.length) return { ok: false, message: ui.t('auth.msg.addFirst', { missing: missing.join(', ') }) }
    }
    if (isExtraProviderId(extra)) {
      // Providers stored apart from the Security settings keep their switch in their own table.
      const row = extraRowFor(await readExtraRows(), extra)
      await writeExtraRow({ ...row, enabled: on === true })
    } else {
      await engine.updateGlobal({ slug: 'security-settings', data: patch, overrideAccess: true })
    }
    try {
      const settings = await getSecuritySettings(context.engine as never)
      const origin = auditContext(new Request('https://engage.local', { headers: incoming }))
      const actor = context.user as unknown as { id?: number; email?: string }
      await audit({ action: 'settings.update', actorId: actor.id ?? null, actorEmail: actor.email ?? null, collectionSlug: 'security-settings', detail: `sign-in method ${id} ${on ? 'on' : 'off'}`, ...origin }, settings)
    } catch {
      // Never fail the switch over a log line.
    }
    return { ok: true, message: ui.t(on ? 'auth.msg.switchedOn' : 'auth.msg.switchedOff') }
  } catch {
    return { ok: false, message: ui.t('auth.msg.saveFailed') }
  }
}

/** Admin only: allow or block one method for one sign-in place (admin sign-in or account sign-in). */
export async function setMethodAreaAction(area: string, method: string, allowed: boolean): Promise<ToggleResult> {
  const ui = await getAdminUi()
  const incoming = await headers()
  const refused = refuseWhileImpersonating(incoming)
  if (refused) return { ok: false, message: refused }
  const context = await getAdminContext()
  if (!context.user || !context.isAdmin) return { ok: false, message: ui.t('auth.msg.adminOnlyChange') }
  if (area !== 'admin' && area !== 'account' && area !== 'members') return { ok: false, message: ui.t('auth.msg.unknownPlace') }
  if (area === 'admin' && method === 'password' && !allowed) return { ok: false, message: ui.t('auth.msg.staffPassword') }
  try {
    const before = await readMatrix()
    const after = setBlocked(before, area as MatrixArea, method, !allowed)
    if (after === before) return { ok: false, message: ui.t('auth.msg.cannotChange') }
    if (!allowed) {
      const settings = await getSecuritySettings(context.engine as never)
      const social = await readSocialConfig(context.engine as never)
      if (!placeHasWayIn(area as MatrixArea, after, settings, social)) {
        return { ok: false, message: ui.t('auth.msg.noWayIn') }
      }
    }
    await writeMatrix(after)
    return { ok: true, message: ui.t(allowed ? 'auth.msg.allowed' : 'auth.msg.blocked') }
  } catch {
    return { ok: false, message: ui.t('auth.msg.saveFailed') }
  }
}

/** Admin only: checks one method. Social providers get a configuration check; email methods send a test email to the admin's own address. */
export async function testAuthMethodAction(id: string): Promise<ToggleResult> {
  const ui = await getAdminUi()
  const incoming = await headers()
  const refused = refuseWhileImpersonating(incoming)
  if (refused) return { ok: false, message: refused }
  const context = await getAdminContext()
  if (!context.user || !context.isAdmin) return { ok: false, message: ui.t('auth.msg.adminOnlyTest') }
  const kind = testKind(String(id))
  if (!kind) return { ok: false, message: ui.t('auth.msg.nothingToTest') }
  try {
    if (kind === 'provider') {
      const provider = id.slice('social-'.length)
      if (!isProviderId(provider)) return { ok: false, message: ui.t('auth.msg.unknownProvider') }
      const social = await readSocialConfig(context.engine as never)
      return checkProviderConfig(provider, social.providers[provider], ui.t)
    }
    const to = (context.user as unknown as { email?: string }).email
    if (!to) return { ok: false, message: ui.t('auth.msg.noEmail') }
    const { sendEmail } = await import('@/features/email')
    const result = await sendEmail({ to, template: 'test', subject: 'Sign-in email test', text: 'This confirms sign-in emails can be sent from your site.', html: '<p>This confirms sign-in emails can be sent from your site.</p>' })
    return result.ok ? { ok: true, message: ui.t('auth.msg.testSent', { to }) } : { ok: false, message: result.error || ui.t('auth.msg.emailFailed') }
  } catch {
    return { ok: false, message: ui.t('auth.msg.testFailed') }
  }
}
