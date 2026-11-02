/**
 * The Unused tables tool: tables that belong to a feature that is switched
 * off, one by one, with the guards that make a single DROP safe to offer.
 *
 * The older whole-feature cleanup (cleanup.ts) stays for operators; this is the
 * careful per-table version for the admin screen. Pure over `CleanupDb`, so a
 * test can run it against a throwaway database.
 *
 * A table can be listed, exported and deleted only when ALL of these hold:
 *   - it exists and is not engine bookkeeping or an internal SQLite table;
 *   - it is not core (core tables and every settings page table are never offered);
 *   - it belongs to a feature, and that feature is switched OFF right now;
 *   - it is not a payment record (orders, refunds, transactions, gift cards,
 *     store credit and the like are kept whatever the settings say);
 *   - for a delete, the typed confirmation equals the table name exactly.
 */

import { isCoreTable, isPaymentRecordTable, ownerOfTable } from '@/features/featureTables'
import { FEATURE_MAP, type FeatureFlags, type FeatureKey } from '@/features/registry'

import type { CleanupDb } from './db'
import { isBookkeepingTable } from './protectedTables'
import { surveySizes } from './size'

export type UnusedTable = {
  table: string
  feature: FeatureKey
  featureLabel: string
  rows: number
  /** Estimated unless the database measures it (see size.ts). */
  bytes: number
  /** Payment records are listed so nobody wonders where they are, but cannot be deleted. */
  paymentRecord: boolean
}

export type UnusedTablesReport = {
  tables: UnusedTable[]
  sizesAreExact: boolean
  sizeNote: string
}

/** Why a table cannot be touched, or null when it can. Never throws. */
export function refusalFor(table: string, existing: string[], flags: FeatureFlags): string | null {
  if (!existing.includes(table)) return 'unknown'
  if (isBookkeepingTable(table) || isCoreTable(table)) return 'core'
  const owner = ownerOfTable(table)
  if (owner === 'core') return 'core'
  if (flags[owner]) return 'feature-on'
  if (isPaymentRecordTable(table)) return 'payment'
  return null
}

export async function listUnusedTables(db: CleanupDb, flags: FeatureFlags): Promise<UnusedTablesReport> {
  const existing = await db.listTables()
  const candidates = existing.filter((table) => {
    if (isBookkeepingTable(table) || isCoreTable(table)) return false
    const owner = ownerOfTable(table)
    return owner !== 'core' && !flags[owner]
  })
  const sized = await surveySizes(db, candidates)
  const tables: UnusedTable[] = candidates.map((table) => {
    const owner = ownerOfTable(table) as FeatureKey
    const size = sized.sizes.get(table)
    return {
      table,
      feature: owner,
      featureLabel: FEATURE_MAP[owner].label,
      rows: size?.rows ?? 0,
      bytes: size?.bytes ?? 0,
      paymentRecord: isPaymentRecordTable(table),
    }
  })
  tables.sort((a, b) => a.featureLabel.localeCompare(b.featureLabel) || b.table.length - a.table.length || a.table.localeCompare(b.table))
  return { tables, sizesAreExact: sized.exact, sizeNote: sized.note }
}

/** Largest export a single request will build. A bigger table is exported in part and says so. */
export const MAX_EXPORT_ROWS = 20000

export type TableExport = { ok: boolean; reason?: string; table: string; rows: number; truncated: boolean; json: string }

/** The table's rows as JSON, for the download offered before a delete. Same guards as a delete. */
export async function exportUnusedTable(db: CleanupDb, flags: FeatureFlags, table: string): Promise<TableExport> {
  const refusal = refusalFor(table, await db.listTables(), flags)
  if (refusal && refusal !== 'payment') return { ok: false, reason: refusal, table, rows: 0, truncated: false, json: '' }
  const total = await db.countRows(table)
  const rows = await db.all(`SELECT * FROM \`${table}\` LIMIT ${MAX_EXPORT_ROWS}`)
  return {
    ok: true,
    table,
    rows: rows.length,
    truncated: total > rows.length,
    json: JSON.stringify({ table, exportedAt: new Date().toISOString(), totalRows: total, rows }, null, 2),
  }
}

export type DropOutcome = { ok: boolean; reason?: string; table: string; rowsDropped: number }

/** Drops one table after every guard has passed. `typed` must equal the table name. */
export async function dropUnusedTable(db: CleanupDb, flags: FeatureFlags, table: string, typed: string): Promise<DropOutcome> {
  const refusal = refusalFor(table, await db.listTables(), flags)
  if (refusal) return { ok: false, reason: refusal, table, rowsDropped: 0 }
  if (typed !== table) return { ok: false, reason: 'confirmation', table, rowsDropped: 0 }
  const rowsDropped = await db.countRows(table).catch((): number => 0)
  try {
    await db.run(`DROP TABLE \`${table}\``)
  } catch (error) {
    return { ok: false, reason: `error:${error instanceof Error ? error.message : String(error)}`, table, rowsDropped: 0 }
  }
  return { ok: true, table, rowsDropped }
}
