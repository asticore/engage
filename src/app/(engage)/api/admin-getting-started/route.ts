import { NextResponse } from 'next/server'
import { getAdminContext } from '@/admin/auth'
import { loadListPrefs, saveListPrefs } from '@/admin/list/listPrefs'

export const dynamic = 'force-dynamic'

/**
 * Admin-only getting-started state API.
 * POST JSON {id: string, done: boolean}
 *
 * Stores manual done IDs in preferences collection under the key that load.ts reads.
 * Returns {ok: true} or error.
 */
export async function POST(request: Request): Promise<Response> {
  try {
    const context = await getAdminContext()

    if (!context.isAdmin) {
      return NextResponse.json({ error: 'unauthorised' }, { status: 401 })
    }

    let body: { id?: string; done?: boolean }
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }

    const { id, done } = body

    if (!id || typeof done !== 'boolean') {
      return NextResponse.json({ error: 'Missing id or done' }, { status: 400 })
    }

    // Read the saved ticks through the same helper load.ts uses, so both sides agree on the stored shape.
    const current = await loadListPrefs(context.engine, context.user, 'getting-started')
    let doneIds: string[] = current.doneIds ?? []

    // Update based on done flag
    if (done && !doneIds.includes(id)) {
      doneIds.push(id)
    } else if (!done) {
      doneIds = doneIds.filter((x) => x !== id)
    }

    // Save back to preferences using same structure and key
    await saveListPrefs(context.engine, context.user, 'getting-started', {
      doneIds,
    })

    return NextResponse.json({ ok: true }, { status: 200 })
  } catch (error) {
    console.error('admin-getting-started POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
