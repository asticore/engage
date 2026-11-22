import { NextResponse } from 'next/server'

import { getEngine } from '@/lib/engine'
import { fetchReviews } from '@/features/reviewSources/adapters'
import { publicReviewSources, readReviewAccounts } from '@/features/reviewSources/service'

export const dynamic = 'force-dynamic'

/**
 * Admin only.
 * GET  -> { options: [{ value, label }] }: saved review sources for the editor picker. Id and label only, never a key.
 * POST { id, placeId? } -> { ok, count } or { ok: false, error }: fetches reviews to test the connection. The error
 *                          text is redacted and never contains the key.
 */

const noStore = { 'Cache-Control': 'no-store' }

async function admin(request: Request): Promise<{ engine: Awaited<ReturnType<typeof getEngine>> } | null> {
  const engine = await getEngine()
  const { user } = await engine.auth({ headers: request.headers })
  if (!user || !(user as { roles?: string[] }).roles?.includes('admin')) return null
  return { engine }
}

export async function GET(request: Request): Promise<Response> {
  const ctx = await admin(request)
  if (!ctx) return NextResponse.json({ error: 'Not found' }, { status: 404, headers: noStore })
  return NextResponse.json({ options: publicReviewSources(await readReviewAccounts(ctx.engine as never)) }, { headers: noStore })
}

export async function POST(request: Request): Promise<Response> {
  const ctx = await admin(request)
  if (!ctx) return NextResponse.json({ error: 'Not found' }, { status: 404, headers: noStore })
  const body = (await request.json().catch((): null => null)) as { id?: unknown; placeId?: unknown } | null
  const account = (await readReviewAccounts(ctx.engine as never)).find((a) => a.id === body?.id)
  if (!account) return NextResponse.json({ ok: false, error: 'Source not found. Save the Integrations page first.' }, { status: 404, headers: noStore })
  try {
    const reviews = await fetchReviews(account, typeof body?.placeId === 'string' ? body.placeId : '')
    return NextResponse.json({ ok: true, count: reviews.length }, { headers: noStore })
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Test failed' }, { headers: noStore })
  }
}
