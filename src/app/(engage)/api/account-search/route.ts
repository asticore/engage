import { NextResponse } from 'next/server'

import { searchAccount } from '@/features/accounts/accountSearch'
import { accountTexts } from '@/features/accounts/portalCopy'
import { accountContext } from '@/features/accounts/session'
import { EMPTY_ACCOUNT_RESULTS, normaliseQuery, PORTAL_SEARCH_MAX_QUERY, PORTAL_SEARCH_MIN_CHARS } from '@/features/accounts/portalSearch'
import { hit } from '@/features/security/rateLimit'

export const dynamic = 'force-dynamic'

const NO_STORE = { 'Cache-Control': 'no-store' }

/**
 * GET ?q= : the signed-in customer's own orders (by number), bookings and
 * subscriptions that match. Private data, so it is never cached and it answers
 * 401 to anyone without a session. The identity comes from the session cookie only.
 */
export async function GET(request: Request): Promise<Response> {
  const { engine, flags, user } = await accountContext()
  if (!flags.accounts) return NextResponse.json({ error: 'not-found' }, { status: 404, headers: NO_STORE })
  if (!user) return NextResponse.json({ error: 'signed-in' }, { status: 401, headers: NO_STORE })

  const decision = hit(`account-search:${user.id}`, 60)
  if (decision.limited) {
    return NextResponse.json(EMPTY_ACCOUNT_RESULTS, { status: 429, headers: { ...NO_STORE, 'Retry-After': String(decision.retryAfterSeconds) } })
  }

  const query = normaliseQuery(new URL(request.url).searchParams.get('q') ?? '').slice(0, PORTAL_SEARCH_MAX_QUERY).trim()
  if (query.length < PORTAL_SEARCH_MIN_CHARS) return NextResponse.json(EMPTY_ACCOUNT_RESULTS, { headers: NO_STORE })

  try {
    return NextResponse.json(await searchAccount(engine, user, query, await accountTexts()), { headers: NO_STORE })
  } catch {
    return NextResponse.json({ error: 'unavailable' }, { status: 503, headers: NO_STORE })
  }
}
