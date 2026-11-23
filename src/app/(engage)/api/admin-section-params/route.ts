import { NextResponse } from 'next/server'

import { getAdminContext, hasAdminPanelAccess } from '@/admin/auth'
import { getEngine } from '@/lib/engine'
import { findParamDecls } from '@/lib/sectionParams'

export const dynamic = 'force-dynamic'

const json = (body: unknown, status = 200): Response => NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } })

/**
 * GET /api/admin-section-params
 *   no query: the reusable sections for a dropdown ({ options: [{ label, value }] }), the ones that declare inputs first.
 *   ?id=N:    the inputs that section declares ({ decls }).
 */
export async function GET(request: Request): Promise<Response> {
  try {
    const context = await getAdminContext()
    if (!hasAdminPanelAccess(context.user)) return json({ error: 'Unauthorised' }, 401)
    const engine = await getEngine()
    const id = new URL(request.url).searchParams.get('id')
    if (id !== null) {
      if (!/^\d{1,12}$/.test(id)) return json({ error: 'Bad request' }, 400)
      const doc = (await engine.findByID({ collection: 'reusable-sections' as never, id: Number(id), depth: 0, overrideAccess: true } as never).catch((): null => null)) as { blocks?: unknown } | null
      return json({ decls: doc ? findParamDecls(doc.blocks) : [] })
    }
    const result = (await engine.find({ collection: 'reusable-sections' as never, sort: 'name', limit: 200, depth: 0, overrideAccess: true } as never)) as unknown as { docs?: { id: number | string; name?: string | null; blocks?: unknown }[] }
    const rows = (result?.docs ?? []).map((doc) => ({ label: doc.name || `Reusable section ${doc.id}`, value: String(doc.id), withInputs: findParamDecls(doc.blocks).length > 0 }))
    rows.sort((a, b) => Number(b.withInputs) - Number(a.withInputs))
    return json({ options: rows.map((row) => ({ label: row.withInputs ? `${row.label} (has inputs)` : row.label, value: row.value })) })
  } catch (error) {
    console.error('admin-section-params GET error:', error)
    return json({ error: 'Internal server error' }, 500)
  }
}
