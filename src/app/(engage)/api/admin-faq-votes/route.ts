import { NextResponse } from 'next/server'
import { getAdminContext, hasAdminPanelAccess } from '@/admin/auth'
import { voteTotals, type VoteD1 } from '@/features/faq/votes'

export const dynamic = 'force-dynamic'

/** GET: helpful votes per FAQ, { votes: { [faqId]: { yes, no } } }. Administrators and panel users only. */
export async function GET(): Promise<Response> {
  const headers = { 'Cache-Control': 'no-store' }
  try {
    const context = await getAdminContext()
    if (!hasAdminPanelAccess(context.user)) return NextResponse.json({ error: 'Unauthorised' }, { status: 401, headers })
    const { getCloudflareContext } = await import('@opennextjs/cloudflare')
    const d1 = (await getCloudflareContext({ async: true }))?.env?.D1 as unknown as VoteD1 | undefined
    return NextResponse.json({ votes: d1 ? await voteTotals(d1) : {} }, { headers })
  } catch {
    return NextResponse.json({ votes: {} }, { headers })
  }
}
