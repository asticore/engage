/**
 * Lazy table creation: a D1 wrapper that holds back the schema work of
 * features whose tables have not been provisioned yet.
 *
 * Every migration in this project writes through one funnel, the D1 binding
 * (`drizzle(rawDb)` and the direct `rawDb.prepare(...)` calls in
 * `runInternalMigrate`). Wrapping that binding lets a fresh install skip the
 * tables of features that are off, without touching the 147 migrations and
 * without a second copy of the schema: when a feature is switched on, the very
 * same migration sequence is replayed with the filter turned around so that
 * ONLY that feature's statements run (`provisioning.ts`). The result is the
 * schema the migrations define, in the order they define it.
 *
 * Two modes:
 *
 *  - `skip`:   writes (DDL, inserts, updates, deletes) aimed at a table owned
 *              by one of the `features` are not executed and report success.
 *  - `only`:   the opposite, used to provision one feature - only writes aimed
 *              at that feature's tables are executed; everything else (core
 *              tables, other features) reports success without running.
 *
 * Reads always run against the real database. A read of a table that does not
 * exist (a migration inspecting a feature that is not provisioned) returns an
 * empty result instead of throwing, so a missing table never aborts a run.
 *
 * Statements are classified by their target table with `ownerOfTable`
 * (features/featureTables.ts), which understands the pre-rename names the
 * foundation migrations still use.
 */

import { ownerOfTable, type TableOwner } from '@/features/featureTables'
import type { FeatureKey } from '@/features/registry'

export type DeferMode = { mode: 'skip'; features: Set<FeatureKey> } | { mode: 'only'; feature: FeatureKey }

export type StatementKind = { read: boolean; table: string | null }

const NAME = '[`"\\[]?([A-Za-z0-9_]+)[`"\\]]?'

/** Each pattern with the capture group that holds the TABLE (an index names itself first, then its table). */
const WRITE_PATTERNS: { re: RegExp; group: number }[] = [
  { re: new RegExp(`^CREATE\\s+(?:UNIQUE\\s+)?INDEX\\s+(?:IF\\s+NOT\\s+EXISTS\\s+)?${NAME}\\s+ON\\s+${NAME}`, 'i'), group: 2 },
  { re: new RegExp(`^CREATE\\s+(?:TEMP(?:ORARY)?\\s+)?TABLE\\s+(?:IF\\s+NOT\\s+EXISTS\\s+)?${NAME}`, 'i'), group: 1 },
  { re: new RegExp(`^ALTER\\s+TABLE\\s+${NAME}`, 'i'), group: 1 },
  { re: new RegExp(`^DROP\\s+TABLE\\s+(?:IF\\s+EXISTS\\s+)?${NAME}`, 'i'), group: 1 },
  { re: new RegExp(`^DROP\\s+INDEX\\s+(?:IF\\s+EXISTS\\s+)?${NAME}`, 'i'), group: 1 },
  { re: new RegExp(`^INSERT\\s+(?:OR\\s+\\w+\\s+)?INTO\\s+${NAME}`, 'i'), group: 1 },
  { re: new RegExp(`^REPLACE\\s+INTO\\s+${NAME}`, 'i'), group: 1 },
  { re: new RegExp(`^UPDATE\\s+(?:OR\\s+\\w+\\s+)?${NAME}`, 'i'), group: 1 },
  { re: new RegExp(`^DELETE\\s+FROM\\s+${NAME}`, 'i'), group: 1 },
]

/** Reads the target table out of a statement. Reads (SELECT, PRAGMA, WITH) are never held back. */
export function classifyStatement(statement: string): StatementKind {
  const text = statement.replace(/^(?:\s|--[^\n]*\n|\/\*[\s\S]*?\*\/)+/, '')
  if (/^(?:SELECT|PRAGMA|WITH|EXPLAIN)\b/i.test(text)) return { read: true, table: null }

  for (const { re, group } of WRITE_PATTERNS) {
    const match = text.match(re)
    if (match) return { read: false, table: match[group] ?? null }
  }
  return { read: false, table: null }
}

/** True when the wrapper must NOT execute this write. */
export function shouldHoldBack(mode: DeferMode, table: string | null): boolean {
  if (!table) return mode.mode === 'only'
  const owner: TableOwner = ownerOfTable(table)
  if (mode.mode === 'skip') return owner !== 'core' && mode.features.has(owner)
  return owner !== mode.feature
}

const META = {
  duration: 0,
  size_after: 0,
  rows_read: 0,
  rows_written: 0,
  last_row_id: 0,
  changed_db: false,
  changes: 0,
}

const emptyResult = () => ({ success: true as const, results: [] as unknown[], meta: { ...META } })

/**
 * Remembers, per held-back feature, the migrations whose statements or bound
 * values mention one of its tables (written or only read - a migration that
 * checks `eg_orders` exists and skips is as relevant as one that alters it).
 * Provisioning replays just those migrations instead of all of them. The scan
 * is deliberately generous (any word that names a feature table counts): a
 * false positive costs one extra replayed migration, a miss would lose a column.
 */
export type Tracker = { current: () => string | null; touched: Map<FeatureKey, Set<string>> }

const WORD = /[A-Za-z_][A-Za-z0-9_]*/g

export function featuresMentioned(statement: string, values: unknown[]): Set<FeatureKey> {
  const found = new Set<FeatureKey>()
  const scan = (text: string): void => {
    for (const word of text.slice(0, 4000).match(WORD) ?? []) {
      const owner = ownerOfTable(word)
      if (owner !== 'core') found.add(owner)
    }
  }
  scan(statement)
  for (const value of values) if (typeof value === 'string') scan(value)
  return found
}

export type DeferReport = { held: Record<string, number> }

/**
 * Wraps a D1 binding. `getMode` is read each time a statement runs; null lets everything through. `report.held` counts statements held back per owner so
 * a run can say what it left for later.
 */
export function deferTables(
  rawDb: D1Database,
  getMode: () => DeferMode | null,
  tracker?: Tracker,
  renamedAway: () => Set<string> = () => new Set(),
): { db: D1Database; report: DeferReport } {
  const report: DeferReport = { held: {} }

  const wrapStatement = (statement: string, inner: D1PreparedStatement, values: unknown[] = []): D1PreparedStatement => {
    const kind = classifyStatement(statement)
    /** While features are held back, remember which migration looked at their tables (see Tracker). */
    const track = (): void => {
      const mode = getMode()
      const migration = tracker?.current()
      if (!tracker || !migration || mode?.mode !== 'skip') return
      for (const feature of featuresMentioned(statement, values)) {
        if (!mode.features.has(feature)) continue
        const set = tracker.touched.get(feature) ?? new Set<string>()
        set.add(migration)
        tracker.touched.set(feature, set)
      }
    }
    /** Decided when the statement runs, so the mode can be switched on after the handle was made. */
    const isHeld = (): boolean => {
      const mode = getMode()
      if (mode === null || kind.read) return false
      // Providing a feature whose tables were partly dropped: a statement aimed at a retired
      // pre-rename name must not create a second, empty copy of a table that now exists under its new name.
      if (mode.mode === 'only' && kind.table && renamedAway().has(kind.table)) return true
      return shouldHoldBack(mode, kind.table)
    }
    /** Providing is a replay: a table or column that is already there is success, not failure. */
    const replaying = (): boolean => getMode()?.mode === 'only'

    const noteHeld = () => {
      const owner = !kind.table ? 'other' : ownerOfTable(kind.table)
      report.held[owner] = (report.held[owner] ?? 0) + 1
    }

    const readSafely = async <T>(run: () => Promise<T>, empty: () => T): Promise<T> => {
      try {
        return await run()
      } catch (error) {
        if (kind.read && /no such table/i.test(error instanceof Error ? error.message : String(error))) return empty()
        throw error
      }
    }

    const wrapped = {
      bind: (...bound: unknown[]) => wrapStatement(statement, inner.bind(...bound), bound),
      run: async () => {
        track()
        if (isHeld()) {
          noteHeld()
          return emptyResult()
        }
        try {
          return await inner.run()
        } catch (error) {
          if (replaying() && /already exists|duplicate column name/i.test(error instanceof Error ? error.message : String(error))) return emptyResult()
          throw error
        }
      },
      all: async () => {
        track()
        if (isHeld()) {
          noteHeld()
          return emptyResult()
        }
        return readSafely<unknown>(() => inner.all(), emptyResult)
      },
      first: async (column?: string) => {
        track()
        if (isHeld()) {
          noteHeld()
          return null
        }
        return readSafely(
          (): Promise<unknown> => (column === undefined ? inner.first() : inner.first(column)),
          (): unknown => null,
        )
      },
      raw: async (options?: { columnNames?: boolean }) => {
        track()
        if (isHeld()) {
          noteHeld()
          return []
        }
        return readSafely(
          (): Promise<unknown[]> => (options ? (inner.raw(options as { columnNames: true }) as Promise<unknown[]>) : inner.raw()),
          (): unknown[] => [],
        )
      },
    }
    return wrapped as unknown as D1PreparedStatement
  }

  const db = {
    prepare: (statement: string) => wrapStatement(statement, rawDb.prepare(statement)),
    batch: async (statements: D1PreparedStatement[]) => {
      const out = []
      for (const statement of statements) out.push(await (statement as unknown as { run: () => Promise<unknown> }).run())
      return out
    },
    exec: async (statement: string) => {
      // Multi-statement strings are not used by the migrations; run them as given.
      return rawDb.exec(statement)
    },
  }

  return { db: db as unknown as D1Database, report }
}
