import type { Engine } from '@/engine'
import { applyImport } from '@/features/settingsTransfer/import'
import { renderExport } from '@/features/settingsTransfer/export'

import { DEMO_EXPORT_OPTIONS, DEMO_IMPORT_SECTIONS, MAX_SNAPSHOT_BYTES, demoPassword, describeBytes, isEmail, isResetDue } from './core'
import * as store from './store'

export type SnapshotResult = { ok: true; size: number } | { ok: false; error: string }

/** Saves the site as it is now as the demo copy that a reset returns to. */
export async function takeSnapshot(engine: Engine, d1: store.D1, now: Date): Promise<SnapshotResult> {
  const { body } = await renderExport(engine, DEMO_EXPORT_OPTIONS)
  if (body.length > MAX_SNAPSHOT_BYTES) {
    return { ok: false, error: `The demo is ${describeBytes(body.length)}, over the ${describeBytes(MAX_SNAPSHOT_BYTES)} a saved copy can hold. Remove some content or download the package instead.` }
  }
  await store.saveSnapshot(d1, body, now.toISOString())
  return { ok: true, size: body.length }
}

export type ResetResult = { ok: boolean; message: string }

/**
 * Puts the demo back to the saved copy: settings, pages, posts, products and the rest are written back from it.
 * Items added after the copy was taken are left alone (an import adds and updates, it does not delete).
 */
export async function resetFromSnapshot(engine: Engine, d1: store.D1, now: Date): Promise<ResetResult> {
  const body = await store.snapshotBody(d1)
  if (!body) return { ok: false, message: 'No demo copy is saved yet. Save one first.' }
  let result: ResetResult
  try {
    const report = await applyImport(engine, JSON.parse(body), { sections: [...DEMO_IMPORT_SECTIONS] })
    const errors = report.sections.reduce((n, s) => n + s.errors, 0)
    const updated = report.sections.reduce((n, s) => n + s.updated + s.created, 0)
    result = errors > 0 ? { ok: false, message: `Reset finished with ${errors} error(s); ${updated} item(s) restored.` } : { ok: true, message: `Reset done; ${updated} item(s) restored.` }
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
