import { NextResponse } from 'next/server'

import { getAdminContext, hasAdminPanelAccess } from '@/admin/auth'
import { rawD1 } from '@/features/ecommerce/server/db'
import { adminRequestRefusal } from '@/features/forms/origin'
import { loadVapidKeys, listSubscriptions, removeSubscription, saveSubscription } from '@/features/push/store'
import { validSubscription } from '@/features/push/webpush'

export const dynamic = 'force-dynamic'

const json = (body: unknown, status = 200): Response => NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } })

async function guard() {
  const ctx = await getAdminContext()
  if (!hasAdminPanelAccess(ctx.user)) return { response: json({ error: 'Unauthorised' }, 401) }
  if (!ctx.isAdmin) return { response: json({ error: 'Forbidden' }, 403) }
  return { ctx }
}

/**
 * GET: the public key the browser subscribes with, and how many devices are subscribed.
 * POST { subscription } stores this browser. POST { action: 'unsubscribe', endpoint } removes one. Admin only.
 */
export async function GET(): Promise<Response> {
  const access = await guard()
  if (!access.ctx) return access.response!
  const d1 = (await rawD1()) as never
  const keys = await loadVapidKeys(d1, new Date().toISOString())
  return json({ publicKey: keys.publicKey, devices: (await listSubscriptions(d1)).length })
}

export async function POST(request: Request): Promise<Response> {
  const refusal = adminRequestRefusal(request)
  if (refusal) return json({ error: refusal }, 403)
  const access = await guard()
  if (!access.ctx) return access.response!
  const body = (await request.json().catch((): null => null)) as Record<string, unknown> | null
  const d1 = (await rawD1()) as never
  if (body?.action === 'unsubscribe') {
    if (typeof body.endpoint === 'string') await removeSubscription(d1, body.endpoint)
    return json({ ok: true })
  }
  const sub = validSubscription(body?.subscription)
  if (!sub) return json({ error: 'That browser subscription is not valid.' }, 400)
  const id = (access.ctx.user as { id?: number | string } | null)?.id
  await saveSubscription(d1, sub, typeof id === 'number' ? id : Number(id) || null, new Date().toISOString())
  return json({ ok: true })
}
