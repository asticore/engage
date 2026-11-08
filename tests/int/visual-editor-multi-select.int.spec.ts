import { describe, expect, it } from 'vitest'

import type { SectionNode } from '@/lib/sectionTree'
import { CLIPBOARD_FORMAT } from '@/views/visualEditor/editorClipboard'
import { serializeNodes } from '@/views/visualEditor/editorClipboard'
import {
  comparePaths,
  deleteNodes,
  deleteOrder,
  duplicateNodes,
  nodesForCopy,
  pasteStyleToNodes,
  rangeInContainer,
  splitLocked,
  toggleInSelection,
  topLevelPaths,
} from '@/views/visualEditor/multiSelect'
import { getNode } from '@/views/visualEditor/treeOps'

const el = (id: string, extra: Record<string, unknown> = {}): SectionNode => ({ _id: id, blockType: 'element', elementType: 'heading', props: { text: id }, ...extra }) as unknown as SectionNode
const section = (id: string, blocks: SectionNode[]): SectionNode => ({ _id: id, blockType: 'section', columns: [{ _id: `${id}c`, blocks }] }) as unknown as SectionNode
const ids = (nodes: SectionNode[]) => nodes.map((n) => n._id)

let counter = 0
const makeId = () => `new-${++counter}`

describe('selection helpers', () => {
  it('toggles in document order and ignores columns', () => {
    let sel = toggleInSelection([], [2])
    sel = toggleInSelection(sel, [0])
    expect(sel).toEqual([[0], [2]])
    sel = toggleInSelection(sel, [2])
    expect(sel).toEqual([[0]])
    expect(toggleInSelection(sel, [0, 0])).toEqual([[0]])
  })

  it('selects a range inside one container only', () => {
    expect(rangeInContainer([0, 0, 1], [0, 0, 3])).toEqual([[0, 0, 1], [0, 0, 2], [0, 0, 3]])
    expect(rangeInContainer([0, 0, 3], [0, 0, 1])).toEqual([[0, 0, 1], [0, 0, 2], [0, 0, 3]])
    expect(rangeInContainer([0, 0, 1], [1, 0, 3])).toEqual([[1, 0, 3]])
    expect(rangeInContainer(null, [4])).toEqual([[4]])
  })

  it('drops descendants of a selected path and orders deepest/highest first for delete', () => {
    expect(topLevelPaths([[0, 0, 1], [0], [2], [2]])).toEqual([[0], [2]])
    expect(deleteOrder([[0], [0, 0, 1], [1], [0, 0, 0]])).toEqual([[1], [0]])
    expect(deleteOrder([[0, 0, 0], [0, 0, 2], [3]])).toEqual([[3], [0, 0, 2], [0, 0, 0]])
    expect(comparePaths([0], [0, 0, 0])).toBeLessThan(0)
  })

  it('splits locked paths', () => {
    const { allowed, skipped } = splitLocked([[0], [1], [2]], (p) => p[0] === 1)
    expect(allowed).toEqual([[0], [2]])
    expect(skipped).toEqual([[1]])
  })
})

describe('bulk operations', () => {
  const tree = () => [el('a'), el('b'), section('s', [el('x'), el('y'), el('z')]), el('c')]

  it('deletes several blocks across levels keeping paths valid', () => {
    const next = deleteNodes(tree(), [[0], [2, 0, 1], [3], [2, 0, 0]])
    expect(ids(next)).toEqual(['b', 's'])
    expect(ids(next[1].columns![0].blocks as SectionNode[])).toEqual(['z'])
  })

  it('deleting a section and a block inside it removes the section once', () => {
    const next = deleteNodes(tree(), [[2], [2, 0, 1]])
    expect(ids(next)).toEqual(['a', 'b', 'c'])
  })

  it('duplicates each block after its original with fresh ids', () => {
    const next = duplicateNodes(tree(), [[0], [2, 0, 2], [1]], makeId)
    expect(next.map((n) => (n as unknown as { props?: { text: string } }).props?.text ?? 'section')).toEqual(['a', 'a', 'b', 'b', 'section', 'c'])
    expect(new Set(ids(next)).size).toBe(next.length)
    const inner = next[4].columns![0].blocks as SectionNode[]
    expect(inner.length).toBe(4)
  })

  it('pastes a style onto every block, keeping each anchor id', () => {
    const t = [el('a', { design: { anchorId: 'one' } }), el('b')]
    const next = pasteStyleToNodes(t, [[0], [1]], { bgColor: 'red' } as never)
    expect((next[0].design as Record<string, unknown>).bgColor).toBe('red')
    expect((next[0].design as Record<string, unknown>).anchorId).toBe('one')
    expect((next[1].design as Record<string, unknown>).bgColor).toBe('red')
  })

  it('serializes the top-level selection in document order', () => {
    const t = tree()
    const nodes = nodesForCopy(t, [[3], [2, 0, 1], [0], [2]])
    expect(ids(nodes)).toEqual(['a', 's', 'c'])
    const out = serializeNodes(nodes)
    expect(out?.count).toBe(3)
    const payload = JSON.parse(out!.text)
    expect(payload.format).toBe(CLIPBOARD_FORMAT)
    expect(payload.tree).toHaveLength(3)
    expect(payload.tree[0]._id).toBeUndefined()
    expect(serializeNodes([])).toBeNull()
    expect(getNode(t, [2, 0, 1])?._id).toBe('y')
  })
})
