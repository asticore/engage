'use server'

import { headers } from 'next/headers'

import { getAdminContext } from '@/admin/auth'
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
  const incoming = await headers()
  const blocked = refuseWhileImpersonating(incoming)
  if (blocked) return { ok: false, message: blocked }
  const context = await getAdminContext()
  if (!context.user || !context.isAdmin) return { ok: false, message: 'Only an admin can change sign-in methods.' }
  const extra = id.startsWith('social-') ? id.slice('social-'.length) : ''
  const patch = isExtraProviderId(extra) ? {} : togglePatch(id, on === true)
  if (!patch) return { ok: false, message: 'That method has no switch here.' }
  try {
    const engine = context.engine as never as { updateGlobal: (a: Record<string, unknown>) => Promise<unknown> }
    if (id.startsWith('social-') && on) {
      const provider = id.slice('social-'.length) as ProviderId
      if (!(PROVIDER_IDS as readonly string[]).includes(provider)) return { ok: false, message: 'Unknown provider.' }
      const social = await readSocialConfig(context.engine as never)
      const missing = missingCredentials(provider, social.providers[provider])
      if (missing.length) return { ok: false, message: `Add ${missing.join(', ')} first, then switch it on.` }
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
    return { ok: true, message: `${on ? 'Switched on' : 'Switched off'}.` }
  } catch {
    return { ok: false, message: 'That could not be saved just now. Try again.' }
  }
}

/** Admin only: allow or block one method for one sign-in place (admin sign-in or account sign-in). */
export async function setMethodAreaAction(area: string, method: string, allowed: boolean): Promise<ToggleResult> {
  const incoming = await headers()
  const refused = refuseWhileImpersonating(incoming)
  if (refused) return { ok: false, message: refused }
  const context = await getAdminContext()
  if (!context.user || !context.isAdmin) return { ok: false, message: 'Only an admin can change sign-in methods.' }
  if (area !== 'admin' && area !== 'account' && area !== 'members') return { ok: false, message: 'Unknown sign-in place.' }
  if (area === 'admin' && method === 'password' && !allowed) return { ok: false, message: 'Staff can always sign in with a password, so it cannot be blocked on the admin sign-in.' }
  try {
    const before = await readMatrix()
    const after = setBlocked(before, area as MatrixArea, method, !allowed)
    if (after === before) return { ok: false, message: 'That method cannot be changed here.' }
    if (!allowed) {
      const settings = await getSecuritySettings(context.engine as never)
      const social = await readSocialConfig(context.engine as never)
      if (!placeHasWayIn(area as MatrixArea, after, settings, social)) {
        return { ok: false, message: 'That would leave this sign-in with no way in. Allow another method first.' }
      }
    }
    await writeMatrix(after)
    return { ok: true, message: allowed ? 'Allowed.' : 'Blocked.' }
  } catch {
    return { ok: false, message: 'That could not be saved just now. Try again.' }
  }
}

/** Admin only: checks one method. Social providers get a configuration check; email methods send a test email to the admin's own address. */
export async function testAuthMethodAction(id: string): Promise<ToggleResult> {
  const incoming = await headers()
  const refused = refuseWhileImpersonating(incoming)
  if (refused) return { ok: false, message: refused }
  const context = await getAdminContext()
  if (!context.user || !context.isAdmin) return { ok: false, message: 'Only an admin can test sign-in methods.' }
  const kind = testKind(String(id))
  if (!kind) return { ok: false, message: 'That method has nothing to test.' }
  try {
    if (kind === 'provider') {
      const provider = id.slice('social-'.length)
      if (!isProviderId(provider)) return { ok: false, message: 'Unknown provider.' }
      const social = await readSocialConfig(context.engine as never)
      return checkProviderConfig(provider, social.providers[provider])
    }
    const to = (context.user as unknown as { email?: string }).email
    if (!to) return { ok: false, message: 'Your account has no email address.' }
    const { sendEmail } = await import('@/features/email')
    const result = await sendEmail({ to, template: 'test', subject: 'Sign-in email test', text: 'This confirms sign-in emails can be sent from your site.', html: '<p>This confirms sign-in emails can be sent from your site.</p>' })
    return result.ok ? { ok: true, message: `Test email sent to ${to}.` } : { ok: false, message: result.error || 'The email could not be sent. Check Email settings.' }
  } catch {
    return { ok: false, message: 'The test could not run just now. Try again.' }
  }
}
