import { NextResponse } from 'next/server'
import { getAdminContext, hasAdminPanelAccess } from '@/admin/auth'
import { readProductClicks } from '@/features/ecommerce/outbound'

export const dynamic = 'force-dynamic'

/** GET /api/admin-outbound-clicks?product=<id>&days=30 - clicks per source for one external product. Admin only. */
export async function GET(request: Request): Promise<Response> {
  const context = await getAdminContext()
  if (!hasAdminPanelAccess(context.user)) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  const params = new URL(request.url).searchParams
  const product = Number(params.get('product'))
  const days = Math.min(365, Math.max(1, Number(params.get('days')) || 30))
  if (!Number.isInteger(product) || product < 1) return NextResponse.json({ error: 'Bad product' }, { status: 400 })
  const from = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10)
  const rows = await readProductClicks(product, from)
  return NextResponse.json({ days, total: rows.reduce((n, r) => n + r.clicks, 0), rows }, { headers: { 'Cache-Control': 'no-store' } })
}
