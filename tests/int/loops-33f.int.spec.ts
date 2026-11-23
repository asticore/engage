// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { archiveFilterSection, loopCardBlocks, loopGridSection, parseLoopRequest, placeLoopOnArchive } from '@/features/siteTemplates/loops'
import type { SectionNode } from '@/lib/sectionTree'

describe('named loops', () => {
  it('needs a name and a source and clamps numbers', () => {
    expect(parseLoopRequest({ source: 'posts' }).ok).toBe(false)
    expect(parseLoopRequest({ name: 'A', source: 'x' }).ok).toBe(false)
    const ok = parseLoopRequest({ name: 'A', source: 'products', count: 500, columns: 0, placeOn: ['archive-shop', 'bad', 'archive-shop'] }) as { ok: true; value: { count: number; columns: number; placeOn: string[] } }
    expect(ok.value).toMatchObject({ count: 48, columns: 1, placeOn: ['archive-shop'] })
  })

  it('makes a card per source', () => {
    expect(JSON.stringify(loopCardBlocks('products'))).toContain('product-price')
    expect(JSON.stringify(loopCardBlocks('posts'))).toContain('post-excerpt')
  })

  const req = (parseLoopRequest({ name: 'L', source: 'products', category: 'Shoes', orderBy: 'price-asc' }) as { value: Parameters<typeof loopGridSection>[1] }).value
  const slot: SectionNode = { blockType: 'section', columns: [{ width: 12, blocks: [{ blockType: 'element', elementType: 'content-slot', props: {} }] }] } as SectionNode
  const head: SectionNode = { blockType: 'section', columns: [{ width: 12, blocks: [{ blockType: 'element', elementType: 'heading', props: {} }] }] } as SectionNode

  it('replaces the plain list with the loop grid and carries the query', () => {
    const grid = loopGridSection(7, req)
    const out = placeLoopOnArchive([head, slot], grid)
    expect(out.replaced).toBe(true)
    expect(out.blocks).toHaveLength(2)
    expect(JSON.stringify(out.blocks[1])).toContain('"loopTemplate":"7"')
    expect(JSON.stringify(out.blocks[1])).toContain('"orderBy":"price-asc"')
  })

  it('appends when there is no plain list and never places the same loop twice', () => {
    const grid = loopGridSection(7, req)
    const once = placeLoopOnArchive([head], grid)
    expect(once.blocks).toHaveLength(2)
    expect(placeLoopOnArchive(once.blocks, grid).already).toBe(true)
  })
})

describe('archive filter with the loop (leftover 5)', () => {
  it('places the filter above the grid and still dedupes by loop', () => {
    const req2 = (parseLoopRequest({ name: 'L', source: 'products' }) as { value: Parameters<typeof loopGridSection>[1] }).value
    const parts = [archiveFilterSection('products'), loopGridSection(9, req2)]
    const out = placeLoopOnArchive([], parts)
    expect(out.blocks).toHaveLength(2)
    expect(JSON.stringify(out.blocks[0])).toContain('archive-filter')
    expect(placeLoopOnArchive(out.blocks, parts).already).toBe(true)
  })
})
