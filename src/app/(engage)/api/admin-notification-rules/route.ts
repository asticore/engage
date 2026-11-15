import { NextResponse } from 'next/server'

import { getAdminContext, hasAdminPanelAccess } from '@/admin/auth'
import { rawD1 } from '@/features/ecommerce/server/db'
import { adminRequestRefusal } from '@/features/forms/origin'
import { MERGE_TAGS, NOTIFICATION_TRIGGERS } from '@/features/notifications/triggers'
import { parseRule } from '@/features/notifications/rules'
import { deleteRule, listRules, saveRule } from '@/features/notifications/store'

export const dynamic = 'force-dynamic'

const json = (body: unknown, status = 200): Response => NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } })

async function guard() {
  const ctx = await getAdminContext()
  if (!hasAdminPanelAccess(ctx.user)) return { response: json({ error: 'Unauthorised' }, 401) }
  if (!ctx.isAdmin) return { response: json({ error: 'Forbidden' }, 403) }
  return { ctx }
}

/**
 * GET: every rule, the triggers and each trigger's merge tags (the editor's pickers).
 * POST { rule } saves one rule (with an id it updates, without it adds). POST { action: 'delete', id } removes one. Admin only.
 */
export async function GET(): Promise<Response> {
  const access = await guard()
  if (!access.ctx) return access.response!
  const d1 = (await rawD1()) as never
  return json({ rules: await listRules(d1), triggers: NOTIFICATION_TRIGGERS, tags: MERGE_TAGS })
}

export async function POST(request: Request): Promise<Response> {
  const refusal = adminRequestRefusal(request)
  if (refusal) return json({ error: refusal }, 403)
  const access = await guard()
  if (!access.ctx) return access.response!
  const body = (await request.json().catch((): null => null)) as Record<string, unknown> | null
  const d1 = (await rawD1()) as never
  if (body?.action === 'delete') {
    const id = Number(body.id)
    if (!Number.isInteger(id) || id < 1) return json({ error: 'Unknown notification.' }, 400)
    await deleteRule(d1, id)
    return json({ ok: true })
  }
  const parsed = parseRule(body?.rule)
  if (parsed.ok === false) return json({ error: parsed.error }, 400)
  await saveRule(d1, parsed.rule, new Date().toISOString())
  return json({ ok: true })
}
