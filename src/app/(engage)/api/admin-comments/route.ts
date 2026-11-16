import { NextResponse } from 'next/server'

import { getAdminContext } from '@/admin/auth'
import { cleanSettings, COMMENT_STATUSES, MAX_CONTENT, type CommentStatus } from '@/features/comments/core'
import * as store from '@/features/comments/store'
import { rawD1 } from '@/features/ecommerce/server/db'
import { adminRequestRefusal } from '@/features/forms/origin'
import { getFeatureFlags } from '@/utilities/features'

export const dynamic = 'force-dynamic'

const json = (body: unknown, status = 200): Response => NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } })

async function guard(request: Request, write: boolean) {
  if (write) {
    const refusal = adminRequestRefusal(request)
    if (refusal) return { response: json({ error: refusal }, 403) }
  }
  const context = await getAdminContext()
  if (!context.user) return { response: json({ error: 'Please sign in again.' }, 401) }
  if (!context.isAdmin) return { response: json({ error: 'Only an admin can manage comments.' }, 403) }
  if (!(await getFeatureFlags()).comments) return { response: json({ error: 'Switch Comments on in Site Settings first.' }, 409) }
  return { context }
}

const ids = (v: unknown): number[] => (Array.isArray(v) ? v.map((n) => Math.floor(Number(n))).filter((n) => Number.isFinite(n) && n > 0) : [])

/** GET ?status=pending|approved|spam|trash|all: comments for moderation, with a count per status and the settings. */
export async function GET(request: Request): Promise<Response> {
  const g = await guard(request, false)
  if (!g.context) return g.response
  const raw = new URL(request.url).searchParams.get('status') ?? 'pending'
  const status = COMMENT_STATUSES.includes(raw as CommentStatus) ? (raw as CommentStatus) : 'all'
  const d1 = (await rawD1()) as never as store.D1
  const [list, settings] = await Promise.all([store.listForAdmin(d1, status), store.getSettings(d1)])
  return json({ ...list, settings })
}

/**
 * POST { action: 'status', ids, status } | { action: 'delete', ids } | { action: 'reply', parent, post, content } | { action: 'settings', settings }
 */
export async function POST(request: Request): Promise<Response> {
  const g = await guard(request, true)
  if (!g.context) return g.response
  const body = (await request.json().catch((): null => null)) as Record<string, unknown> | null
  if (!body) return json({ error: 'Invalid request.' }, 400)
  const d1 = (await rawD1()) as never as store.D1
  const now = new Date().toISOString()

  if (body.action === 'status') {
    if (!COMMENT_STATUSES.includes(body.status as CommentStatus)) return json({ error: 'Unknown status.' }, 400)
    await store.setStatus(d1, ids(body.ids), body.status as CommentStatus, now)
    return json({ ok: true })
  }
  if (body.action === 'delete') {
    await store.deleteComments(d1, ids(body.ids))
    return json({ ok: true })
  }
  if (body.action === 'reply') {
    const content = typeof body.content === 'string' ? body.content.trim().slice(0, MAX_CONTENT) : ''
    const parent = ids([body.parent])[0]
    const post = ids([body.post])[0]
    if (!content || !parent || !post) return json({ error: 'Write a reply first.' }, 400)
    const user = g.context.user as { id?: number | string; name?: string; email?: string }
    await store.insertComment(d1, { refType: 'post', refId: post, parentId: parent, name: user.name || 'Site team', email: user.email ?? '', userId: Number(user.id) || null, content, status: 'approved', fromTeam: true, ipHash: '' }, now)
    await store.setStatus(d1, [parent], 'approved', now)
    return json({ ok: true })
  }
  if (body.action === 'settings') {
    await store.saveSettings(d1, cleanSettings(body.settings as Record<string, unknown>))
    return json({ ok: true })
  }
  return json({ error: 'Unknown action.' }, 400)
}
