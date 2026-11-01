import { NextRequest, NextResponse } from 'next/server'

import { adminRequestRefusal } from '@/features/forms/origin'
import { conflictResponse, currentVersions, expectedVersions, isStale } from '@/features/integrations/staleTab'
import { gate, providerFrom, NO_STORE } from '@/features/tracking/connect/routeSupport'
import { pickPixel } from '@/features/tracking/connect/service'
import { INTEGRATIONS_SLUG } from '@/features/google/constants'

export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ provider: string }> }

/**
 * POST /api/tracking-connect/[provider]/pick { value }: saves one listed pixel as the Integrations pixel ID.
 * Writes Integrations, so it is refused with 409 when Integrations changed since the screen loaded it.
 */
export async function POST(request: NextRequest, { params }: Ctx): Promise<Response> {
  const provider = providerFrom((await params).provider)
  if (!provider) return NextResponse.json({ ok: false, reason: 'not-found' }, { status: 404, headers: NO_STORE })
  try {
    const refusal = adminRequestRefusal(request)
    if (refusal) return NextResponse.json({ ok: false, reason: 'refused' }, { status: 403, headers: NO_STORE })
    const session = await gate(request)
    if ('response' in session) return session.response
    if (await isStale(session.deps.engine, INTEGRATIONS_SLUG, expectedVersions(request))) return conflictResponse(NO_STORE)
    const body = (await request.json().catch((): null => null)) as { value?: unknown } | null
    const value = typeof body?.value === 'string' ? body.value.trim() : ''
    const result = await pickPixel(session.deps, provider, value)
    const versions = await currentVersions(session.deps.engine)
    if ('reason' in result) return NextResponse.json({ ok: false, reason: result.reason, versions }, { status: 200, headers: NO_STORE })
    return NextResponse.json({ ok: true, pixelId: result.pixelId, previous: result.previous, replaced: result.replaced, versions }, { headers: NO_STORE })
  } catch (error) {
    console.error('tracking connect pick error:', error instanceof Error ? error.name : 'unknown')
    return NextResponse.json({ ok: false, reason: 'error' }, { status: 500, headers: NO_STORE })
  }
}
