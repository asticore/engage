import { NextResponse } from 'next/server'

import { resolveD1Binding } from '@/cms/db/connect'
import { getEngine } from '@/engine'
import { parseSaved } from '@/features/ecommerce/lib/savedForLater'
import { mergeSavedLists, readSaved, writeSaved, type D1Saved } from '@/features/ecommerce/server/savedLines'

export const dynamic = 'force-dynamic'

/**
 * POST { lines, replace? } - for a signed-in shopper: merges the browser's saved lines into the account list, stores the result and
 * returns it. Signed out: { signedIn: false } and nothing is stored.
 */
export async function POST(request: Request): Promise<Response> {
  const engine = await getEngine()
  const { user } = await engine.auth({ headers: request.headers })
  if (!user) return NextResponse.json({ signedIn: false }, { headers: { 'Cache-Control': 'no-store' } })
  const body = (await request.json().catch((): null => null)) as { lines?: unknown; replace?: unknown } | null
  const browser = parseSaved(JSON.stringify(Array.isArray(body?.lines) ? body?.lines : []))
  const d1 = (await resolveD1Binding().catch((): null => null)) as unknown as D1Saved | null
  if (!d1) return NextResponse.json({ signedIn: true, lines: browser }, { headers: { 'Cache-Control': 'no-store' } })
  const userId = Number((user as { id: number }).id)
  try {
    // `replace` is an explicit change (save, move back, delete): the list is stored as sent. Otherwise it is the first load of a page: merge.
    const merged = body?.replace === true ? browser : mergeSavedLists(await readSaved(d1, userId), browser)
    await writeSaved(d1, userId, merged)
    return NextResponse.json({ signedIn: true, lines: merged }, { headers: { 'Cache-Control': 'no-store' } })
  } catch {
    return NextResponse.json({ signedIn: true, lines: browser }, { headers: { 'Cache-Control': 'no-store' } })
  }
}
