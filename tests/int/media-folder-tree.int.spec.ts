import { describe, expect, it } from 'vitest'

import { breadcrumb, buildFolderTree, checkFolderMove, droppedPath, leafOf, parentOf, remapFolder } from '@/features/media/folderTree'

describe('media folder tree', () => {
  it('builds nested counts', () => {
    const t = buildFolderTree([{ folder: '', count: 2 }, { folder: 'a', count: 1 }, { folder: 'a/b', count: 3 }, { folder: 'c', count: 4 }])
    expect(t.rootCount).toBe(2)
    expect(t.total).toBe(10)
    expect(t.roots.map((r) => [r.name, r.own, r.total])).toEqual([['a', 1, 4], ['c', 4, 4]])
    expect(t.roots[0].children[0]).toMatchObject({ path: 'a/b', own: 3, total: 3 })
  })
  it('remaps paths by prefix only at a slash boundary', () => {
    expect(remapFolder('a', 'a', 'x/a')).toBe('x/a')
    expect(remapFolder('a/b', 'a', 'z')).toBe('z/b')
    expect(remapFolder('ab', 'a', 'z')).toBeNull()
    expect(remapFolder('a/b', 'a', '')).toBe('b')
  })
  it('names parents, leaves and crumbs', () => {
    expect(parentOf('a/b/c')).toBe('a/b')
    expect(parentOf('a')).toBe('')
    expect(leafOf('a/b')).toBe('b')
    expect(breadcrumb('a/b')).toEqual([{ name: 'a', path: 'a' }, { name: 'b', path: 'a/b' }])
    expect(droppedPath('a/b', 'c')).toBe('c/b')
    expect(droppedPath('a/b', '')).toBe('b')
  })
  it('refuses bad moves', () => {
    expect(checkFolderMove('a', 'a/b').ok).toBe(false)
    expect(checkFolderMove('a', 'a').ok).toBe(false)
    expect(checkFolderMove('a', '').ok).toBe(false)
    expect(checkFolderMove('a', 'b!')).toMatchObject({ ok: false })
    expect(checkFolderMove('a', ' x / y ')).toEqual({ ok: true, to: 'x/y' })
  })
})
