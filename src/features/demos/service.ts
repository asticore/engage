import type { Engine } from '@/engine'
import { applyImport } from '@/features/settingsTransfer/import'
import { renderExport } from '@/features/settingsTransfer/export'

import { DEMO_EXPORT_OPTIONS, DEMO_IMPORT_SECTIONS, MAX_SNAPSHOT_BYTES, RESET_CLEAN_COLLECTIONS, demoPassword, describeBytes, idsAddedAfterCopy, isEmail, isResetDue } from './core'
import { copyPictures, restorePictures } from './pictures'
import * as store from './store'

export type SnapshotResult = { ok: true; size: number; pictures: number } | { ok: false; error: string }

/** Saves the site as it is now as the demo copy that a reset returns to. */
export async function takeSnapshot(engine: Engine, d1: store.D1, now: Date): Promise<SnapshotResult> {
  const { body } = await renderExport(engine, DEMO_EXPORT_OPTIONS)
  if (body.length > MAX_SNAPSHOT_BYTES) {
    return { ok: false, error: `The demo is ${describeBytes(body.length)}, over the ${describeBytes(MAX_SNAPSHOT_BYTES)} a saved copy can hold. Remove some content or download the package instead.` }
  }
  const pictures = await copyPictures(engine)
  await store.saveSnapshot(d1, body, now.toISOString())
  return { ok: true, size: body.length, pictures: pictures.copied }
}

export type ResetResult = { ok: boolean; message: string }

/** Deletes pages, posts and products that are not in the saved copy (matched by slug). A section the copy lacks is left alone. */
export async function removeAddedContent(engine: Engine, snapshot: { content?: Record<string, unknown> }): Promise<{ removed: number; errors: number }> {
  let removed = 0
  let errors = 0
  for (const { collection, section } of RESET_CLEAN_COLLECTIONS) {
    const saved = snapshot.content?.[section]
    if (!Array.isArray(saved)) continue
    const keep = new Set(saved.map((item) => (item as { slug?: unknown }).slug).filter((v): v is string => typeof v === 'string'))
    const found = await engine.find({ collection, limit: 1000, depth: 0, overrideAccess: true } as never)
    for (const id of idsAddedAfterCopy((found.docs ?? []) as { id: number | string; slug?: unknown }[], keep)) {
      try {
        await engine.delete({ collection, id, overrideAccess: true } as never)
        removed += 1
      } catch {
        errors += 1
      }
    }
  }
  return { removed, errors }
}

/**
 * Puts the demo back to the saved copy: settings, pages, posts, products and the rest are written back from it, then
 * pages, posts and products added after the copy was taken are deleted (matched by slug).
 */
export async function resetFromSnapshot(engine: Engine, d1: store.D1, now: Date): Promise<ResetResult> {
  const body = await store.snapshotBody(d1)
  if (!body) return { ok: false, message: 'No demo copy is saved yet. Save one first.' }
  let result: ResetResult
  try {
    const saved = JSON.parse(body) as { content?: Record<string, unknown> }
    // Pictures first, so the import finds each one by file name and picture ids in settings point at the right file.
    const pictures = await restorePictures(engine, (saved.content?.mediaMetadata as { filename?: unknown; alt?: unknown }[] | undefined) ?? [])
    const report = await applyImport(engine, saved, { sections: [...DEMO_IMPORT_SECTIONS] })
    const cleaned = await removeAddedContent(engine, saved)
    const errors = report.sections.reduce((n, s) => n + s.errors, 0) + cleaned.errors + pictures.failed
    const updated = report.sections.reduce((n, s) => n + s.updated + s.created, 0)
    const tail = `${updated} item(s) restored, ${cleaned.removed} added item(s) deleted, ${pictures.restored} picture(s) put back, ${pictures.removed} added picture(s) deleted.`
    result = errors > 0 ? { ok: false, message: `Reset finished with ${errors} error(s); ${tail}` } : { ok: true, message: `Reset done; ${tail}` }
  } catch (error) {
    result = { ok: false, message: `Reset failed: ${error instanceof Error ? error.message : String(error)}`.slice(0, 300) }
  }
  await store.markReset(d1, result.message, now.toISOString())
  return result
}

/** The cron job: resets when the chosen schedule says it is due. Returns what happened. */
export async function runScheduledReset(engine: Engine, d1: store.D1, now: Date): Promise<string> {
  const settings = await store.getSettings(d1)
  if (!isResetDue(settings.resetEvery, settings.lastResetAt, now)) return 'not due'
  return (await resetFromSnapshot(engine, d1, now)).message
}

/** Makes a view-only (viewer role) account for a client to look around the demo. Returns the one-time password. */
export async function createDemoAccount(engine: Engine, email: string, host: string): Promise<{ ok: true; password: string } | { ok: false; error: string }> {
  const address = email.trim().toLowerCase()
  if (!isEmail(address)) return { ok: false, error: 'Enter a valid email address.' }
  const existing = await engine.find({ collection: 'users', overrideAccess: true, limit: 1, depth: 0, where: { email: { equals: address } } })
  if (existing.totalDocs > 0) return { ok: false, error: 'An account with that email already exists.' }
  const password = demoPassword()
  try {
    await engine.create({ collection: 'users', overrideAccess: true, data: { email: address, password, roles: ['viewer'], ...(host ? { allowedDomains: host } : {}) } as never })
  } catch (error) {
    return { ok: false, error: `Could not create the account: ${error instanceof Error ? error.message : String(error)}`.slice(0, 300) }
  }
  return { ok: true, password }
}
