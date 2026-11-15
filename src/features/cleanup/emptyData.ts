/**
 * Empty a section's data: delete the rows of the section's tables but keep the tables, so a section that is switched
 * on keeps working and starts clean. Works whether the section is on or off. Everything is behind a typed phrase
 * (`empty <section>`), a download of the data is offered first (exportFeatureData), and these are never touched:
 * payment records (kept for accounting), engine bookkeeping, shared content, and a table another section that is on also uses.
 *
 * Pure over `CleanupDb`, so a test can run it against a throwaway database. The server actions (actions.ts) add the admin check and the audit entry.
 */

import { isPaymentRecordTable } from '@/features/featureTables'
import { FEATURES, type FeatureFlags, type FeatureKey } from '@/features/registry'

import type { CleanupDb } from './db'
import { isBookkeepingTable } from './protectedTables'
import { tablesForFeature } from './survey'
import { SHARED_OWNER, assignTables, dropOrder, resolveParents } from './tables'

export const emptyPhraseFor = (feature: string): string => `empty ${feature}`

export type EmptyPlan = {
  ok: boolean
  dryRun: boolean
  feature: string
  /** Tables whose rows would be, or were, deleted, with how many rows they hold. */
  tables: { table: string; rows: number }[]
  emptied: string[]
  /** Tables left alone, with the reason. */
  withheld: { table: string; reason: string }[]
  refusals: string[]
  errors: { table: string; error: string }[]
}

const blank = (feature: string, dryRun: boolean): EmptyPlan => ({ ok: false, dryRun, feature, tables: [], emptied: [], withheld: [], refusals: [], errors: [] })

/** The tables of a section that may be emptied, and those that are kept. */
async function selectTables(db: CleanupDb, flags: FeatureFlags, key: FeatureKey): Promise<{ tables: string[]; withheld: { table: string; reason: string }[] }> {
  const existing = await db.listTables()
  const owned = assignTables(existing, resolveParents(existing))
  const withheld: { table: string; reason: string }[] = []
  const tables: string[] = []
  for (const entry of tablesForFeature(key, owned)) {
    if (isBookkeepingTable(entry.table)) withheld.push({ table: entry.table, reason: 'Engine bookkeeping, never emptied.' })
    else if (entry.owners.includes(SHARED_OWNER)) withheld.push({ table: entry.table, reason: 'Shared content, belongs to no section.' })
    else if (isPaymentRecordTable(entry.table)) withheld.push({ table: entry.table, reason: 'Payment record, kept for accounting.' })
    else if (entry.owners.some((owner) => owner !== key && flags[owner as FeatureKey])) withheld.push({ table: entry.table, reason: 'Also used by a section that is switched on.' })
    else tables.push(entry.table)
  }
  return { tables: dropOrder(tables), withheld }
}

export async function runEmptyFeature(db: CleanupDb, flags: FeatureFlags, request: { feature: string; confirm?: string; execute?: boolean }): Promise<EmptyPlan> {
  const plan = blank(request.feature, request.execute !== true)
  const feature = FEATURES.find((entry) => entry.key === request.feature)
  if (!feature) {
    plan.refusals.push(`No section called "${request.feature}".`)
    return plan
  }
  const { tables, withheld } = await selectTables(db, flags, feature.key)
  plan.withheld = withheld
  for (const table of tables) plan.tables.push({ table, rows: await db.countRows(table).catch((): number => 0) })
  if (plan.tables.length === 0) {
    plan.ok = true
    return plan
  }
  if (plan.dryRun) {
    plan.ok = true
    return plan
  }
  const expected = emptyPhraseFor(feature.key)
  if (request.confirm !== expected) {
    plan.refusals.push(`Type "${expected}" to confirm. Nothing was deleted.`)
    return plan
  }
  // Children first (dropOrder), so a table is never emptied while another still points at its rows.
  for (const { table } of plan.tables) {
    try {
      await db.run(`DELETE FROM \`${table}\``)
      plan.emptied.push(table)
    } catch (error) {
      plan.errors.push({ table, error: error instanceof Error ? error.message : String(error) })
    }
  }
  plan.ok = plan.errors.length === 0
  return plan
}

export const MAX_SECTION_EXPORT_ROWS = 5000

export type SectionExport = { ok: boolean; reason?: string; feature: string; tables: { table: string; rows: number; totalRows: number; truncated: boolean }[]; json: string }

/** Every row of the tables that would be emptied, as one JSON file (up to 5000 rows a table), for the download offered first. */
export async function exportFeatureData(db: CleanupDb, flags: FeatureFlags, feature: string): Promise<SectionExport> {
  const found = FEATURES.find((entry) => entry.key === feature)
  if (!found) return { ok: false, reason: 'unknown', feature, tables: [], json: '' }
  const { tables } = await selectTables(db, flags, found.key)
  const out: SectionExport['tables'] = []
  const data: Record<string, unknown[]> = {}
  for (const table of tables) {
    const totalRows = await db.countRows(table).catch((): number => 0)
    const rows = totalRows === 0 ? [] : await db.all(`SELECT * FROM \`${table}\` LIMIT ${MAX_SECTION_EXPORT_ROWS}`)
    data[table] = rows
    out.push({ table, rows: rows.length, totalRows, truncated: totalRows > rows.length })
  }
  return { ok: true, feature, tables: out, json: JSON.stringify({ section: feature, exportedAt: new Date().toISOString(), tables: out, data }, null, 2) }
}
