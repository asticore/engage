import { NextRequest, NextResponse } from 'next/server'

import { adminRequestRefusal } from '@/features/forms/origin'
import { GOOGLE_CONNECTION_SLUG, INTEGRATIONS_SLUG } from '@/features/google/constants'
import { applyPick, parsePickBody } from '@/features/google/picks'
import { conflictResponse, currentVersions, expectedVersions, isStale } from '@/features/integrations/staleTab'
import { gate, NO_STORE } from '@/features/tracking/connect/routeSupport'

export const dynamic = 'force-dynamic'

/**
 * POST /api/tracking-connect/google/pick { kind, value }: saves one Google choice
 * from the Tracking screen. The GA4 measurement ID or GTM container ID replaces
 * the one on Integrations, because the owner chose it here. Refused with 409 when
 * either the Google connection or Integrations changed since the screen loaded.
 */
export async function POST(request: NextRequest): Promise<Response> {
  try {
    const refusal = adminRequestRefusal(request)
    if (refusal) return NextResponse.json({ ok: false, reason: 'refused' }, { status: 403, headers: NO_STORE })
    const session = await gate(request)
    if ('response' in session) return session.response
    const expected = expectedVersions(request)
    if (
      (await isStale(session.deps.engine, GOOGLE_CONNECTION_SLUG, expected)) ||
      (await isStale(session.deps.engine, INTEGRATIONS_SLUG, expected))
    ) {
      return conflictResponse(NO_STORE)
    }
    const input = parsePickBody(await request.json().catch((): null => null))
    if (!input) return NextResponse.json({ ok: false, reason: 'bad-value' }, { status: 400, headers: NO_STORE })
    const result = await applyPick(session.deps.engine, input, { fill: 'replace' })
    const versions = await currentVersions(session.deps.engine)
    if ('error' in result) return NextResponse.json({ ok: false, reason: 'google', message: result.error, versions }, { status: result.status, headers: NO_STORE })
    return NextResponse.json({ ok: true, value: result.value ?? '', versions }, { headers: NO_STORE })
  } catch (error) {
    console.error('tracking connect google pick error:', error instanceof Error ? error.name : 'unknown')
    return NextResponse.json({ ok: false, reason: 'error' }, { status: 500, headers: NO_STORE })
  }
}
