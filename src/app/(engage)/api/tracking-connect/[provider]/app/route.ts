import { NextRequest, NextResponse } from 'next/server'

import { adminRequestRefusal } from '@/features/forms/origin'
import { conflictResponse, currentVersions, expectedVersions, isStale } from '@/features/integrations/staleTab'
import { gate, providerFrom, NO_STORE } from '@/features/tracking/connect/routeSupport'
import { TRACKING_CONNECTIONS_SLUG } from '@/features/tracking/connect/constants'
import { saveAppCredentials } from '@/features/tracking/connect/service'

export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ provider: string }> }

/**
 * POST /api/tracking-connect/[provider]/app { appId, appSecret }: saves the owner's
 * app ID and secret. Admins only. A blank secret keeps the saved one. Refused with 409
 * when the screen is out of date (another tab or admin changed the connections since it loaded).
 */
export async function POST(request: NextRequest, { params }: Ctx): Promise<Response> {
  const provider = providerFrom((await params).provider)
  if (!provider) return NextResponse.json({ ok: false, reason: 'not-found' }, { status: 404, headers: NO_STORE })
  try {
    const refusal = adminRequestRefusal(request)
    if (refusal) return NextResponse.json({ ok: false, reason: 'refused' }, { status: 403, headers: NO_STORE })
    const session = await gate(request, { needsSecret: true })
    if ('response' in session) return session.response
    if (await isStale(session.deps.engine, TRACKING_CONNECTIONS_SLUG, expectedVersions(request))) return conflictResponse(NO_STORE)
    const body = (await request.json().catch((): null => null)) as { appId?: unknown; appSecret?: unknown } | null
    const appId = typeof body?.appId === 'string' ? body.appId.trim() : ''
    const appSecret = typeof body?.appSecret === 'string' ? body.appSecret.trim() : ''
    const result = await saveAppCredentials(session.deps, provider, { appId, appSecret: appSecret || null })
    const versions = await currentVersions(session.deps.engine)
    if ('reason' in result) return NextResponse.json({ ok: false, reason: result.reason, versions }, { status: 200, headers: NO_STORE })
    return NextResponse.json({ ok: true, signedOut: result.signedOut, versions }, { headers: NO_STORE })
  } catch (error) {
    console.error('tracking connect app error:', error instanceof Error ? error.name : 'unknown')
    return NextResponse.json({ ok: false, reason: 'error' }, { status: 500, headers: NO_STORE })
  }
}
