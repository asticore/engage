/**
 * Legacy block report, bulk conversion and undo (Task 13 / 32b). Reads and writes through the engine, so it works on
 * D1 in production and on the local database in tests. The old value of every changed document is saved first, in a
 * backup file keyed by batch, which is what undo restores.
 */

import { addCounts, convertLegacyTree, countLegacy, totalOf, type LegacyCounts } from './convertTree'

type Rec = Record<string, unknown>
type Engine = {
  find: (args: Rec) => Promise<{ docs?: Rec[]; totalPages?: number; hasNextPage?: boolean }>
  update: (args: Rec) => Promise<unknown>
}

export const LEGACY_SURFACES = [
  { collection: 'pages', field: 'blocks', label: 'Pages' },
  { collection: 'posts', field: 'layout', label: 'Posts' },
  { collection: 'products', field: 'layout', label: 'Products' },
  { collection: 'page-templates', field: 'blocks', label: 'Page templates' },
  { collection: 'site-templates', field: 'blocks', label: 'Templates' },
  { collection: 'reusable-sections', field: 'blocks', label: 'Reusable sections' },
] as const

export type Surface = (typeof LEGACY_SURFACES)[number]

/** Where backups live: an R2 bucket in production, a Map in tests. */
export type BackupStore = {
  put: (key: string, text: string) => Promise<void>
  get: (key: string) => Promise<string | null>
}

export type DocLegacy = { collection: string; id: string | number; title: string; counts: LegacyCounts }
export type SurfaceReport = { collection: string; label: string; documents: number; withLegacy: number; counts: LegacyCounts; error?: string }
export type ScanReport = { totals: LegacyCounts; total: number; surfaces: SurfaceReport[]; documents: DocLegacy[]; truncated: boolean }

const PAGE_SIZE = 50
const MAX_PAGES = 200
const MAX_LISTED = 300

const titleOf = (doc: Rec): string => {
  for (const key of ['title', 'name', 'slug']) {
    const v = doc[key]
    if (typeof v === 'string' && v.trim()) return v.trim().slice(0, 120)
  }
  return `#${String(doc.id)}`
}

/** Every document of a surface, one page at a time. A failing surface (feature off, table missing) is reported, never thrown. */
async function* eachDoc(engine: Engine, surface: Surface): AsyncGenerator<Rec> {
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const result = await engine.find({ collection: surface.collection, limit: PAGE_SIZE, page, depth: 0, overrideAccess: true, pagination: true })
    const docs = Array.isArray(result?.docs) ? result.docs : []
    for (const doc of docs) yield doc
    if (docs.length < PAGE_SIZE || result?.hasNextPage === false) return
  }
}

/** Read-only: how many documents and legacy blocks each surface holds. Changes nothing. */
export async function scanLegacyBlocks(engine: Engine): Promise<ScanReport> {
  const totals: LegacyCounts = {}
  const surfaces: SurfaceReport[] = []
  const documents: DocLegacy[] = []
  let truncated = false
  for (const surface of LEGACY_SURFACES) {
    const report: SurfaceReport = { collection: surface.collection, label: surface.label, documents: 0, withLegacy: 0, counts: {} }
    try {
      for await (const doc of eachDoc(engine, surface)) {
        report.documents += 1
        const counts = countLegacy(doc[surface.field])
        if (totalOf(counts) === 0) continue
        report.withLegacy += 1
        addCounts(report.counts, counts)
        addCounts(totals, counts)
        if (documents.length < MAX_LISTED) documents.push({ collection: surface.collection, id: doc.id as string | number, title: titleOf(doc), counts })
        else truncated = true
      }
    } catch (error) {
      report.error = error instanceof Error ? error.message.slice(0, 200) : 'Could not be read.'
    }
    surfaces.push(report)
  }
  return { totals, total: totalOf(totals), surfaces, documents, truncated }
}

export type ConvertEntry = {
  collection: string
  id: string | number
  title: string
  status: 'converted' | 'would-convert' | 'skipped' | 'error'
  converted: LegacyCounts
  skipped: number
  error?: string
}
export type ConvertReport = { batchId: string | null; dryRun: boolean; entries: ConvertEntry[]; converted: LegacyCounts; total: number; errors: number }

export type ConvertRequest = { execute?: boolean; collection?: string; id?: string | number; batchId?: string }

type BackupFile = { batchId: string; createdAt: string; entries: { collection: string; id: string | number; field: string; before: unknown }[] }

const backupKey = (batchId: string): string => `legacy-block-backups/${batchId}.json`
const BATCH_RE = /^[0-9]{8}T[0-9]{6}Z-[a-z0-9]{4,12}$/

export const newBatchId = (now = new Date(), rand = Math.random().toString(36).slice(2, 8)): string =>
  `${now.toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z')}-${rand.padEnd(4, '0')}`

/**
 * Converts the legacy blocks of every document (or one surface, or one document). Without `execute` it only reports
 * what would change. With it, each changed document's old value is written to the backup first; if the backup cannot
 * be saved nothing is changed.
 */
export async function convertLegacyDocuments(engine: Engine, store: BackupStore, request: ConvertRequest, user?: unknown, now = new Date()): Promise<ConvertReport> {
  const dryRun = request.execute !== true
  const batchId = dryRun ? null : newBatchId(now)
  const entries: ConvertEntry[] = []
  const converted: LegacyCounts = {}
  const backup: BackupFile = { batchId: batchId ?? '', createdAt: now.toISOString(), entries: [] }
  const pending: { surface: Surface; doc: Rec; blocks: unknown; entry: ConvertEntry }[] = []

  for (const surface of LEGACY_SURFACES) {
    if (request.collection && request.collection !== surface.collection) continue
    try {
      for await (const doc of eachDoc(engine, surface)) {
        if (request.id !== undefined && String(request.id) !== String(doc.id)) continue
        if (totalOf(countLegacy(doc[surface.field])) === 0) continue
        const result = convertLegacyTree(doc[surface.field])
        const entry: ConvertEntry = {
          collection: surface.collection,
          id: doc.id as string | number,
          title: titleOf(doc),
          status: result.changed ? (dryRun ? 'would-convert' : 'converted') : 'skipped',
          converted: result.converted,
          skipped: result.skipped,
        }
        entries.push(entry)
        if (result.changed) pending.push({ surface, doc, blocks: result.blocks, entry })
      }
    } catch (error) {
      entries.push({ collection: surface.collection, id: '', title: surface.label, status: 'error', converted: {}, skipped: 0, error: error instanceof Error ? error.message.slice(0, 200) : 'Could not be read.' })
    }
  }

  if (!dryRun && pending.length > 0) {
    for (const item of pending) backup.entries.push({ collection: item.surface.collection, id: item.doc.id as string | number, field: item.surface.field, before: item.doc[item.surface.field] })
    try {
      await store.put(backupKey(batchId as string), JSON.stringify(backup))
    } catch {
      for (const item of pending) {
        item.entry.status = 'error'
        item.entry.error = 'The backup could not be saved, so nothing was changed.'
      }
      return finish(batchId, dryRun, entries, {})
    }
    for (const item of pending) {
      try {
        await engine.update({ collection: item.surface.collection, id: item.doc.id, data: { [item.surface.field]: item.blocks }, user, overrideAccess: true })
        addCounts(converted, item.entry.converted)
      } catch (error) {
        item.entry.status = 'error'
        item.entry.error = error instanceof Error ? error.message.slice(0, 200) : 'Could not be saved.'
      }
    }
    return finish(batchId, dryRun, entries, converted)
  }

  for (const item of pending) addCounts(converted, item.entry.converted)
  return finish(batchId, dryRun, entries, converted)
}

function finish(batchId: string | null, dryRun: boolean, entries: ConvertEntry[], converted: LegacyCounts): ConvertReport {
  return { batchId, dryRun, entries, converted, total: totalOf(converted), errors: entries.filter((e) => e.status === 'error').length }
}

export type UndoReport = { ok: boolean; restored: number; errors: { collection: string; id: string | number; error: string }[]; reason?: string }

/** Puts back the saved old value of every document in a batch. A document edited since is restored too, so check the report first. */
export async function undoLegacyBatch(engine: Engine, store: BackupStore, batchId: string, user?: unknown): Promise<UndoReport> {
  if (!BATCH_RE.test(batchId)) return { ok: false, restored: 0, errors: [], reason: 'That is not a batch id.' }
  const text = await store.get(backupKey(batchId)).catch((): null => null)
  if (!text) return { ok: false, restored: 0, errors: [], reason: 'No backup was found for that batch.' }
  let file: BackupFile
  try {
    file = JSON.parse(text) as BackupFile
  } catch {
    return { ok: false, restored: 0, errors: [], reason: 'The backup file is damaged.' }
  }
  const allowed = new Map<string, string>(LEGACY_SURFACES.map((s) => [s.collection, s.field]))
  let restored = 0
  const errors: UndoReport['errors'] = []
  for (const entry of Array.isArray(file.entries) ? file.entries : []) {
    if (allowed.get(entry.collection) !== entry.field) {
      errors.push({ collection: String(entry.collection), id: entry.id, error: 'Not a place this tool restores.' })
      continue
    }
    try {
      await engine.update({ collection: entry.collection, id: entry.id, data: { [entry.field]: entry.before }, user, overrideAccess: true })
      restored += 1
    } catch (error) {
      errors.push({ collection: entry.collection, id: entry.id, error: error instanceof Error ? error.message.slice(0, 200) : 'Could not be restored.' })
    }
  }
  return { ok: errors.length === 0, restored, errors }
}
