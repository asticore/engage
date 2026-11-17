import { NextResponse } from 'next/server'

import { getAdminContext, hasAdminPanelAccess } from '@/admin/auth'
import { adminRequestRefusal } from '@/features/forms/origin'
import { applyForkUpdate, oneClickConfig } from '@/features/updates/oneClick'

export const dynamic = 'force-dynamic'

/** POST /api/admin-update-apply: sync the fork with upstream using the site's GitHub token. Super admins only (an admin is the top role). */
export async function POST(request: Request): Promise<Response> {
  const refusal = adminRequestRefusal(request)
  if (refusal) return NextResponse.json({ ok: false, message: refusal }, { status: 403 })
  const ctx = await getAdminContext()
  if (!hasAdminPanelAccess(ctx.user)) return NextResponse.json({ ok: false, message: 'Unauthorised' }, { status: 401 })
  if (!ctx.isAdmin) return NextResponse.json({ ok: false, message: 'Forbidden' }, { status: 403 })
  const result = await applyForkUpdate(oneClickConfig(process.env.UPDATE_REPO, process.env.UPDATE_GITHUB_TOKEN))
  return NextResponse.json(result, { status: result.ok ? 200 : result.status === 'not-configured' ? 409 : 502, headers: { 'Cache-Control': 'no-store' } })
}
