import { NextRequest, NextResponse } from 'next/server'

import { adminRequestRefusal } from '@/features/forms/origin'
import { conflictResponse, currentVersions, expectedVersions, isStale } from '@/features/integrations/staleTab'
import { gate, providerFrom, NO_STORE } from '@/features/tracking/connect/routeSupport'
import { TRACKING_CONNECTIONS_SLUG } from '@/features/tracking/connect/constants'
import { disconnect } from '@/features/tracking/connect/service'

export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ provider: string }> }

/**
 * POST /api/tracking-connect/[provider]/disconnect: revokes where the provider allows it, then deletes the token here.
 * Refused with 409 before anything is revoked when the screen is out of date.
 */
export async function POST(request: NextRequest, { params }: Ctx): Promise<Response> {
  const provider = providerFrom((await params).provider)
  if (!provider) return NextResponse.json({ ok: false, reason: 'not-found' }, { status: 404, headers: NO_STORE })
  try {
    const refusal = adminRequestRefusal(request)
    if (refusal) return NextResponse.json({ ok: false, reason: 'refused' }, { status: 403, headers: NO_STORE })
    const session = await gate(request)
    if ('response' in session) return session.response
    if (await isStale(session.deps.engine, TRACKING_CONNECTIONS_SLUG, expectedVersions(request))) return conflictResponse(NO_STORE)
    const result = await disconnect(session.deps, provider)
    const versions = await currentVersions(session.deps.engine)
    return NextResponse.json({ ok: true, revokedAtProvider: result.revokedAtProvider, versions }, { headers: NO_STORE })
  } catch (error) {
    console.error('tracking connect disconnect error:', error instanceof Error ? error.name : 'unknown')
    return NextResponse.json({ ok: false, reason: 'error' }, { status: 500, headers: NO_STORE })
  }
}
