import { NextResponse } from 'next/server'

import { getAdminContext, hasAdminPanelAccess } from '@/admin/auth'
import { adminRequestRefusal } from '@/features/forms/origin'
import { KIND_LABELS } from '@/features/siteTemplates/kinds'
import { archiveFilterSection, loopCardBlocks, loopGridSection, parseLoopRequest, placeLoopOnArchive } from '@/features/siteTemplates/loops'
import { getStarter } from '@/features/siteTemplates/starters'
import type { SectionNode } from '@/lib/sectionTree'

export const dynamic = 'force-dynamic'

const json = (body: unknown, status = 200): Response => NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } })

type Doc = { id: number | string; enabled?: boolean | null; priority?: number | null; blocks?: unknown }

/**
 * POST /api/admin-loops { name, source, category, tag, author, type, orderBy, count, columns, placeOn: ['archive-blog','archive-shop'] }
 *
 * Makes a named loop: a loop item template (the card, switched ON so a Loop grid can use it) and, for each archive in
 * `placeOn`, a Loop grid with the chosen query on that archive's template (the one in use, or a new switched-off draft
 * when the site has none). Returns the editor links. The same loop can be placed on both archives.
 */
export async function POST(request: Request): Promise<Response> {
  try {
    const refusal = adminRequestRefusal(request as never)
    if (refusal) return json({ ok: false, error: refusal }, 403)
    const context = await getAdminContext()
    if (!hasAdminPanelAccess(context.user)) return json({ ok: false, error: 'Unauthorised' }, 401)
    if (!(context.isAdmin || (context.can('site-templates', 'create') && context.can('site-templates', 'update')))) return json({ ok: false, error: 'Forbidden' }, 403)

    const parsed = parseLoopRequest(await request.json().catch((): null => null))
    if (!parsed.ok) return json({ ok: false, error: (parsed as { error: string }).error }, 400)
    const req = (parsed as { value: import('@/features/siteTemplates/loops').LoopRequest }).value

    const loop = (await context.engine.create({
      collection: 'site-templates',
      data: { name: req.name, kind: 'loop', enabled: true, conditions: [], blocks: loopCardBlocks(req.source) },
      overrideAccess: true,
    } as never)) as { id: number | string }
    const editor = (id: number | string) => `/admin/visual-editor/collection/site-templates/${id}`
    const placed: Array<{ kind: string; label: string; id: number | string; created: boolean; replaced: boolean; already: boolean; editorUrl: string }> = []

    for (const kind of req.placeOn) {
      const found = (await context.engine.find({ collection: 'site-templates', where: { kind: { equals: kind } }, depth: 0, limit: 50, overrideAccess: true } as never)) as { docs?: Doc[] }
      const inUse = (found.docs ?? [])
        .filter((doc) => doc.enabled !== false && Array.isArray(doc.blocks) && doc.blocks.length > 0)
        .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0))[0]
      const grid = [archiveFilterSection(req.source), loopGridSection(loop.id, req)]
      if (inUse) {
        const result = placeLoopOnArchive(inUse.blocks as SectionNode[], grid)
        if (!result.already) await context.engine.update({ collection: 'site-templates', id: inUse.id, data: { blocks: result.blocks }, overrideAccess: true } as never)
        placed.push({ kind, label: KIND_LABELS[kind], id: inUse.id, created: false, replaced: result.replaced, already: result.already, editorUrl: editor(inUse.id) })
      } else {
        const starter = getStarter(kind === 'archive-blog' ? 'archive-blog-simple' : 'archive-shop-simple')
        const result = placeLoopOnArchive((starter?.blocks() ?? []) as SectionNode[], grid)
        const doc = (await context.engine.create({
          collection: 'site-templates',
          data: { name: `${KIND_LABELS[kind]} with ${req.name} (draft)`, kind, enabled: false, conditions: [], blocks: result.blocks },
          overrideAccess: true,
        } as never)) as { id: number | string }
        placed.push({ kind, label: KIND_LABELS[kind], id: doc.id, created: true, replaced: result.replaced, already: false, editorUrl: editor(doc.id) })
      }
    }
    return json({ ok: true, loop: { id: loop.id, editorUrl: editor(loop.id) }, placed })
  } catch (error) {
    console.error('admin-loops POST error:', error instanceof Error ? error.name : 'unknown')
    return json({ ok: false, error: 'The loop could not be created.' }, 500)
  }
}
