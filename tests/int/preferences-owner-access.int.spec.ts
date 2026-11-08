// @vitest-environment node
/**
 * Owner-only access on the `preferences` collection, proven through the real
 * REST handlers (`handleRestRequest`) against a real engine and a fresh,
 * in-memory D1.
 *
 * Before `src/collections/Preferences.ts` declared an `access` block, the
 * collection fell back to the engine's default (`executeAccess` with no access
 * function: any signed-in user is allowed, unrestricted), so a signed-in
 * non-admin could list, read, update and delete every other user's rows via
 * `/api/preferences`. These tests pin the fix, and check that the trusted
 * server helpers that read and write the same rows still work.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { ensureMigratedLocalDb } from '../helpers/migratedDb'
import { createEngine, type Engine } from '@/localapi/engine'
import { handleRestRequest } from '@/localapi/rest'
import { loadEditPrefs, saveEditPrefs } from '@/admin/editPrefs'
import { loadListPrefs, resetListPrefs, saveListPrefs } from '@/admin/list/listPrefs'
import { readPreferences, writePreferences } from '@/features/accounts/preferences'
import type { AccountUser } from '@/features/accounts/session'
import { ACCOUNT_PREFERENCE_KEY } from '@/features/accounts/types'
import type { TypedUser } from '@/engine'

type Doc = { id: number; key?: string; user?: unknown; value?: unknown }

describe('preferences: owner-only access through /api/preferences', () => {
  let engine: Engine
  let admin: TypedUser
  let alice: TypedUser
  let bob: TypedUser

  /** The real engine, with `auth` answering as `user` - the REST layer's only source of the caller. */
  const as = (user: TypedUser | null): Engine => ({ ...engine, auth: async () => ({ user }) }) as unknown as Engine

  const rest = async (user: TypedUser | null, method: string, path: string, body?: unknown) => {
    const url = `http://x/api/${path}`
    const init: RequestInit = { method }
    if (body !== undefined) {
      init.body = JSON.stringify(body)
      init.headers = { 'content-type': 'application/json' }
    }
    const slug = new URL(url).pathname.replace(/^\/api\//, '').split('/')
    const res = await handleRestRequest(new Request(url, init), slug, as(user))
    if (!res) throw new Error(`no route for ${method} ${path}`)
    return { status: res.status, json: (await res.json()) as Record<string, unknown> }
  }

  const ownRow = async (owner: TypedUser, key: string, value: unknown): Promise<Doc> =>
    (await engine.create({ collection: 'preferences', data: { key, user: [owner.id], value } as never, overrideAccess: true })) as unknown as Doc

  const rowByID = async (id: number): Promise<Doc | null> =>
    (await engine.findByID({ collection: 'preferences', id, depth: 0, overrideAccess: true, disableErrors: true })) as unknown as Doc | null

  beforeAll(async () => {
    // The engine reads the app's own local D1 binding, so migrate that one (idempotent).
    await ensureMigratedLocalDb()
    engine = createEngine()
    const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const mk = async (name: string, roles: string[]) =>
      (await engine.create({ collection: 'users', data: { email: `prefs-${name}-${stamp}@example.com`, password: 'TestPassword123!', roles } as never, overrideAccess: true })) as unknown as TypedUser
    admin = await mk('admin', ['admin'])
    alice = await mk('alice', ['customer'])
    bob = await mk('bob', ['customer'])
  }, 180_000)

  /** The local D1 is shared and persists: only ever clear rows owned by this file's own users. */
  const clearOwnRows = async () => {
    const ids = new Set([admin, alice, bob].map((u) => String(u.id)))
    const all = await engine.find({ collection: 'preferences', limit: 10000, pagination: false, depth: 0, overrideAccess: true })
    for (const d of all.docs as Doc[]) {
      if (Array.isArray(d.user) && ids.has(String(d.user[0]))) await engine.delete({ collection: 'preferences', id: d.id, overrideAccess: true })
    }
  }

  beforeEach(clearOwnRows)

  afterAll(async () => {
    if (!engine) return
    await clearOwnRows()
    for (const u of [admin, alice, bob]) if (u) await engine.delete({ collection: 'users', id: u.id as number, overrideAccess: true }).catch((): undefined => undefined)
  })

  describe('a non-admin cannot reach another user\'s rows', () => {
    it('GET /api/preferences lists only the caller\'s own rows', async () => {
      const mine = await ownRow(alice, 'nav', { a: 1 })
      await ownRow(bob, 'nav', { b: 1 })
      await ownRow(bob, 'edit-screen-open', { open: ['x'] })

      const { status, json } = await rest(alice, 'GET', 'preferences?depth=0')
      expect(status).toBe(200)
      expect((json.docs as Doc[]).map((d) => d.id)).toEqual([mine.id])
      expect(json.totalDocs).toBe(1)
    })

    it('GET /api/preferences?where[key]... cannot widen past the owner filter', async () => {
      await ownRow(bob, 'nav', { b: 1 })
      const { status, json } = await rest(alice, 'GET', 'preferences?where[key][equals]=nav')
      expect(status).toBe(200)
      expect(json.docs).toEqual([])
    })

    it('GET /api/preferences/count counts only own rows', async () => {
      await ownRow(alice, 'nav', {})
      await ownRow(bob, 'nav', {})
      const { json } = await rest(alice, 'GET', 'preferences/count')
      expect(json.totalDocs).toBe(1)
    })

    it('GET /api/preferences/:id of another user\'s row is refused', async () => {
      const theirs = await ownRow(bob, 'nav', { secret: true })
      const { status } = await rest(alice, 'GET', `preferences/${theirs.id}`)
      expect([403, 404]).toContain(status)
    })

    it('GET /api/preferences/:id of the caller\'s own row works', async () => {
      const mine = await ownRow(alice, 'nav', { a: 1 })
      const { status, json } = await rest(alice, 'GET', `preferences/${mine.id}?depth=0`)
      expect(status).toBe(200)
      expect(json.value).toEqual({ a: 1 })
    })

    it('PATCH /api/preferences/:id of another user\'s row is refused and leaves it unchanged', async () => {
      const theirs = await ownRow(bob, 'nav', { b: 1 })
      const { status } = await rest(alice, 'PATCH', `preferences/${theirs.id}`, { value: { hacked: true } })
      expect(status).toBe(403)
      expect((await rowByID(theirs.id))?.value).toEqual({ b: 1 })
    })

    it('PATCH /api/preferences?where=... (bulk) does not touch another user\'s row', async () => {
      const theirs = await ownRow(bob, 'nav', { b: 1 })
      const { json } = await rest(alice, 'PATCH', 'preferences?where[key][equals]=nav', { value: { hacked: true } })
      expect(json.docs).toEqual([])
      expect((await rowByID(theirs.id))?.value).toEqual({ b: 1 })
    })

    it('DELETE /api/preferences/:id of another user\'s row is refused and keeps it', async () => {
      const theirs = await ownRow(bob, 'nav', { b: 1 })
      const { status } = await rest(alice, 'DELETE', `preferences/${theirs.id}`)
      expect(status).toBe(403)
      expect(await rowByID(theirs.id)).not.toBeNull()
    })

    it('DELETE /api/preferences?where=... (bulk) does not touch another user\'s row', async () => {
      const theirs = await ownRow(bob, 'nav', { b: 1 })
      await rest(alice, 'DELETE', 'preferences?where[key][equals]=nav')
      expect(await rowByID(theirs.id)).not.toBeNull()
    })

    it('PATCH and DELETE of the caller\'s own row work', async () => {
      const mine = await ownRow(alice, 'nav', { a: 1 })
      const patched = await rest(alice, 'PATCH', `preferences/${mine.id}`, { value: { a: 2 } })
      expect(patched.status).toBe(200)
      expect((await rowByID(mine.id))?.value).toEqual({ a: 2 })
      const deleted = await rest(alice, 'DELETE', `preferences/${mine.id}`)
      expect(deleted.status).toBe(200)
      expect(await rowByID(mine.id)).toBeNull()
    })

    it('PATCH cannot move the caller\'s own row onto another user', async () => {
      const mine = await ownRow(alice, 'nav', { a: 1 })
      await rest(alice, 'PATCH', `preferences/${mine.id}`, { user: [bob.id], value: { planted: true } })
      expect((await rowByID(mine.id))?.user).toEqual([alice.id])
    })

    it('POST /api/preferences stamps the caller as owner, ignoring a spoofed user', async () => {
      const { status, json } = await rest(alice, 'POST', 'preferences', { key: 'nav', user: [bob.id], value: { planted: true } })
      expect(status).toBe(201)
      const created = json.doc as Doc
      expect((await rowByID(created.id))?.user).toEqual([alice.id])
    })
  })

  describe('anonymous and admin callers', () => {
    it('an anonymous caller is refused list, read, create, update and delete', async () => {
      const row = await ownRow(bob, 'nav', {})
      expect((await rest(null, 'GET', 'preferences')).status).toBe(403)
      expect((await rest(null, 'GET', `preferences/${row.id}`)).status).toBe(403)
      expect((await rest(null, 'POST', 'preferences', { key: 'nav', value: {} })).status).toBe(403)
      expect((await rest(null, 'PATCH', `preferences/${row.id}`, { value: { x: 1 } })).status).toBe(403)
      expect((await rest(null, 'DELETE', `preferences/${row.id}`)).status).toBe(403)
      expect(await rowByID(row.id)).not.toBeNull()
    })

    it('an admin can list, read, update and delete any user\'s rows', async () => {
      const a = await ownRow(alice, 'nav', { a: 1 })
      const b = await ownRow(bob, 'nav', { b: 1 })
      const list = await rest(admin, 'GET', 'preferences?depth=0&pagination=false')
      expect((list.json.docs as Doc[]).map((d) => d.id)).toEqual(expect.arrayContaining([a.id, b.id]))
      expect((await rest(admin, 'GET', `preferences/${b.id}`)).status).toBe(200)
      expect((await rest(admin, 'PATCH', `preferences/${b.id}`, { value: { b: 2 } })).status).toBe(200)
      expect((await rowByID(b.id))?.value).toEqual({ b: 2 })
      expect((await rest(admin, 'DELETE', `preferences/${b.id}`)).status).toBe(200)
      expect(await rowByID(b.id)).toBeNull()
    })
  })

  describe('trusted server helpers still work', () => {
    it('edit-prefs: save and load the caller\'s own row, never another user\'s', async () => {
      await saveEditPrefs(engine, alice, { open: ['main-fields'] })
      await saveEditPrefs(engine, bob, { open: ['panel:publish'] })
      expect(await loadEditPrefs(engine, alice)).toEqual({ open: ['main-fields'] })
      expect(await loadEditPrefs(engine, bob)).toEqual({ open: ['panel:publish'] })
      await saveEditPrefs(engine, alice, { set: ['header:socials'] })
      expect((await loadEditPrefs(engine, alice)).open.sort()).toEqual(['header:socials', 'main-fields'])
    })

    it('list prefs: save, load and reset', async () => {
      await saveListPrefs(engine, admin, 'pages', { limit: 25 })
      expect(await loadListPrefs(engine, admin, 'pages')).toEqual({ limit: 25 })
      await resetListPrefs(engine, admin, 'pages')
      expect(await loadListPrefs(engine, admin, 'pages')).toEqual({})
    })

    it('account preferences: a non-admin reads and writes their own row through the access-enforced read', async () => {
      await writePreferences(engine, alice as unknown as AccountUser, { name: 'Alice' })
      await writePreferences(engine, bob as unknown as AccountUser, { name: 'Bob' })
      await writePreferences(engine, alice as unknown as AccountUser, { locale: 'en' })
      expect(await readPreferences(engine, alice as unknown as AccountUser)).toMatchObject({ name: 'Alice', locale: 'en' })
      expect(await readPreferences(engine, bob as unknown as AccountUser)).toMatchObject({ name: 'Bob' })
      const all = await engine.find({ collection: 'preferences', where: { key: { equals: ACCOUNT_PREFERENCE_KEY } }, pagination: false, depth: 0, overrideAccess: true })
      const owners = (all.docs as Doc[]).map((d) => String((d.user as unknown[])[0])).filter((id) => id === String(alice.id) || id === String(bob.id))
      expect(owners.sort()).toEqual([String(alice.id), String(bob.id)].sort())
    })

    it('nav state: the AdminNav read (req-scoped, default overrideAccess) still finds the caller\'s row', async () => {
      await ownRow(admin, 'nav', { groups: { Content: { open: true } } })
      await ownRow(bob, 'nav', { groups: { Settings: { open: true } } })
      // Same call shape as getNavPreferences in src/components/admin/nav/AdminNav.tsx.
      const result = await engine.find({ collection: 'preferences', depth: 0, limit: 1000, pagination: false, req: { user: admin } as never, where: { key: { equals: 'nav' } } })
      const mine = (result.docs as Doc[]).filter((d) => Array.isArray(d.user) && String(d.user[0]) === String(admin.id))
      expect(mine.map((d) => d.value)).toEqual([{ groups: { Content: { open: true } } }])
    })
  })
})
