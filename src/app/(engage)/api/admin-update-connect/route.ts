import { getCloudflareContext } from '@opennextjs/cloudflare'
import { NextResponse } from 'next/server'

import { getAdminContext, hasAdminPanelAccess } from '@/admin/auth'
import { adminRequestRefusal } from '@/features/forms/origin'
import { clearConnection, saveConnection, verifyConnection } from '@/features/updates/connection'

export const dynamic = 'force-dynamic'

/**
 * POST /api/admin-update-connect { repo?, token }: keep the GitHub connection that powers one-click updates (checked first, stored
 * encrypted). DELETE removes it. Super admins only.
 */
async function guard(request: Request): Promise<Response | null> {
  const refusal = adminRequestRefusal(request)
  if (refusal) return NextResponse.json({ ok: false, message: refusal }, { status: 403 })
  const ctx = await getAdminContext()
  if (!hasAdminPanelAccess(ctx.user)) return NextResponse.json({ ok: false, message: 'Unauthorised' }, { status: 401 })
  return ctx.isAdmin ? null : NextResponse.json({ ok: false, message: 'Forbidden' }, { status: 403 })
}

export async function POST(request: Request): Promise<Response> {
  const denied = await guard(request)
  if (denied) return denied
  const body = (await request.json().catch((): Record<string, unknown> => ({}))) as { repo?: unknown; token?: unknown }
  const checked = await verifyConnection(body.repo, typeof body.token === 'string' ? body.token : '')
  if (!checked.ok || !('repo' in checked)) return NextResponse.json({ ok: false, message: 'message' in checked ? checked.message : 'Could not check the token.' }, { status: 400 })
  const { env } = await getCloudflareContext({ async: true })
  if (!env.D1) return NextResponse.json({ ok: false, message: 'No database available.' }, { status: 500 })
  await saveConnection(env.D1, { repo: checked.repo, token: String(body.token).trim() })
  return NextResponse.json({ ok: true, message: `Connected to ${checked.repo}.` }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function DELETE(request: Request): Promise<Response> {
  const denied = await guard(request)
  if (denied) return denied
  const { env } = await getCloudflareContext({ async: true })
  if (env.D1) await clearConnection(env.D1)
  return NextResponse.json({ ok: true })
}
