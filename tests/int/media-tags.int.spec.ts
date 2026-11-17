import { describe, expect, it } from 'vitest'

import { chipsFor, buildTagTree, descendantIds, exportFilesCsv, exportTagsCsv, parseFilesCsv, parseTag, parseTagsCsv, pathOf, type Tag } from '@/features/mediaTags/logic'

const tags: Tag[] = [
  { id: 1, name: 'Products', parentId: null, color: '#112233' },
  { id: 2, name: 'Summer', parentId: 1, color: '#888888' },
  { id: 3, name: 'Beach', parentId: 2, color: '#888888' },
  { id: 4, name: 'Press', parentId: null, color: '#888888' },
]

describe('media tags', () => {
  it('validates a tag', () => {
    expect(parseTag({ name: '' }, tags, null).ok).toBe(false)
    expect(parseTag({ name: 'a > b' }, tags, null).ok).toBe(false)
    expect(parseTag({ name: 'X', color: 'red' }, tags, null).ok).toBe(false)
    expect(parseTag({ name: 'X', parentId: 99 }, tags, null).ok).toBe(false)
    expect(parseTag({ name: 'summer', parentId: 1 }, tags, null).ok).toBe(false) // same name in the same place
    expect(parseTag({ name: 'Summer', parentId: 4 }, tags, null).ok).toBe(true)
    expect(parseTag({ name: 'Products', parentId: 3 }, tags, 1).ok).toBe(false) // inside its own child
    const ok = parseTag({ name: ' New  tag ', parentId: '4', color: '#ABCDEF' }, tags, null)
    expect(ok.ok && ok.value).toEqual({ name: 'New tag', parentId: 4, color: '#abcdef' })
  })
  it('finds sub-tags and counts files once', () => {
    expect(descendantIds(tags, 1).sort()).toEqual([1, 2, 3])
    const tree = buildTagTree(tags, [{ mediaId: 10, tagId: 3 }, { mediaId: 10, tagId: 2 }, { mediaId: 11, tagId: 1 }])
    const products = tree.find((t) => t.id === 1)!
    expect(products.count).toBe(1)
    expect(products.total).toBe(2)
    expect(products.children[0].total).toBe(1)
  })
  it('round-trips tags and files through CSV', () => {
    expect(pathOf(tags, 3)).toBe('Products > Summer > Beach')
    const csv = exportTagsCsv(tags)
    expect(parseTagsCsv(csv).map((r) => r.path.join('>'))).toEqual(['Press', 'Products', 'Products>Summer', 'Products>Summer>Beach'])
    expect(parseTagsCsv(csv).find((r) => r.path.length === 1 && r.path[0] === 'Products')?.color).toBe('#112233')
    const files = exportFilesCsv(tags, [{ filename: 'a, b.jpg', tagIds: [3, 4] }])
    expect(parseFilesCsv(files)).toEqual([{ filename: 'a, b.jpg', paths: [['Press'], ['Products', 'Summer', 'Beach']] }])
  })
  it('makes sorted chips for a file and skips unknown tags', () => {
    const chips = chipsFor(tags, [4, 3, 99])
    expect(chips.map((c) => c.label)).toEqual(['Press', 'Beach'])
    expect(chips[1].title).toBe('Products > Summer > Beach')
    expect(chipsFor(tags, undefined)).toEqual([])
  })
})
