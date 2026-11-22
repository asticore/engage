import type { BulkDefaults } from './plan'
import { creationOrder, cycleRefs, planBulk, type BulkCreateCollection, type BulkInputRow, type ExistingDocs, type PlannedRow } from './plan'

type Doc = Record<string, unknown>
export type BulkEngine = {
  find: (a: Record<string, unknown>) => Promise<{ docs: Doc[] }>
  create: (a: Record<string, unknown>) => Promise<Doc>
  delete: (a: Record<string, unknown>) => Promise<unknown>
}

/** How long after creating a draft the batch can still be undone. A published or edited-by-hand-later draft is never undone. */
export const UNDO_WINDOW_MS = 24 * 3_600_000

export async function loadExistingDocs(engine: BulkEngine, collection: BulkCreateCollection): Promise<ExistingDocs> {
  const found = await engine.find({ collection, limit: 5000, depth: 0, pagination: false, overrideAccess: true })
  const existing: ExistingDocs = { slugs: new Set(), pageIds: new Map(), titles: new Set(), templates: new Map() }
  for (const d of found.docs) {
    const slug = typeof d.slug === 'string' ? d.slug : ''
    if (slug) existing.slugs.add(slug)
    if (collection === 'pages' && slug) existing.pageIds.set(slug, Number(d.id))
    if (typeof d.title === 'string') existing.titles.add(d.title.trim().toLowerCase())
  }
  if (collection === 'pages') {
    const templates = await engine.find({ collection: 'page-templates', limit: 500, depth: 0, pagination: false, overrideAccess: true }).catch((): { docs: Doc[] } => ({ docs: [] }))
    for (const t of templates.docs) {
      const name = String(t.title ?? t.name ?? '').trim().toLowerCase()
      if (name) existing.templates.set(name, Number(t.id))
      existing.templates.set(String(t.id), Number(t.id))
    }
  }
  return existing
}

export async function previewBulk(engine: BulkEngine, collection: BulkCreateCollection, rows: BulkInputRow[]): Promise<PlannedRow[]> {
  const planned = planBulk(collection, rows, await loadExistingDocs(engine, collection))
  const cyclic = new Set(cycleRefs(planned))
  for (const p of planned) {
    if (cyclic.has(p.ref)) {
      p.ok = false
      p.problems.push('The parents in this list point at each other.')
    }
  }
  return planned
}

export type BulkCreateResult = { created: { id: number; title: string; slug: string }[]; failed: { ref: string; title: string; message: string }[]; skipped: number }

const errorText = (e: unknown): string => (e instanceof Error ? e.message : 'Could not be saved.')

/** Creates every row without a problem as a draft, parents first. Writes go through the signed-in user's own access rules. */
export async function runBulk(engine: BulkEngine, user: unknown, collection: BulkCreateCollection, rows: BulkInputRow[], options: Pick<BulkDefaults, 'status' | 'locale'> & { defaultLocale?: string } = {}): Promise<BulkCreateResult> {
  const planned = await previewBulk(engine, collection, rows)
  const result: BulkCreateResult = { created: [], failed: [], skipped: planned.filter((p) => !p.ok).length }
  const ids = new Map<string, number>()
  for (const p of creationOrder(planned.filter((x) => x.ok))) {
    const published = collection === 'pages' && options.status === 'published'
    const data: Record<string, unknown> = { title: p.title, slug: p.slug, _status: published ? 'published' : 'draft' }
    const parent = p.batchParent ? ids.get(p.batchParent) : p.parentId
    if (parent) data.parent = parent
    if (p.templateId) data.template = p.templateId
    try {
      const doc = await engine.create({ collection, data, draft: !published, user })
      ids.set(p.slug, Number(doc.id))
      // Titles written in another language are kept as that language's title (the page's own title stays as typed).
      if (options.locale && options.locale !== options.defaultLocale) {
        await engine
          .create({ collection: 'translations', data: { locale: options.locale, sourceKind: 'collection', sourceId: `${collection}:${String(doc.id)}`, fieldPath: 'title', value: p.title, sourceText: p.title }, user })
          .catch((): null => null)
      }
      result.created.push({ id: Number(doc.id), title: p.title, slug: p.slug })
    } catch (error) {
      result.failed.push({ ref: p.ref, title: p.title, message: errorText(error) })
    }
  }
  return result
}

/** Deletes drafts made by a batch. Anything published, or older than the undo window, is kept and reported. */
export async function undoBulk(engine: BulkEngine, user: unknown, collection: BulkCreateCollection, ids: number[], now: Date): Promise<{ removed: number; kept: { id: number; reason: string }[] }> {
  const out: { removed: number; kept: { id: number; reason: string }[] } = { removed: 0, kept: [] }
  // Children first so a parent is never removed from under a child that is being kept.
  for (const id of [...ids].reverse()) {
    try {
      const found = await engine.find({ collection, where: { id: { equals: id } }, limit: 1, depth: 0, draft: true, overrideAccess: true })
      const doc = found.docs[0]
      if (!doc) {
        out.kept.push({ id, reason: 'Already gone.' })
        continue
      }
      if (doc._status === 'published') {
        out.kept.push({ id, reason: 'It has been published.' })
        continue
      }
      const created = Date.parse(String(doc.createdAt ?? ''))
      if (!Number.isFinite(created) || now.getTime() - created > UNDO_WINDOW_MS) {
        out.kept.push({ id, reason: 'It is more than a day old.' })
        continue
      }
      await engine.delete({ collection, id, user })
      out.removed++
    } catch (error) {
      out.kept.push({ id, reason: errorText(error) })
    }
  }
  return out
}
