import { NextResponse } from 'next/server'

import { clientKey, hit } from '@/features/security/rateLimit'
import { parseVote, recordVote, voterHash, type VoteD1 } from '@/features/faq/votes'
import { getFeatureFlags } from '@/utilities/features'

export const dynamic = 'force-dynamic'

/** POST {id, helpful}: one "Was this helpful?" vote on a FAQ answer. Public, rate limited, stores a hash only. */
export async function POST(request: Request): Promise<Response> {
  const key = clientKey(request)
  if (hit(`faq-vote:${key}`, 30).limited) return NextResponse.json({ ok: false }, { status: 429, headers: { 'Cache-Control': 'no-store' } })
  const vote = parseVote(await request.json().catch((): null => null))
  if (!vote) return NextResponse.json({ ok: false }, { status: 400, headers: { 'Cache-Control': 'no-store' } })
  try {
    if (!(await getFeatureFlags()).faq) return NextResponse.json({ ok: false }, { status: 404, headers: { 'Cache-Control': 'no-store' } })
    const { getCloudflareContext } = await import('@opennextjs/cloudflare')
    const d1 = (await getCloudflareContext({ async: true }))?.env?.D1 as unknown as VoteD1 | undefined
    if (!d1) return NextResponse.json({ ok: false }, { status: 503, headers: { 'Cache-Control': 'no-store' } })
    await recordVote(d1, vote, await voterHash(key, vote.id), new Date().toISOString())
    return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } })
  } catch {
    return NextResponse.json({ ok: false }, { status: 500, headers: { 'Cache-Control': 'no-store' } })
  }
}
