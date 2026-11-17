import { NextResponse } from 'next/server'

import { getAdminContext } from '@/admin/auth'
import { rawD1 } from '@/features/ecommerce/server/db'
import { adminRequestRefusal } from '@/features/forms/origin'
import { audit, auditContext } from '@/features/security/auditLog'
import { readSecuritySettingsFromD1 } from '@/features/security/settings'
import type { D1 } from '@/features/security/userBansStore'
import { parseUserBulk } from '@/features/security/userBulk'
import { runUserBulk, type UserBulkResult } from '@/features/security/userBulkStore'

export const dynamic = 'force-dynamic'

const json = (body: unknown, status = 200): Response => NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } })

/** POST { action: ban | unban | revokeSessions | setRole, ids, reason?, days?, role? }. Admin only; staff and member accounts only. */
export async function POST(request: Request): Promise<Response> {
  const refusal = adminRequestRefusal(request)
  if (refusal) return json({ error: refusal }, 403)
  const context = await getAdminContext()
  if (!context.user) return json({ error: 'Please sign in again.' }, 401)
  if (!context.isAdmin) return json({ error: 'Only an admin can change users in bulk.' }, 403)
  const parsed = parseUserBulk(await request.json().catch((): null => null))
  if (parsed.ok === false) return json({ error: parsed.error }, 400)
  const me = context.user as { id?: number | string; email?: string }
  const results: UserBulkResult[] = await runUserBulk(
    (await rawD1()) as never as D1,
    { ...parsed, actorId: Number(me.id), actorEmail: me.email ?? '' },
    new Date().toISOString(),
  )
  const done = results.filter((r) => r.ok).length
  const settings = await readSecuritySettingsFromD1()
  void audit({ action: 'user.bulk', detail: `${parsed.action}: ${done} of ${results.length} users`, ...auditContext(request) }, settings)
  return json({ ok: true, done, results })
}
