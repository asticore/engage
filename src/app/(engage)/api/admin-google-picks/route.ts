import { NextRequest, NextResponse } from 'next/server'

import { getAdminContext } from '@/admin/auth'
import { adminRequestRefusal } from '@/features/forms/origin'
import { getEngine } from '@/lib/engine'
import { GOOGLE_CONNECTION_SLUG, INTEGRATIONS_SLUG } from '@/features/google/constants'
import { applyPick, parsePickBody } from '@/features/google/picks'
import { conflictResponse, currentVersions, expectedVersions, isStale } from '@/features/integrations/staleTab'

export const dynamic = 'force-dynamic'

const NO_STORE = { 'Cache-Control': 'no-store' }

/**
 * POST /api/admin-google-picks { kind, value }: saves one dropdown choice after
 * checking it against Google's own list. Admins only.
 */
export async function POST(request: NextRequest): Promise<Response> {
  try {
    const refusal = adminRequestRefusal(request)
    if (refusal) return NextResponse.json({ ok: false, error: refusal }, { status: 403, headers: NO_STORE })

    const context = await getAdminContext()
    if (!context.user || !context.isAdmin) return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403, headers: NO_STORE })

    const input = parsePickBody(await request.json().catch((): null => null))
    if (!input) return NextResponse.json({ ok: false, error: 'Choose a value from the list.' }, { status: 400, headers: NO_STORE })

    const engine = await getEngine()
    const expected = expectedVersions(request)
    if (
      (await isStale(engine, GOOGLE_CONNECTION_SLUG, expected)) ||
      (await isStale(engine, INTEGRATIONS_SLUG, expected))
    ) {
      return conflictResponse(NO_STORE)
    }
    const result = await applyPick(engine, input)
    const versions = await currentVersions(engine)
    if ('error' in result) return NextResponse.json({ ok: false, error: result.error, versions }, { status: result.status, headers: NO_STORE })
    return NextResponse.json({ ok: true, message: result.message, notes: result.notes, versions }, { headers: NO_STORE })
  } catch (error) {
    console.error('admin-google-picks error:', error instanceof Error ? error.name : 'unknown')
    return NextResponse.json({ ok: false, error: 'The choice could not be saved. Try again.' }, { status: 500, headers: NO_STORE })
  }
}
