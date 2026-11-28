// @vitest-environment node
// A first request that migrated the database but died before seeding must not strand the site without a login:
// the next request sees eg_migrations populated and eg_users empty, and has to retry the seed.
import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = { tables: new Set<string>(), counts: {} as Record<string, number>, errorRows: [] as unknown[][] }
const seedDefaultAdmin = vi.fn()
const seedHomeAndTemplates = vi.fn()
const runInternalMigrate = vi.fn()

const db = {
  prepare(sql: string) {
    let bound: unknown[] = []
    const stmt = {
      bind(...args: unknown[]) {
        bound = args
        return stmt
      },
      async all() {
        return { results: state.tables.has(String(bound[0])) ? [{ name: bound[0] }] : [] }
      },
      async first() {
        const table = /FROM (\w+)/.exec(sql)?.[1] ?? ''
        return { n: state.counts[table] ?? 0 }
      },
      async run() {
        if (sql.startsWith('INSERT INTO eg_error_log')) state.errorRows.push(bound)
        return {}
      },
    }
    return stmt
  },
}

vi.mock('@/cms/db/connect', () => ({ resolveD1Binding: async () => db }))
vi.mock('@/localapi/logger', () => ({ consoleLogger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() } }))
vi.mock('@/features/updates/state', () => ({ setAppliedVersion: vi.fn() }))
vi.mock('@/migrations/runInternalMigrate', () => ({ runInternalMigrate: (...a: unknown[]) => runInternalMigrate(...a) }))
vi.mock('@/seed/seedHomeAndTemplates', () => ({ seedHomeAndTemplates: (...a: unknown[]) => seedHomeAndTemplates(...a) }))
vi.mock('@/features/security/defaultAdmin', () => ({ seedDefaultAdmin: (...a: unknown[]) => seedDefaultAdmin(...a) }))

import { initialise } from '@/migrations/ensureInitialised'

const engine = {} as never

describe('ensureInitialised - retry after partial first-run failure', () => {
  beforeEach(() => {
    state.tables = new Set(['eg_migrations', 'eg_users', 'eg_pages', 'eg_error_log'])
    state.counts = { eg_migrations: 257, eg_users: 0, eg_pages: 0 }
    state.errorRows = []
    seedDefaultAdmin.mockReset()
    seedHomeAndTemplates.mockReset()
    runInternalMigrate.mockReset().mockResolvedValue({ errorCount: 0 })
  })

  it('re-seeds a migrated database that has no users, without migrating again', async () => {
    await initialise(engine)
    expect(runInternalMigrate).not.toHaveBeenCalled()
    expect(seedDefaultAdmin).toHaveBeenCalledOnce()
    expect(seedHomeAndTemplates).toHaveBeenCalledOnce()
  })

  it('finishes the seed when the first request was killed after the admin but before the Home page', async () => {
    state.counts.eg_users = 1
    await initialise(engine)
    expect(runInternalMigrate).not.toHaveBeenCalled()
    expect(seedHomeAndTemplates).toHaveBeenCalledOnce()
  })

  it('does nothing once a user and a page exist', async () => {
    state.counts.eg_users = 1
    state.counts.eg_pages = 1
    await initialise(engine)
    expect(seedDefaultAdmin).not.toHaveBeenCalled()
    expect(seedHomeAndTemplates).not.toHaveBeenCalled()
  })

  it('migrates and seeds a truly fresh database', async () => {
    state.tables = new Set()
    state.counts = {}
    await initialise(engine)
    expect(runInternalMigrate).toHaveBeenCalledOnce()
    expect(seedDefaultAdmin).toHaveBeenCalledOnce()
  })

  it('creates the admin even when the starter content fails, logs the error, and rethrows so it retries', async () => {
    seedHomeAndTemplates.mockRejectedValue(new Error('content boom'))
    await expect(initialise(engine)).rejects.toThrow('content boom')
    expect(seedDefaultAdmin).toHaveBeenCalledOnce()
    expect(state.errorRows).toHaveLength(1)
    expect(String(state.errorRows[0]?.[1])).toContain('seedHomeAndTemplates failed: content boom')
  })

  it('still tries the starter content when the admin seed fails', async () => {
    seedDefaultAdmin.mockRejectedValue(new Error('admin boom'))
    await expect(initialise(engine)).rejects.toThrow('admin boom')
    expect(seedHomeAndTemplates).toHaveBeenCalledOnce()
  })
})
