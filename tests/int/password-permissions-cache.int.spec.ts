import { beforeEach, describe, expect, it, vi } from 'vitest'

const { getAdminContext, getDb, getPasswordHash, setPasswordHash, clearPassword, purgeCache, assertDocAccess } = vi.hoisted(() => ({
  getAdminContext: vi.fn(),
  getDb: vi.fn(),
  getPasswordHash: vi.fn(),
  setPasswordHash: vi.fn(),
  clearPassword: vi.fn(),
  purgeCache: vi.fn(),
  assertDocAccess: vi.fn(),
}))

vi.mock('@/admin/auth', () => ({ getAdminContext }))
vi.mock('@/cms/db/connect', () => ({ getDb }))
vi.mock('@/cms/db/contentPasswords', () => ({ getPasswordHash, setPasswordHash, clearPassword }))
vi.mock('@/features/visibility/password', () => ({ hashPassword: vi.fn(async () => 'h') }))
vi.mock('@/features/speed/purge', () => ({ purgeCache }))
vi.mock('@/features/dataViews/cache', () => ({ noteDocumentChanged: vi.fn() }))
vi.mock('@/features/roles/docAccess', () => ({ assertDocAccess, docAccessDenied: () => new Response('no', { status: 403 }) }))

import { canManagePasswords } from '@/features/visibility/passwordAccess'
import { GET, POST, DELETE } from '@/app/(engage)/api/admin-visibility-password/route'
import { isCacheableResponse, requestVerdict, type EdgeRules } from '@/features/speed/edgeCache'

/** A role that holds only the listed resources with update. */
const roleWith = (...resources: string[]) => ({
  isAdmin: false,
  user: { id: 7 },
  can: vi.fn((resource: string, action: string) => action === 'update' && resources.includes(resource)),
  engine: { findByID: vi.fn() },
})

const rules: EdgeRules = { cacheLoggedInUsers: false, neverCachePaths: [], neverCacheCookies: [], neverCacheQueryStrings: [] }

describe('canManagePasswords (role-based permission)', () => {
  it('admins always may', () => {
    expect(canManagePasswords({ isAdmin: true, can: () => false })).toBe(true)
  })

  it('a role with the password permission may', () => {
    expect(canManagePasswords(roleWith('admin-visibility-password') as never)).toBe(true)
  })

  it('a role with content update may, on that collection only when a collection is named', () => {
    const editor = roleWith('pages') as never
    expect(canManagePasswords(editor)).toBe(true)
    expect(canManagePasswords(editor, 'pages')).toBe(true)
    expect(canManagePasswords(editor, 'posts')).toBe(false)
  })

  it('a role with no matching grant may not', () => {
    expect(canManagePasswords(roleWith('media') as never, 'pages')).toBe(false)
    expect(canManagePasswords(roleWith() as never)).toBe(false)
  })
})

describe('admin-visibility-password route for a content editor', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.ENGAGE_SECRET = 's'
    getDb.mockResolvedValue({})
    getPasswordHash.mockResolvedValue(null)
    assertDocAccess.mockResolvedValue({ ok: true })
    purgeCache.mockResolvedValue({})
  })

  it('lets a pages editor read, set and clear a page password', async () => {
    getAdminContext.mockResolvedValue(roleWith('pages'))
    expect((await GET(new Request('http://x/api/admin-visibility-password?collection=pages&id=1'))).status).toBe(200)
    expect((await POST(new Request('http://x/api/admin-visibility-password', { method: 'POST', body: JSON.stringify({ collection: 'pages', id: 1, password: 'abcd' }) }))).status).toBe(200)
    expect((await DELETE(new Request('http://x/api/admin-visibility-password?collection=pages&id=1', { method: 'DELETE' }))).status).toBe(200)
    expect(assertDocAccess).toHaveBeenCalledTimes(3)
  })

  it('refuses a pages editor on a post, before any write', async () => {
    getAdminContext.mockResolvedValue(roleWith('pages'))
    const res = await POST(new Request('http://x/api/admin-visibility-password', { method: 'POST', body: JSON.stringify({ collection: 'posts', id: 1, password: 'abcd' }) }))
    expect(res.status).toBe(401)
    expect(setPasswordHash).not.toHaveBeenCalled()
    expect(purgeCache).not.toHaveBeenCalled()
  })

  it('refuses a role with no content or password grant', async () => {
    getAdminContext.mockResolvedValue(roleWith('media'))
    expect((await GET(new Request('http://x/api/admin-visibility-password?collection=pages&id=1'))).status).toBe(401)
  })
})

describe('protected content never enters the public cache', () => {
  it.each(['pages', 'posts', 'products', 'events'])('a %s unlock cookie bypasses the edge cache', (collection) => {
    const headers = new Headers({ cookie: `eg_unlock_${collection}_12=signed` })
    expect(requestVerdict(`https://site.test/x`, 'GET', headers, rules)).toEqual({ cacheable: false, reason: 'unlock' })
  })

  it('a group unlock cookie bypasses the edge cache', () => {
    const headers = new Headers({ cookie: 'eg_unlock_group_3=signed' })
    expect(requestVerdict('https://site.test/x', 'GET', headers, rules).cacheable).toBe(false)
  })

  it('a response that sets a cookie or is private is never stored', () => {
    expect(isCacheableResponse(200, new Headers({ 'content-type': 'text/html', 'set-cookie': 'a=b' }))).toBe(false)
    expect(isCacheableResponse(200, new Headers({ 'content-type': 'text/html', 'cache-control': 'private, no-store' }))).toBe(false)
  })

  it('a password set or clear forces a cache epoch bump (purgeCache force)', async () => {
    vi.clearAllMocks()
    process.env.ENGAGE_SECRET = 's'
    getDb.mockResolvedValue({})
    const context = roleWith('pages')
    context.engine.findByID.mockResolvedValue({ slug: 'about', parent: null, isHomepage: false })
    getAdminContext.mockResolvedValue(context)
    getPasswordHash.mockResolvedValue(null)
    assertDocAccess.mockResolvedValue({ ok: true })
    purgeCache.mockResolvedValue({})
    await DELETE(new Request('http://x/api/admin-visibility-password?collection=pages&id=1', { method: 'DELETE' }))
    expect(purgeCache).toHaveBeenCalledWith('/about', { force: true })
  })
})
