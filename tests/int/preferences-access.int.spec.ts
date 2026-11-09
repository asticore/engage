// @vitest-environment node
/**
 * Ownership rules for the preferences collection, exercised through the real
 * REST handlers (handleRestRequest) against a real engine and an in-memory D1.
 * A request is signed in as a given user through the `x-test-user` header
 * (engine.auth is replaced; everything past authentication is the real code).
 */

import { drizzle } from 'drizzle-orm/d1'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { getPlatformProxy } from 'wrangler'

import { loadEditPrefs, saveEditPrefs } from '@/admin/editPrefs'
import type { TypedUser } from '@/engine'
import { loadTourPref, saveTourPref } from '@/features/adminTour/preference'
import { createEngine, type Engine } from '@/localapi/engine'
import { consoleLogger } from '@/localapi/logger'
import { runMigrations, type Drizzle, type MigrationEntry } from '@/localapi/migrate'
import { handleRestRequest } from '@/localapi/rest'
import { migrations } from '@/migrations'
import type { EngineDb } from '@/migrations/schema/engineBootstrap'
import { applyRelsColumnRenames, ensureMigrationsTable } from '@/migrations/schema/engineBootstrap'

type Who = 'a' | 'b' | 'admin' | 'anon'
type Json = Record<string, unknown>

const ownerId = (stored: unknown): number => {
  const first = Array.isArray(stored) ? stored[0] : stored
  const value = typeof first === 'object' && first !== null ? (first as { value?: unknown }).value : first
  return Number(typeof value === 'object' && value !== null ? (value as { id?: unknown }).id : value)
}

describe('preferences REST access', () => {
  let proxy: Awaited<ReturnType<typeof getPlatformProxy<{ D1: D1Database }>>>
  let real: Engine
  let engine: Engine
  const users = {} as Record<'a' | 'b' | 'admin', TypedUser>
  let rowA: number
  let rowB: number

  const call = async (who: Who, method: string, path: string[], body?: unknown) => {
    const url = `http://localhost/api/${path.join('/')}`
    const req = new Request(url, {
      method,
      headers: { 'content-type': 'application/json', 'x-test-user': who },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    const res = await handleRestRequest(req, path, engine)
    const json = (await res?.json().catch((): null => null)) as Json | null
    return { status: res?.status ?? 0, json }
  }

  const rawRow = (id: number): Promise<Json | null> =>
    real.findByID({ collection: 'preferences', id, depth: 0, overrideAccess: true, disableErrors: true }) as Promise<Json | null>

  const makeRow = async (owner: TypedUser, key: string, value: unknown) =>
    (await real.create({
      collection: 'preferences',
      data: { user: [owner.id], key, value } as never,
      overrideAccess: true,
    })) as unknown as { id: number }

  beforeAll(async () => {
    proxy = await getPlatformProxy<{ D1: D1Database }>()
    const d1 = proxy.env.D1
    const db = drizzle(d1) as unknown as Drizzle
    const engineDb: EngineDb = {
      exists: async (table) => ((await d1.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`).bind(table).all()).results?.length ?? 0) > 0,
      listTables: async () => (((await d1.prepare(`SELECT name FROM sqlite_master WHERE type='table'`).all()).results ?? []) as { name: string }[]).map((r) => r.name),
      columnsOf: async (table) => (((await d1.prepare(`PRAGMA table_info(\`${table}\`)`).all()).results ?? []) as { name: string }[]).map((r) => r.name),
      run: (statement) => d1.prepare(statement).run(),
      countRows: async (table) => ((await d1.prepare(`SELECT COUNT(*) AS n FROM \`${table}\``).all()).results?.[0] as { n: number } | undefined)?.n ?? 0,
    }
    await ensureMigrationsTable(engineDb)
    await runMigrations({ db, engineDb, logger: consoleLogger, migrations: migrations as unknown as MigrationEntry[] })
    await applyRelsColumnRenames(engineDb)
    real = createEngine()
    const stamp = Date.now()
    for (const who of ['a', 'b', 'admin'] as const) {
      users[who] = (await real.create({
        collection: 'users',
        data: { email: `${who}-${stamp}@example.com`, password: 'TestPassword123!', ...(who === 'admin' ? { roles: ['admin'] } : {}) } as never,
        overrideAccess: true,
      })) as unknown as TypedUser
    }
    engine = {
      ...real,
      auth: (async (args: { headers: Headers }) => {
        const who = args.headers.get('x-test-user') as Who
        return { user: who === 'anon' ? null : { ...users[who], collection: 'users' } }
      }) as unknown as Engine['auth'],
    } as Engine
    rowA = (await makeRow(users.a, 'seed', { who: 'a' })).id
    rowB = (await makeRow(users.b, 'seed', { who: 'b' })).id
  }, 180_000)

  afterAll(async () => {
    await proxy?.dispose()
  })

  it('a non-admin cannot list another user\'s rows', async () => {
    const res = await call('a', 'GET', ['preferences'])
    const ids = ((res.json?.docs ?? []) as Array<{ id: number }>).map((d) => d.id)
    expect(ids).toContain(rowA)
    expect(ids).not.toContain(rowB)
  })

  it('a non-admin cannot read another user\'s row by id, but can read their own', async () => {
    expect((await call('a', 'GET', ['preferences', String(rowB)])).status).toBeGreaterThanOrEqual(403)
    const own = await call('a', 'GET', ['preferences', String(rowA)])
    expect(own.status).toBe(200)
    expect((own.json as { id?: number }).id).toBe(rowA)
  })

  it('a non-admin cannot update another user\'s row, but can update their own', async () => {
    const bad = await call('a', 'PATCH', ['preferences', String(rowB)], { value: { hacked: true } })
    expect(bad.status).toBeGreaterThanOrEqual(400)
    expect((await rawRow(rowB))?.value).toEqual({ who: 'b' })
    const ok = await call('a', 'PATCH', ['preferences', String(rowA)], { value: { who: 'a', n: 2 } })
    expect(ok.status).toBe(200)
    expect((await rawRow(rowA))?.value).toEqual({ who: 'a', n: 2 })
  })

  it('a non-admin cannot reassign their own row to someone else', async () => {
    await call('a', 'PATCH', ['preferences', String(rowA)], { user: [{ relationTo: 'users', value: users.b.id }] })
    expect(ownerId((await rawRow(rowA))?.user)).toBe(users.a.id)
  })

  it('a non-admin cannot delete another user\'s row, but can delete their own', async () => {
    const bad = await call('a', 'DELETE', ['preferences', String(rowB)])
    expect(bad.status).toBeGreaterThanOrEqual(400)
    expect(await rawRow(rowB)).not.toBeNull()
    const mine = await makeRow(users.a, 'tmp', 1)
    const ok = await call('a', 'DELETE', ['preferences', String(mine.id)])
    expect(ok.status).toBe(200)
    expect(await rawRow(mine.id)).toBeNull()
  })

  it('create is forced to the caller whatever owner the body names', async () => {
    for (const user of [[users.b.id], [{ relationTo: 'users', value: users.b.id }], users.b.id]) {
      const res = await call('a', 'POST', ['preferences'], { key: 'forged', value: 1, user })
      expect(res.status).toBe(201)
      const id = (res.json as { doc: { id: number } }).doc.id
      expect(ownerId((await rawRow(id))?.user)).toBe(users.a.id)
    }
    expect(((await call('b', 'GET', ['preferences'])).json?.docs as Array<{ key: string }>).some((d) => d.key === 'forged')).toBe(false)
  })

  it('admin can manage every row', async () => {
    const list = await call('admin', 'GET', ['preferences'])
    const ids = ((list.json?.docs ?? []) as Array<{ id: number }>).map((d) => d.id)
    expect(ids).toEqual(expect.arrayContaining([rowA, rowB]))
    expect((await call('admin', 'GET', ['preferences', String(rowB)])).status).toBe(200)
    expect((await call('admin', 'PATCH', ['preferences', String(rowB)], { value: { who: 'b', admin: true } })).status).toBe(200)
    const tmp = await makeRow(users.b, 'tmp-admin', 1)
    expect((await call('admin', 'DELETE', ['preferences', String(tmp.id)])).status).toBe(200)
  })

  it('anonymous gets nothing', async () => {
    const list = await call('anon', 'GET', ['preferences'])
    expect(((list.json?.docs ?? []) as unknown[]).length).toBe(0)
    expect((await call('anon', 'GET', ['preferences', String(rowA)])).status).toBeGreaterThanOrEqual(401)
    expect((await call('anon', 'POST', ['preferences'], { key: 'x', value: 1, user: [users.a.id] })).status).toBeGreaterThanOrEqual(401)
    expect((await call('anon', 'PATCH', ['preferences', String(rowA)], { value: 0 })).status).toBeGreaterThanOrEqual(401)
    expect((await call('anon', 'DELETE', ['preferences', String(rowA)])).status).toBeGreaterThanOrEqual(401)
  })

  it('server helpers (admin tour, edit prefs, nav-style read) keep working', async () => {
    expect(await loadTourPref(real, users.a)).toBeNull()
    await saveTourPref(real, users.a, 'completed')
    expect((await loadTourPref(real, users.a))?.status).toBe('completed')
    expect(await loadTourPref(real, users.b)).toBeNull()

    await saveEditPrefs(real, users.a, { open: ['x'] })
    expect((await loadEditPrefs(real, users.a)).open).toEqual(['x'])

    // AdminNav-style read: caller's own session, access enforced, filtered by key.
    const nav = await makeRow(users.a, 'nav', { groups: [] })
    const found = await real.find({ collection: 'preferences', where: { key: { equals: 'nav' } }, depth: 0, limit: 1000, pagination: false, user: users.a, overrideAccess: false })
    expect(found.docs.map((d) => (d as { id: number }).id)).toContain(nav.id)
    const other = await real.find({ collection: 'preferences', where: { key: { equals: 'nav' } }, depth: 0, limit: 1000, pagination: false, user: users.b, overrideAccess: false })
    expect(other.docs.map((d) => (d as { id: number }).id)).not.toContain(nav.id)
  })
})
