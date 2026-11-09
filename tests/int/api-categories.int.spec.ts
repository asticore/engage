// @vitest-environment node
// API access categories, key rotation, data feed formats, the drag and drop field moves and the
// customer's endpoint list. Pure rules and the key flows against an in-memory store; the D1 store is
// covered in internal-migrate-fresh-install.int.spec.ts.
import { describe, expect, it } from 'vitest'

import { ApiKeyRefused, authenticateApiKey, createApiKey, rotateApiKey, type ApiKeyAuditEntry, type ApiKeyDeps, type ApiKeyRow, type ApiKeyStore, type LiveOwner } from '@/features/apiKeys'
import { effectiveMaxKeys, intersectScopes, scopesOutsideCategory, validateCategory, validateSubject, type CategoryLimits } from '@/features/apiKeys/categories'
import { csvCell, renderFeed, toCsv, toJsonLines, toXml } from '@/features/apiBuilder/feeds'
import { endpointsForAccount } from '@/features/apiBuilder/accountEndpoints'
import { decideEndpointAccess } from '@/features/apiBuilder/runtime'
import { addField, moveField, removeField } from '@/features/apiBuilder/components/FieldDropPicker'
import { validateEndpoint, type ApiEndpoint } from '@/features/apiBuilder/core'
import { DEFAULT_API_KEY_SETTINGS, type ApiKeySettings } from '@/features/security/settings'

const NOW = Date.parse('2026-11-09T10:00:00.000Z')
const ON: ApiKeySettings = { ...DEFAULT_API_KEY_SETTINGS, enabled: true, allowCustomers: true }

describe('intersectScopes', () => {
  it('narrows wildcards both ways and drops what the category does not cover', () => {
    expect(intersectScopes(['*'], ['pages:read'])).toEqual(['pages:read'])
    expect(intersectScopes(['*:read'], ['pages:*'])).toEqual(['pages:read'])
    expect(intersectScopes(['orders:write'], ['pages:*'])).toEqual([])
    expect(intersectScopes(['pages:write'], ['pages:read'])).toEqual([])
    expect(intersectScopes(['read'], ['*:*'])).toEqual(['*:read'])
    expect(intersectScopes(['pages:read', 'posts:read'], ['posts:*', 'pages:read'])).toEqual(['pages:read', 'posts:read'])
  })
  it('reports requested scopes outside a category', () => {
    expect(scopesOutsideCategory(['pages:read', 'orders:write'], ['pages:read'])).toEqual(['orders:write'])
  })
  it('uses the lower key cap', () => {
    expect(effectiveMaxKeys({ maxKeys: 2 }, 5)).toBe(2)
    expect(effectiveMaxKeys({ maxKeys: 9 }, 5)).toBe(5)
    expect(effectiveMaxKeys(null, 5)).toBe(5)
  })
})

describe('validateCategory and validateSubject', () => {
  it('checks the details and clamps numbers', () => {
    expect(validateCategory({ name: ' ', scopes: ['*:read'] }).ok).toBe(false)
    expect(validateCategory({ name: 'Partner', scopes: [] }).ok).toBe(false)
    expect(validateCategory({ name: 'Partner', scopes: ['nonsense'] }).ok).toBe(false)
    const ok = validateCategory({ name: 'Partner', scopes: ['pages:read'], ratePerMinute: '99999', maxKeys: 0 })
    expect(ok.ok && ok.value).toMatchObject({ name: 'Partner', ratePerMinute: 6000, maxKeys: 1 })
  })
  it('accepts a person id or an organisation id only', () => {
    expect(validateSubject('user', '12').ok).toBe(true)
    expect(validateSubject('user', 'abc').ok).toBe(false)
    expect(validateSubject('organization', 'org_1').ok).toBe(true)
    expect(validateSubject('team', '1').ok).toBe(false)
  })
})

function rig(owners: Array<{ id: number; roles: string[] }>, category: (id: number) => CategoryLimits | null, exists = true) {
  const rows: ApiKeyRow[] = []
  const store: ApiKeyStore = {
    async insert(row) {
      rows.push({ ...row, id: rows.length + 1, lastUsedAt: null, revokedAt: null })
      return rows.length
    },
    async findByHash(h) {
      return rows.find((r) => r.keyHash === h) ?? null
    },
    async findById(id) {
      return rows.find((r) => r.id === id) ?? null
    },
    async listForUser(u) {
      return rows.filter((r) => r.userId === u)
    },
    async listAll() {
      return [...rows]
    },
    async touch() {},
    async revoke(id, at) {
      const r = rows.find((x) => x.id === id)
      if (r && !r.revokedAt) r.revokedAt = at
    },
  }
  const audits: ApiKeyAuditEntry[] = []
  const deps: ApiKeyDeps = {
    store,
    now: () => NOW,
    audit: async (e) => void audits.push(e),
    loadOwner: async (id) => {
      const o = owners.find((x) => x.id === id)
      return o ? { id: o.id, email: `u${o.id}@x.com`, roles: o.roles, locked: false, user: o } : null
    },
    loadCategory: async (id) => category(id),
    categoriesExist: async () => exists,
  }
  return { deps, rows, audits }
}
const asOwner = (id: number, roles: string[]): LiveOwner => ({ id, email: `u${id}@x.com`, roles, locked: false, user: { id } })
const PARTNER: CategoryLimits = { id: 7, name: 'Partner', scopes: ['pages:read'], ratePerMinute: 30, maxKeys: 1 }

describe('keys and categories', () => {
  it('refuses scopes outside the category when a key is made, and caps keys at the category limit', async () => {
    const { deps } = rig([{ id: 5, roles: ['customer'] }], () => PARTNER)
    const bad = await createApiKey(deps, asOwner(5, ['customer']), { name: 'k', scopes: ['orders:read'] }, ON)
    expect(bad.ok).toBe(false)
    expect((await createApiKey(deps, asOwner(5, ['customer']), { name: 'a', scopes: ['pages:read'] }, ON)).ok).toBe(true)
    const second = await createApiKey(deps, asOwner(5, ['customer']), { name: 'b', scopes: ['pages:read'] }, ON)
    expect(second.ok === false && second.error).toMatch(/1 active/)
  })

  it('narrows a key to its category at use time and carries the rate and category', async () => {
    let cat: CategoryLimits | null = { ...PARTNER, scopes: ['pages:*', 'posts:read'] }
    const { deps } = rig([{ id: 5, roles: ['customer'] }], () => cat)
    const made = await createApiKey(deps, asOwner(5, ['customer']), { name: 'a', scopes: ['pages:write', 'posts:read'] }, ON)
    if (made.ok === false) throw new Error(made.error)
    const first = await authenticateApiKey(deps, made.value.key, ON)
    expect(first.key.scopes.sort()).toEqual(['pages:write', 'posts:read'])
    expect(first.key).toMatchObject({ ratePerMinute: 30, category: 'Partner', categoryId: 7 })
    cat = { ...PARTNER, scopes: ['posts:read'] } // admin tightens the category: the key follows at once
    expect((await authenticateApiKey(deps, made.value.key, ON)).key.scopes).toEqual(['posts:read'])
  })

  it('refuses a customer with no category once categories exist, but leaves staff alone', async () => {
    const { deps } = rig([{ id: 5, roles: ['customer'] }, { id: 1, roles: ['admin'] }], () => null)
    const made = await createApiKey(deps, asOwner(1, ['admin']), { name: 'staff', scopes: ['read'] }, ON)
    if (made.ok === false) throw new Error(made.error)
    expect((await authenticateApiKey(deps, made.value.key, ON)).key.scopes).toEqual(['read'])
    const cust = await createApiKey(deps, asOwner(5, ['customer']), { name: 'c', scopes: ['read'] }, ON)
    expect(cust.ok).toBe(false)
    // A key made before the first category existed stops working for a customer without one.
    const old = rig([{ id: 5, roles: ['customer'] }], () => null, false)
    const k = await createApiKey(old.deps, asOwner(5, ['customer']), { name: 'c', scopes: ['read'] }, ON)
    if (k.ok === false) throw new Error(k.error)
    const strict = { ...old.deps, categoriesExist: async () => true }
    await expect(authenticateApiKey(strict, k.value.key, ON)).rejects.toBeInstanceOf(ApiKeyRefused)
  })

  it('rotates: new key works, old key refused, name and scopes kept, audited, and a stranger cannot rotate', async () => {
    const { deps, rows, audits } = rig([{ id: 1, roles: ['admin'] }, { id: 2, roles: ['editor'] }], () => null)
    const made = await createApiKey(deps, asOwner(1, ['admin']), { name: 'sync', scopes: ['pages:read'], expiresInDays: 30 }, ON)
    if (made.ok === false) throw new Error(made.error)
    const stranger = await rotateApiKey(deps, asOwner(2, ['editor']), { id: 2, email: 'u2@x.com', isAdmin: false }, rows[0].id, ON)
    expect(stranger.ok).toBe(false)
    const one = { ...ON, maxPerUser: 1 }
    const rotated = await rotateApiKey(deps, asOwner(1, ['admin']), { id: 1, email: 'u1@x.com', isAdmin: true }, rows[0].id, one)
    if (rotated.ok === false) throw new Error(rotated.error)
    expect(rotated.value.row).toMatchObject({ name: 'sync', scopes: ['pages:read'], userId: 1 })
    await expect(authenticateApiKey(deps, made.value.key, ON)).rejects.toBeInstanceOf(ApiKeyRefused)
    expect((await authenticateApiKey(deps, rotated.value.key, ON)).key.scopes).toEqual(['pages:read'])
    expect(audits.some((a) => a.action === 'api-key.rotated')).toBe(true)
    // A revoked key cannot be rotated.
    const again = await rotateApiKey(deps, asOwner(1, ['admin']), { id: 1, email: 'u1@x.com', isAdmin: true }, rows[0].id, ON)
    expect(again.ok).toBe(false)
  })
})

describe('feeds', () => {
  const rows = [
    { id: 1, title: 'Hello, "world"', note: '=HYPERLINK("x")' },
    { id: 2, title: 'Line\nbreak', note: null },
  ]
  it('writes CSV with quoting and defuses formulas', () => {
    expect(csvCell('=1+1')).toBe("'=1+1")
    expect(csvCell('a,b')).toBe('"a,b"')
    const csv = toCsv(rows, ['title', 'note'])
    expect(csv.split('\r\n')[0]).toBe('id,title,note')
    expect(csv).toContain('"Hello, ""world"""')
    expect(csv).toContain("'=HYPERLINK")
    expect(csv).toContain('"Line\nbreak"')
  })
  it('writes JSON lines and XML', () => {
    expect(toJsonLines(rows).trim().split('\n')).toHaveLength(2)
    expect(toJsonLines([])).toBe('')
    const xml = toXml([{ id: 1, 'bad name!': '<a&b>' , list: [1, 2], nested: { x: 'y' } }], 'products')
    expect(xml).toContain('<products><item><id>1</id><bad_name_>&lt;a&amp;b&gt;</bad_name_>')
    expect(xml).toContain('<list><item>1</item><item>2</item></list>')
    expect(xml).toContain('<nested><x>y</x></nested>')
    expect(renderFeed('csv', rows, ['title'], 'r').startsWith('id,title')).toBe(true)
  })
  it('accepts the feed formats on an endpoint', () => {
    const base = { name: 'n', version: 'v1', slug: 'feed', collection: 'pages', fields: ['title'], responseFormat: 'csv' }
    const ok = validateEndpoint(base, { exposable: new Set(['title']), collectionFields: new Set(['title']) })
    expect(ok.ok && ok.value.responseFormat).toBe('csv')
  })
})

describe('field picker moves', () => {
  it('adds, removes and reorders without duplicates', () => {
    expect(addField(['a'], 'b')).toEqual(['a', 'b'])
    expect(addField(['a', 'b'], 'c', 1)).toEqual(['a', 'c', 'b'])
    expect(addField(['a'], 'a')).toEqual(['a'])
    expect(removeField(['a', 'b'], 'a')).toEqual(['b'])
    expect(moveField(['a', 'b', 'c'], 'c', 0)).toEqual(['c', 'a', 'b'])
    expect(moveField(['a', 'b', 'c'], 'a', 9)).toEqual(['b', 'c', 'a'])
    expect(moveField(['a'], 'zz', 0)).toEqual(['a'])
  })
})

describe('category rules on endpoints', () => {
  const endpoint = { enabled: true, collection: 'pages', allowCreate: false, allowUpdate: false, allowDelete: false, allowedKeyIds: null, allowedCategoryIds: [7], requiredRole: 'any' as const }
  it('lets only listed categories call an endpoint', () => {
    const call = (categoryId: number | null) => decideEndpointAccess({ endpoint, method: 'GET', keyId: 1, keyScopes: ['*:read'], roles: [], categoryId })
    expect(call(7).ok).toBe(true)
    expect(call(8).ok).toBe(false)
    expect(call(null).ok).toBe(false)
    expect(decideEndpointAccess({ endpoint: { ...endpoint, allowedCategoryIds: null }, method: 'GET', keyId: 1, keyScopes: ['*:read'], roles: [] }).ok).toBe(true)
  })
  it('validates category ids on save', () => {
    const base = { name: 'n', version: 'v1', slug: 'cats', collection: 'pages', fields: ['title'], allowedCategoryIds: [3, 3] }
    const ctx = { exposable: new Set(['title']), collectionFields: new Set(['title']), categoryIds: new Set([3]) }
    const ok = validateEndpoint(base, ctx)
    expect(ok.ok && ok.value.allowedCategoryIds).toEqual([3])
    expect(validateEndpoint({ ...base, allowedCategoryIds: [4] }, ctx).ok).toBe(false)
    const none = validateEndpoint({ ...base, allowedCategoryIds: [] }, ctx)
    expect(none.ok && none.value.allowedCategoryIds).toBeNull()
  })
  it('shows a customer only the endpoints their account can call', () => {
    const e = (over: Partial<ApiEndpoint>): ApiEndpoint =>
      ({ id: 1, name: 'n', description: '', version: 'v1', slug: 's', collection: 'pages', fields: ['title'], filters: [], sortable: [], defaultSort: null, defaultLimit: 20, maxLimit: 50, allowCreate: false, allowUpdate: false, allowDelete: false, customKinds: {}, requiredRole: 'any', allowedKeyIds: null, rateLimitPerMinute: 60, enabled: true, responseFormat: 'envelope', createdAt: 'x', updatedAt: 'x', ...over }) as ApiEndpoint
    const list = [e({ slug: 'open' }), e({ slug: 'off', enabled: false }), e({ slug: 'staff', requiredRole: 'staff' }), e({ slug: 'cat', allowedCategoryIds: [9] }), e({ slug: 'orders', collection: 'orders' })]
    const seen = endpointsForAccount(list, { roles: ['customer'], categoryId: 7, categoryScopes: ['pages:read'] }).map((x) => x.slug)
    expect(seen).toEqual(['open'])
    expect(endpointsForAccount(list, { roles: ['customer'], categoryId: 9, categoryScopes: ['pages:read'] }).map((x) => x.slug)).toEqual(['open', 'cat'])
  })
})
