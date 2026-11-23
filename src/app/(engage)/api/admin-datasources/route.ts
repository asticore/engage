import { NextResponse } from 'next/server'

import { getAdminContext } from '@/admin/auth'
import { cleanSlug, parseItems } from '@/features/datasources/core'
import { deleteDatasource, dsDb, listDatasources, saveDatasource } from '@/features/datasources/store'

export const dynamic = 'force-dynamic'

/**
 * Shared option lists (Task 15, 34h5). Admin only.
 *   GET                                -> { lists: [{ slug, label, items }] }
 *   POST { action: 'save', slug, label, text }   text: one `Label | value` per line
 *   POST { action: 'delete', slug }
 */
const noStore = { 'Cache-Control': 'no-store' }
const json = (body: unknown, status = 200): Response => NextResponse.json(body, { status, headers: noStore })

export async function GET(): Promise<Response> {
  try {
    const context = await getAdminContext()
    if (!context.user || !context.isAdmin) return json({ error: 'unauthorised' }, 401)
    return json({ lists: await listDatasources(await dsDb()) })
  } catch {
    return json({ error: 'Internal server error' }, 500)
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    const context = await getAdminContext()
    if (!context.user || !context.isAdmin) return json({ error: 'unauthorised' }, 401)
    const body = (await request.json().catch((): null => null)) as Record<string, unknown> | null
    const slug = cleanSlug(body?.slug)
    if (!slug) return json({ ok: false, message: 'Use letters, numbers and dashes for the list name.' }, 400)
    const db = await dsDb()
    if (body?.action === 'delete') {
      await deleteDatasource(db, slug)
      return json({ ok: true })
    }
    if (body?.action === 'save') {
      const label = typeof body.label === 'string' && body.label.trim() ? body.label.trim().slice(0, 100) : slug
      await saveDatasource(db, { slug, label, items: parseItems(body.text) }, new Date().toISOString())
      return json({ ok: true })
    }
    return json({ error: 'unknown action' }, 400)
  } catch {
    return json({ error: 'Internal server error' }, 500)
  }
}
