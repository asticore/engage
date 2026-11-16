'use server'

import { headers } from 'next/headers'

import { getAdminContext } from '@/admin/auth'
import { refuseWhileImpersonating } from '@/features/impersonation/policy'
import { missingCredentials, PROVIDER_IDS, type ProviderId } from '@/features/socialLogin/providers'
import { readSocialConfig } from '@/features/socialLogin/settings'

import { audit, auditContext } from './auditLog'
import { togglePatch } from './authMethods'
import { getSecuritySettings } from './settings'

export type ToggleResult = { ok: boolean; message: string }

/** Admin only: switches one sign-in method on or off from the Authentication overview. A switched-off method disappears from the sign-in form and is refused by the server. */
export async function toggleAuthMethodAction(id: string, on: boolean): Promise<ToggleResult> {
  const incoming = await headers()
  const blocked = refuseWhileImpersonating(incoming)
  if (blocked) return { ok: false, message: blocked }
  const context = await getAdminContext()
  if (!context.user || !context.isAdmin) return { ok: false, message: 'Only an admin can change sign-in methods.' }
  const patch = togglePatch(id, on === true)
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
    await engine.updateGlobal({ slug: 'security-settings', data: patch, overrideAccess: true })
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
