// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { getPlatformProxy } from 'wrangler'

import { consoleLogger } from '@/localapi/logger'
import { runInternalMigrate } from '@/migrations/runInternalMigrate'
import { categoryCrumbs, categoryUrl } from '@/features/categories/frontend'
import {
  ancestorsOf, buildTree, descendantIds, flattenTree, moveProblem, resolvePath, subtreeNames, uniqueSlug, MAX_DEPTH, type CategoryRow,
} from '@/features/categories/tree'

const row = (id: number, name: string, parentId: number | null, sortOrder = 0): CategoryRow => ({ id, scope: 'shop', name, slug: name.toLowerCase().replace(/ /g, '-'), parentId, sortOrder })
const rows = [row(1, 'Clothing', null, 1), row(2, 'Shirts', 1), row(3, 'Polo Shirts', 2), row(4, 'Homeware', null, 0)]

describe('category tree helpers', () => {
  it('orders by sort order and nests children with depth', () => {
    const flat = flattenTree(rows).map((n) => `${n.depth}:${n.name}`)
    expect(flat).toEqual(['0:Homeware', '0:Clothing', '1:Shirts', '2:Polo Shirts'])
    expect(buildTree(rows)[1].children[0].children[0].name).toBe('Polo Shirts')
  })
  it('finds descendants, ancestors and names for matching', () => {
    expect(descendantIds(rows, 1).sort()).toEqual([1, 2, 3])
    expect(ancestorsOf(rows, 3).map((r) => r.name)).toEqual(['Clothing', 'Shirts', 'Polo Shirts'])
    expect(subtreeNames(rows, 2)).toEqual(['Shirts', 'Polo Shirts'])
  })
  it('refuses cycles and too-deep moves, allows valid ones', () => {
    expect(moveProblem(rows, 1, 3)).toBe('cycle')
    expect(moveProblem(rows, 1, 1)).toBe('cycle')
    expect(moveProblem(rows, 3, null)).toBeNull()
    expect(moveProblem(rows, 9, null)).toBe('missing')
    let deep: CategoryRow[] = [row(1, 'L0', null)]
    for (let i = 1; i < MAX_DEPTH; i++) deep = [...deep, row(i + 1, `L${i}`, i)]
    expect(moveProblem([...deep, row(99, 'X', null)], 99, MAX_DEPTH)).toBe('too-deep')
  })
  it('resolves a slug alone or a correct path, and rejects a wrong path', () => {
    expect(resolvePath(rows, ['polo-shirts'])?.id).toBe(3)
    expect(resolvePath(rows, ['clothing', 'shirts', 'polo-shirts'])?.id).toBe(3)
    expect(resolvePath(rows, ['shirts', 'polo-shirts'])?.id).toBe(3)
    expect(resolvePath(rows, ['homeware', 'polo-shirts'])).toBeNull()
    expect(resolvePath(rows, ['nope'])).toBeNull()
  })
  it('makes unique slugs and builds urls and breadcrumbs', () => {
    expect(uniqueSlug(rows, 'Shirts')).toBe('shirts-2')
    expect(uniqueSlug(rows, 'Shirts', 2)).toBe('shirts')
    expect(categoryUrl('shop', rows, 3)).toBe('/shop/category/clothing/shirts/polo-shirts')
    expect(categoryUrl('blog', rows, 3)).toBe('/blog/category/polo-shirts')
    expect(categoryCrumbs('shop', rows, 2).map((c) => c.label)).toEqual(['Home', 'Shop', 'Clothing', 'Shirts'])
    expect(categoryCrumbs('shop', rows, 2).at(-1)?.url).toBe('')
  })
})

const idOf0 = (r: { ok: boolean }): number => (r as unknown as { id: number }).id

describe('category store on a real D1', () => {
  let proxy: Awaited<ReturnType<typeof getPlatformProxy<{ D1: D1Database }>>>
  let store: typeof import('@/features/categories/store')

  beforeAll(async () => {
    proxy = await getPlatformProxy<{ D1: D1Database }>({ persist: false })
    await runInternalMigrate(proxy.env.D1, consoleLogger, { baseline: false })
    vi.doMock('@/cms/db/connect', () => ({ resolveD1Binding: async () => proxy.env.D1 }))
    store = await import('@/features/categories/store')
  }, 300_000)
  afterAll(async () => {
    vi.doUnmock('@/cms/db/connect')
    await proxy.dispose()
  })

  it('adds, nests, moves, reorders, links and deletes', async () => {
    const a = await store.addCategory('shop', 'Clothing', null)
    const b = await store.addCategory('shop', 'Shirts', idOf0(a))
    const c = await store.addCategory('shop', 'Shoes', idOf0(a))
    expect([a.ok, b.ok, c.ok]).toEqual([true, true, true])
    const idOf = (r: { ok: boolean; id?: number }) => r.id as number
    const [A, B, C] = [idOf(a), idOf(b), idOf(c)]
    expect((await store.addCategory('shop', ' ', null)).ok).toBe(false)
    expect(await store.moveCategory('shop', A, B)).toEqual({ ok: false, error: 'cycle' })
    // same name in another scope is independent; same name again gets a new slug
    expect((await store.addCategory('blog', 'Clothing', null)).ok).toBe(true)
    const dup = await store.addCategory('shop', 'Clothing', null)
    expect((await store.listCategories('shop')).find((r) => r.id === (dup as { id?: number }).id)?.slug).toBe('clothing-2')

    await store.reorderCategory('shop', C, 'up')
    const kids = (await store.listCategories('shop')).filter((r) => r.parentId === A).sort((x, y) => x.sortOrder - y.sortOrder)
    expect(kids.map((r) => r.id)).toEqual([C, B])

    await store.setCategoryLinks('shop', B, [10, 11, 11])
    await store.setCategoryLinks('shop', A, [12])
    const all = await store.listCategories('shop')
    expect((await store.docIdsForSlug('shop', 'clothing'))!.sort()).toEqual([10, 11, 12])
    expect(descendantIds(all, A)).toContain(B)
    expect(await store.docIdsForSlug('shop', 'unknown')).toBeNull()

    await store.moveCategory('shop', C, null)
    expect((await store.listCategories('shop')).find((r) => r.id === C)?.parentId).toBeNull()

    await store.deleteCategory('shop', A)
    const after = await store.listCategories('shop')
    expect(after.find((r) => r.id === B)?.parentId).toBeNull()
    expect(await store.linkedDocIds([A])).toEqual([])
    expect(await store.linkedDocIds([B])).toEqual([10, 11])
  })
})
