/**
 * Dev D1 check: makes sure the local emulated D1 that the app and the
 * integration specs read has the real schema.
 *
 * A local D1 can end up as an empty stub: the migration ledger (`eg_migrations`)
 * has rows, but the base tables (`eg_users`, `eg_pages`, ...) were never
 * created, so every spec fails with "no such table". When that is found, the
 * local D1 directory is deleted and rebuilt with the same fresh-install sequence
 * the deploy button uses (`runInternalMigrate`). Local only: a named
 * CLOUDFLARE_ENV is never touched, and production is not reachable from here.
 *
 * Runs before `pnpm run test:int` (see the `pretest:int` script) and can be run
 * by hand:
 *
 *   NODE_OPTIONS=--no-deprecation npx tsx scripts/checkDevD1.mts
 */

import { existsSync, rmSync } from 'node:fs'
import { join } from 'node:path'

import { getPlatformProxy } from 'wrangler'

import { consoleLogger } from '../src/localapi/logger'
import { runInternalMigrate } from '../src/migrations/runInternalMigrate'

/** A table every working install has; if it is missing the D1 is not usable. */
const CANARY_TABLE = 'eg_users'
/** Wrangler's local D1 store for this project (the default persist path). */
const LOCAL_D1_DIR = join(process.cwd(), '.wrangler', 'state', 'v3', 'd1')

type State = 'ok' | 'empty' | 'stub'

async function inspect(): Promise<State> {
  const proxy = await getPlatformProxy<{ D1: D1Database }>()
  try {
    const d1 = proxy.env.D1
    const canary = await d1.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`).bind(CANARY_TABLE).all()
    if ((canary.results?.length ?? 0) > 0) return 'ok'
    const ledger = await d1.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='eg_migrations'`).all()
    if ((ledger.results?.length ?? 0) === 0) return 'empty'
    const rows = await d1.prepare(`SELECT COUNT(*) AS n FROM eg_migrations`).first<{ n: number }>()
    return rows && rows.n > 0 ? 'stub' : 'empty'
  } finally {
    await proxy.dispose()
  }
}

async function main(): Promise<void> {
  if (process.env.CLOUDFLARE_ENV) {
    console.log(`[check-dev-d1] CLOUDFLARE_ENV=${process.env.CLOUDFLARE_ENV} is set: local D1 is not checked.`)
    return
  }

  const state = await inspect()
  if (state === 'ok') {
    console.log(`[check-dev-d1] Local D1 has ${CANARY_TABLE}: nothing to do.`)
    return
  }

  console.log(`[check-dev-d1] Local D1 is ${state === 'stub' ? 'an empty migration stub' : 'empty'}: rebuilding it.`)
  if (state === 'stub' && existsSync(LOCAL_D1_DIR)) {
    rmSync(LOCAL_D1_DIR, { recursive: true, force: true })
  }

  const proxy = await getPlatformProxy<{ D1: D1Database }>()
  try {
    const { errorCount } = await runInternalMigrate(proxy.env.D1, consoleLogger)
    if (errorCount > 0) {
      console.error(`[check-dev-d1] Rebuild finished with ${errorCount} error(s).`)
      process.exitCode = 1
      return
    }
  } finally {
    await proxy.dispose()
  }

  const after = await inspect()
  if (after !== 'ok') {
    console.error(`[check-dev-d1] Rebuild did not create ${CANARY_TABLE}.`)
    process.exitCode = 1
    return
  }
  console.log('[check-dev-d1] Local D1 rebuilt.')
}

await main()
