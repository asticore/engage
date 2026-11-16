'use server'

import { headers } from 'next/headers'

import { getAdminContext } from '@/admin/auth'
import { refuseWhileImpersonating } from '@/features/impersonation/policy'
import { audit, auditContext } from '@/features/security/auditLog'
import { getSecuritySettings } from '@/features/security/settings'

import { ONE_TAP_ROW, readExtraRows, writeExtraRow } from './extraStore'
import { validateExtraInput, type ExtraInput } from './extraValidate'
import { isUsable } from './providers'
import { readSocialConfig } from './settings'

export type SaveResult = { ok: boolean; message: string }

async function adminOnly(): Promise<{ ok: true; context: Awaited<ReturnType<typeof getAdminContext>>; incoming: Headers } | { ok: false; message: string }> {
  const incoming = await headers()
  const blocked = refuseWhileImpersonating(incoming)
  if (blocked) return { ok: false, message: blocked }
  const context = await getAdminContext()
  if (!context.user || !context.isAdmin) return { ok: false, message: 'Only an admin can change sign-in providers.' }
  return { ok: true, context, incoming }
}

async function record(context: Awaited<ReturnType<typeof getAdminContext>>, incoming: Headers, detail: string): Promise<void> {
  try {
    const settings = await getSecuritySettings(context.engine as never)
    const actor = context.user as unknown as { id?: number; email?: string }
    await audit({ action: 'settings.update', actorId: actor.id ?? null, actorEmail: actor.email ?? null, collectionSlug: 'social-providers', detail, ...auditContext(new Request('https://engage.local', { headers: incoming })) }, settings)
  } catch {
    // Never fail a save over a log line.
  }
}

/** Admin only: saves X, LinkedIn, TikTok, Slack or the free-form provider. A blank secret keeps the saved one. */
export async function saveExtraProviderAction(id: string, input: ExtraInput): Promise<SaveResult> {
  const gate = await adminOnly()
  if (gate.ok === false) return { ok: false, message: gate.message }
  const result = validateExtraInput(id, input, await readExtraRows())
  if (result.ok === false) return { ok: false, message: result.message }
  try {
    await writeExtraRow(result.row)
  } catch {
    return { ok: false, message: 'That could not be saved just now. Try again.' }
  }
  await record(gate.context, gate.incoming, `sign-in provider ${id} ${result.row.enabled ? 'on' : 'off'}`)
  return { ok: true, message: 'Saved.' }
}

/** Admin only: switches Google One Tap on or off. It needs Google sign-in switched on and complete first. */
export async function saveOneTapAction(on: boolean): Promise<SaveResult> {
  const gate = await adminOnly()
  if (gate.ok === false) return { ok: false, message: gate.message }
  if (on) {
    const config = await readSocialConfig(gate.context.engine as never)
    if (!isUsable('google', config.providers.google)) return { ok: false, message: 'Switch on Google sign-in and save its client ID and secret first (Settings > Security > Social login).' }
  }
  try {
    await writeExtraRow({ provider: ONE_TAP_ROW, enabled: on === true, clientId: '', clientSecret: '', redirectConfirmed: false, settings: {} })
  } catch {
    return { ok: false, message: 'That could not be saved just now. Try again.' }
  }
  await record(gate.context, gate.incoming, `google one tap ${on ? 'on' : 'off'}`)
  return { ok: true, message: 'Saved.' }
}
