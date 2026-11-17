import { NextResponse } from 'next/server'

import { getAdminContext } from '@/admin/auth'
import { rawD1 } from '@/features/ecommerce/server/db'
import { adminRequestRefusal } from '@/features/forms/origin'
import { audit, auditContext } from '@/features/security/auditLog'
import { MAX_BAN_DAYS, type BanRow } from '@/features/security/userBans'
import * as store from '@/features/security/userBansStore'
import { readSecuritySettingsFromD1 } from '@/features/security/settings'

export const dynamic = 'force-dynamic'

const json = (body: unknown, status = 200): Response => NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } })

async function guard(request: Request, write: boolean) {
  if (write) {
    const refusal = adminRequestRefusal(request)
    if (refusal) return { response: json({ error: refusal }, 403) }
  }
  const context = await getAdminContext()
  if (!context.user) return { response: json({ error: 'Please sign in again.' }, 401) }
  if (!context.isAdmin) return { response: json({ error: 'Only an admin can ban users.' }, 403) }
  return { context }
}

/** GET: banned users with their reason and expiry. */
export async function GET(request: Request): Promise<Response> {
  const g = await guard(request, false)
  if (!g.context) return g.response
  const bans = await store.listBans((await rawD1()) as never as store.D1).catch((): BanRow[] => [])
  return json({ bans })
}

/** POST { action: 'ban', email, reason, days? } | { action: 'unban', userId } */
export async function POST(request: Request): Promise<Response> {
  const g = await guard(request, true)
  if (!g.context) return g.response
  const body = (await request.json().catch((): null => null)) as Record<string, unknown> | null
  if (!body) return json({ error: 'Invalid request.' }, 400)
  const d1 = (await rawD1()) as never as store.D1
  const settings = await readSecuritySettingsFromD1()
  const ctx = auditContext(request)
  const me = g.context.user as { id?: number | string; email?: string }
  const now = new Date().toISOString()

  if (body.action === 'ban') {
    const email = typeof body.email === 'string' ? body.email.trim() : ''
    const reason = typeof body.reason === 'string' ? body.reason.trim().slice(0, 300) : ''
    const days = body.days === '' || body.days == null ? null : Math.floor(Number(body.days))
    if (!email) return json({ error: 'Enter the email address of the account to ban.' }, 400)
    if (days !== null && (!Number.isFinite(days) || days < 1 || days > MAX_BAN_DAYS)) return json({ error: `Days must be from 1 to ${MAX_BAN_DAYS}, or empty for a permanent ban.` }, 400)
    const target = await store.findUserByEmail(d1, email)
    if (!target) return json({ error: 'No account has that email address.' }, 404)
    if (String(target.id) === String(me.id)) return json({ error: 'You cannot ban your own account.' }, 400)
    const expires = await store.banUser(d1, { userId: target.id, reason, days, by: me.email ?? '' }, now)
    void audit({ action: 'user.banned', detail: `user ${target.id}${expires ? ` until ${expires.slice(0, 10)}` : ' permanently'}${reason ? `: ${reason}` : ''}`, ...ctx }, settings)
    return json({ ok: true })
  }
  if (body.action === 'unban') {
    const userId = Math.floor(Number(body.userId))
    if (!Number.isFinite(userId) || userId < 1) return json({ error: 'Unknown user.' }, 400)
    await store.unbanUser(d1, userId)
    void audit({ action: 'user.unbanned', detail: `user ${userId}`, ...ctx }, settings)
    return json({ ok: true })
  }
  return json({ error: 'Unknown action.' }, 400)
}
