import { NextResponse } from 'next/server'
import { getAdminContext, hasAdminPanelAccess } from '@/admin/auth'
import { saveTourPref } from '@/features/adminTour/preference'

export const dynamic = 'force-dynamic'

/**
 * POST: records that the signed-in user has seen the admin tour (once per
 * account, any browser). Body: { status: 'completed' | 'skipped' }.
 * Only ever writes the caller's own row.
 */
export async function POST(request: Request): Promise<Response> {
  try {
    const context = await getAdminContext()
    if (!hasAdminPanelAccess(context.user)) {
      return NextResponse.json({ error: 'unauthorised' }, { status: 401 })
    }

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }
    const status = (body as { status?: unknown } | null)?.status
    if (status !== 'completed' && status !== 'skipped') {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }

    const saved = await saveTourPref(context.engine, context.user, status)
    return NextResponse.json({ ok: true, pref: saved }, { status: 200 })
  } catch (error) {
    console.error('admin-tour POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
