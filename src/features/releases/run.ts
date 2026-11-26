import type { Engine } from '@/engine'

import { dueReleases, undoTarget, type ReleaseItem } from './core'
import { listReleases, recordBefore, setStatus, type RelD1, type Release } from './store'

/** Publishes and undoes releases. Drafts are published through the engine, so the usual publish hooks run. */

type Eng = Pick<Engine, 'findByID' | 'update'>
export type RunResult = { ok: boolean; published: number; failed: string[] }

async function setDocStatus(engine: Eng, item: Pick<ReleaseItem, 'collection' | 'docId'>, status: 'draft' | 'published'): Promise<void> {
  await engine.update({ collection: item.collection, id: item.docId, data: { _status: status }, overrideAccess: true } as never)
}

/** Publishes every item. If any item fails, items already published by this run are put back, so a release is all or nothing. */
export async function publishRelease(engine: Eng, db: RelD1, release: Release, nowIso: string): Promise<RunResult> {
  const done: ReleaseItem[] = []
  const failed: string[] = []
  for (const item of release.items) {
    try {
      const doc = (await engine.findByID({ collection: item.collection, id: item.docId, overrideAccess: true } as never)) as { _status?: string } | null
      if (!doc) throw new Error('not found')
      const before = doc._status === 'published' ? 'published' : 'draft'
      await recordBefore(db, release.id, item.collection, item.docId, before)
      if (before === 'draft') await setDocStatus(engine, item, 'published')
      done.push({ ...item, before })
    } catch (error) {
      failed.push(`${item.collection} ${item.docId}: ${error instanceof Error ? error.message : 'failed'}`)
      break
    }
  }
  if (failed.length) {
    for (const item of done) await setDocStatus(engine, item, undoTarget(item)).catch((): null => null)
    await setStatus(db, release.id, 'open', nowIso, `Not published: ${failed[0]}. Nothing was changed.`)
    return { ok: false, published: 0, failed }
  }
  await setStatus(db, release.id, 'published', nowIso, null)
  return { ok: true, published: done.length, failed: [] }
}

/** Puts every item back as it was before the release. */
export async function undoRelease(engine: Eng, db: RelD1, release: Release, nowIso: string): Promise<RunResult> {
  const failed: string[] = []
  for (const item of release.items) {
    try {
      await setDocStatus(engine, item, undoTarget(item))
    } catch (error) {
      failed.push(`${item.collection} ${item.docId}: ${error instanceof Error ? error.message : 'failed'}`)
    }
  }
  await setStatus(db, release.id, failed.length ? 'published' : 'undone', nowIso, failed.length ? `Undo incomplete: ${failed[0]}` : null)
  return { ok: failed.length === 0, published: release.items.length - failed.length, failed }
}

/** The five-minute job: publishes each open release whose time has come. */
export async function runDueReleases(engine: Eng, db: RelD1, nowIso: string): Promise<number> {
  const due = dueReleases(await listReleases(db), nowIso)
  let n = 0
  for (const r of due) if ((await publishRelease(engine, db, r, nowIso)).ok) n++
  return n
}
