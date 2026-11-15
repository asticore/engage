import { NextResponse } from 'next/server'

import pkg from '../../../../../package.json'
import { getAdminContext, hasAdminPanelAccess } from '@/admin/auth'
import { checkForUpdate, type UpdateCheck } from '@/features/updates/check'

export const dynamic = 'force-dynamic'

/** One answer is kept for six hours per Worker, so opening the admin does not call GitHub each time. */
const TTL_MS = 6 * 60 * 60 * 1000
let cached: { at: number; value: UpdateCheck } | null = null

/**
 * GET /api/admin-update-check: is a newer Engage released? Super admins only (an admin is the top role), others get 403 so the
 * popup never shows for them. Add `?refresh=1` to skip the kept answer. Set UPDATE_REPO (owner/name) on a fork to point Update at the fork.
 */
export async function GET(request: Request): Promise<Response> {
  const ctx = await getAdminContext()
  if (!hasAdminPanelAccess(ctx.user)) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  if (!ctx.isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const refresh = new URL(request.url).searchParams.get('refresh') === '1'
  if (!refresh && cached && Date.now() - cached.at < TTL_MS) return NextResponse.json(cached.value, { headers: { 'Cache-Control': 'no-store' } })
  const value = await checkForUpdate(pkg.version, process.env.UPDATE_REPO)
  if (!value.error) cached = { at: Date.now(), value }
  return NextResponse.json(value, { headers: { 'Cache-Control': 'no-store' } })
}
