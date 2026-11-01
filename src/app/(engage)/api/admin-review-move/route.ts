import { NextResponse } from 'next/server'
import { getAdminContext } from '@/admin/auth'
import { handleInReviewCount, handleInReviewMove } from '@/features/approval/handlers'
import { viewerFromContext } from '@/features/approval/viewer'

export const dynamic = 'force-dynamic'

/**
 * Documents in review for one content type, and moving them to step 1 of the active workflow.
 *
 * GET ?collection=<slug>: { count } of documents now in review.
 * POST { collection }: moves them to step 1, clearing their approvals, and writes a history row for each.
 *
 * Admins only. Rules live in src/features/approval/handlers.ts.
 */
export async function GET(request: Request): Promise<Response> {
  try {
    const context = await getAdminContext()
    const viewer = viewerFromContext(context)
    if (!viewer) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
    const url = new URL(request.url)
    const result = await handleInReviewCount({ engine: context.engine as never, viewer, collection: url.searchParams.get('collection') })
    return NextResponse.json(result.body, { status: result.status, headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.error('admin-review-move GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    const context = await getAdminContext()
    const viewer = viewerFromContext(context)
    if (!viewer) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
    const body = (await request.json().catch((): null => null)) as { collection?: unknown } | null
    const result = await handleInReviewMove({ engine: context.engine as never, viewer, collection: body?.collection })
    return NextResponse.json(result.body, { status: result.status, headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.error('admin-review-move POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
