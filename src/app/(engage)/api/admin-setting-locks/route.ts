import { NextResponse } from 'next/server'

import { getAdminContext, hasAdminPanelAccess } from '@/admin/auth'
import { rawD1 } from '@/features/ecommerce/server/db'
import { adminRequestRefusal } from '@/features/forms/origin'
import { deleteSettingLock, listSettingLocks, saveSettingLock } from '@/features/roles/settingLocksStore'
import { validateSettingLock } from '@/features/roles/settingLocks'

export const dynamic = 'force-dynamic'

const json = (body: unknown, status = 200): Response => NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } })

/**
 * GET: every setting lock, for anyone in the admin panel (the editors need them to show lock icons and refuse edits).
 * POST { lock } saves one; POST { action: 'delete', id } removes one. Only an admin may change locks.
 */
export async function GET(): Promise<Response> {
  const ctx = await getAdminContext()
  if (!hasAdminPanelAccess(ctx.user)) return json({ error: 'Unauthorised' }, 401)
  return json({ locks: await listSettingLocks((await rawD1()) as never) })
}

export async function POST(request: Request): Promise<Response> {
  const refusal = adminRequestRefusal(request)
  if (refusal) return json({ error: refusal }, 403)
  const ctx = await getAdminContext()
  if (!hasAdminPanelAccess(ctx.user)) return json({ error: 'Unauthorised' }, 401)
  if (!ctx.isAdmin) return json({ error: 'Forbidden' }, 403)
  const body = (await request.json().catch((): null => null)) as Record<string, unknown> | null
  const d1 = (await rawD1()) as never
  if (body?.action === 'delete') {
    const id = Number(body.id)
    if (!Number.isInteger(id) || id < 1) return json({ error: 'Unknown lock.' }, 400)
    await deleteSettingLock(d1, id)
    return json({ ok: true })
  }
  const parsed = validateSettingLock(body?.lock)
  if (parsed.ok === false) return json({ error: parsed.error }, 400)
  await saveSettingLock(d1, parsed.lock, new Date().toISOString())
  return json({ ok: true })
}
