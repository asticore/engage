'use server'

/**
 * What the admin screen's buttons call.
 *
 * The routes next door want the internal key as well as a session, which the
 * browser cannot supply - the key is a deploy secret and handing it to the
 * page would publish it to anyone who opens the console. So the screen goes
 * through server actions instead: same core, same guardrails, with the admin
 * session as the boundary. The routes stay for operators and the deploy
 * pipeline, which can hold a secret.
 */

import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'

import { getFeatureFlags } from '@/utilities/features'

import { runCleanup, type CleanupPlan, type CleanupRequest } from './cleanup'
import { exportFeatureData, runEmptyFeature, type EmptyPlan, type SectionExport } from './emptyData'
import { getCleanupDb, hasAdminSession } from './guard'
import { tidyIndexNames, type IndexTidyReport } from './indexNames'

const NO_DB = 'No database binding is available in this environment.'

const refused = (feature: string, dryRun: boolean, reason: string): CleanupPlan => ({
  ok: false,
  dryRun,
  feature,
  tables: [],
  statements: [],
  dropped: [],
  refusals: [reason],
  withheld: [],
  errors: [],
})

export async function cleanupFeatureAction(request: CleanupRequest): Promise<CleanupPlan> {
  const dryRun = request.execute !== true

  if (!(await hasAdminSession(await headers()))) {
    return refused(request.feature, dryRun, 'Not permitted.')
  }

  const db = await getCleanupDb()
  if (!db) return refused(request.feature, dryRun, NO_DB)

  const result = await runCleanup(db, await getFeatureFlags(), request)

  // A completed drop changes every count on the screen behind it.
  if (!result.dryRun && result.dropped.length > 0) revalidatePath('/admin/database')

  return result
}

export async function tidyIndexNamesAction(execute: boolean): Promise<IndexTidyReport> {
  const empty: IndexTidyReport = {
    ok: false,
    dryRun: !execute,
    renames: [],
    renamed: [],
    skipped: 0,
    errors: [],
  }

  if (!(await hasAdminSession(await headers()))) {
    return { ...empty, errors: [{ statement: '', error: 'Not permitted.' }] }
  }

  const db = await getCleanupDb()
  if (!db) return { ...empty, errors: [{ statement: '', error: NO_DB }] }

  const report = await tidyIndexNames(db, execute)
  if (execute && report.renamed.length > 0) revalidatePath('/admin/database')
  return report
}

/** Download offer before emptying a section: its rows as JSON. Admin only; changes nothing. */
export async function exportSectionAction(feature: string): Promise<SectionExport> {
  const none: SectionExport = { ok: false, reason: 'not-permitted', feature, tables: [], json: '' }
  if (!(await hasAdminSession(await headers()))) return none
  const db = await getCleanupDb()
  if (!db) return { ...none, reason: 'no-database' }
  return exportFeatureData(db, await getFeatureFlags(), feature)
}

/** Empties a section's data (rows only, tables stay). Plans unless execute is set; the typed phrase is checked again here. Always audited. */
export async function emptySectionAction(request: { feature: string; confirm?: string; execute?: boolean }): Promise<EmptyPlan> {
  const dryRun = request.execute !== true
  const refuse = (reason: string): EmptyPlan => ({ ok: false, dryRun, feature: request.feature, tables: [], emptied: [], withheld: [], refusals: [reason], errors: [] })
  if (!(await hasAdminSession(await headers()))) return refuse('Not permitted.')
  const db = await getCleanupDb()
  if (!db) return refuse(NO_DB)
  const result = await runEmptyFeature(db, await getFeatureFlags(), request)
  if (!result.dryRun && result.emptied.length > 0) {
    try {
      const { getEngine } = await import('@/lib/engine')
      const { headers: nextHeaders } = await import('next/headers')
      const { recordAuditEvent } = await import('@/features/security/auditLog')
      const { getSecuritySettings } = await import('@/features/security/settings')
      const engine = await getEngine()
      const { user } = await engine.auth({ headers: await nextHeaders() })
      const who = user as { id?: number | string; email?: string } | null
      const settings = await getSecuritySettings(engine as unknown as Parameters<typeof getSecuritySettings>[0])
      await recordAuditEvent(
        { action: 'database.section-emptied', actorId: who?.id ?? null, actorEmail: who?.email ?? null, detail: `emptied ${result.emptied.length} table${result.emptied.length === 1 ? '' : 's'} of ${request.feature}` },
        { ...settings, featureEnabled: true, auditLog: { ...settings.auditLog, enabled: true } },
      )
    } catch {
      // The delete already happened; the audit write is best effort here and logged by auditLog.
    }
    revalidatePath('/admin/database')
  }
  return result
}
