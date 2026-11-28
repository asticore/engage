/**
 * First-run bootstrap: makes a freshly deployed instance (for example one
 * created with the README's "Deploy to Cloudflare" button) set itself up.
 *
 * The button's build only ships the Worker; it never runs the schema
 * migrations or the starter-content seed. Without this, a brand-new D1 database
 * is empty and every page 500s with "no such table". On the first request that
 * reaches `getEngine()` we look at `eg_migrations`; if the table is missing or
 * empty the database is fresh (a migrated database with no users is also re-seeded), so we run the same sequence `/api/internal-migrate`
 * and `/api/internal-seed` run (both idempotent), once per isolate.
 *
 * Already-migrated databases (production) cost one small read per cold isolate.
 * Upgrades to an existing database still go through `/api/internal-migrate`
 * (`pnpm run deploy:migrate`); this only covers the empty-database case.
 *
 * Skipped during `next build` and under vitest, where there is no real database
 * to initialise.
 */
import { resolveD1Binding } from '@/cms/db/connect'
import { consoleLogger } from '@/localapi/logger'
import pkg from '../../package.json'
import { setAppliedVersion } from '@/features/updates/state'
import { runInternalMigrate } from '@/migrations/runInternalMigrate'
import { seedHomeAndTemplates } from '@/seed/seedHomeAndTemplates'
import { seedDefaultAdmin } from '@/features/security/defaultAdmin'
import type { Engine } from '@/localapi/engine'

let pending: Promise<void> | null = null

async function tableExists(db: D1Database, name: string): Promise<boolean> {
  const table = await db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`).bind(name).all()
  return table.results.length > 0
}

async function count(db: D1Database, table: string): Promise<number> {
  const row = await db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).first<{ n: number }>()
  return row?.n ?? 0
}

/**
 * Reports a seed failure to the Error log (Worker logs are off on lean installs). Raw SQL, because the normal
 * logger goes through getEngine(), which waits on this very initialisation. Never throws.
 */
async function reportSeedError(db: D1Database, step: string, error: unknown): Promise<void> {
  try {
    if (!(await tableExists(db, 'eg_error_log'))) return
    const message = `${step} failed: ${error instanceof Error ? error.message : String(error)}`.slice(0, 2000)
    const stack = (error instanceof Error ? (error.stack ?? '') : '').slice(0, 4000)
    const now = new Date().toISOString()
    await db
      .prepare(`INSERT INTO eg_error_log (source, message, stack, path, user_agent, count, first_seen, last_seen, fingerprint, status) VALUES (?, ?, ?, '', '', 1, ?, ?, ?, 'open')`)
      .bind('first-run-seed', message, stack, now, now, `first-run-seed:${step}`)
      .run()
  } catch {
    // the console line from the caller is all we can do
  }
}

/**
 * A site needs seeding when it has no users or no pages at all: covers a fresh database and one whose first-run seed
 * died part way. The admin is seeded before the Home page, so a first request killed by the Worker's CPU or time limit
 * between the two leaves a user but no page; checking users alone then never finished the seed.
 */
async function needsSeed(db: D1Database): Promise<boolean> {
  if (!(await tableExists(db, 'eg_users'))) return true
  if ((await count(db, 'eg_users')) === 0) return true
  return (await tableExists(db, 'eg_pages')) && (await count(db, 'eg_pages')) === 0
}

export async function initialise(engine: Engine): Promise<void> {
  const db = await resolveD1Binding()
  const migrated = (await tableExists(db, 'eg_migrations')) && (await count(db, 'eg_migrations')) > 0
  if (migrated && !(await needsSeed(db))) return
  if (!migrated) {
    consoleLogger.info('Fresh database detected - running first-run migrations and seed.')
    const { errorCount } = await runInternalMigrate(db, consoleLogger)
    if (errorCount > 0) throw new Error(`First-run migration finished with ${errorCount} error(s).`)
    await setAppliedVersion(db, pkg.version)
  } else {
    consoleLogger.info('Migrated database has no users or pages - retrying first-run seed.')
  }
  // Admin first so sign-in works even if the heavier starter content fails. Both steps are idempotent.
  let failed: unknown = null
  try {
    await seedDefaultAdmin(engine)
  } catch (error) {
    failed = error
    consoleLogger.error(`First-run admin seed failed: ${error instanceof Error ? error.message : String(error)}`)
    await reportSeedError(db, 'seedDefaultAdmin', error)
  }
  try {
    await seedHomeAndTemplates(engine)
  } catch (error) {
    failed ??= error
    consoleLogger.error(`First-run starter content seed failed: ${error instanceof Error ? error.message : String(error)}`)
    await reportSeedError(db, 'seedHomeAndTemplates', error)
  }
  if (failed) throw failed instanceof Error ? failed : new Error(String(failed))
}

export function ensureInitialised(engine: Engine): Promise<void> {
  if (process.env.VITEST || process.env.NEXT_PHASE === 'phase-production-build') return Promise.resolve()
  if (!pending) {
    pending = initialise(engine).catch((error: unknown) => {
      pending = null // retry on the next request
      consoleLogger.error(`First-run initialisation failed: ${error instanceof Error ? error.message : String(error)}`)
    })
  }
  return pending
}
