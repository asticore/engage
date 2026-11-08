import { describe, expect, it } from 'vitest'

import type { SectionNode } from '@/lib/sectionTree'
import { collectWarnings } from '@/views/visualEditor/designWarnings'
import { uniquifyAnchors } from '@/views/visualEditor/treeOps'

const section = (anchor: string | undefined, children: SectionNode[] = [], colAnchor?: string): SectionNode => ({
  blockType: 'section',
  _id: `s-${anchor ?? 'none'}-${Math.random()}`,
  design: anchor ? { anchorId: anchor } : undefined,
  columns: [
    {
      _id: 'c0',
      design: colAnchor ? { anchorId: colAnchor } : undefined,
      blocks: children,
    },
  ],
})

const anchorsOf = (nodes: SectionNode[]): string[] => {
  const out: string[] = []
  const walk = (list: SectionNode[]) => {
    for (const node of list) {
      const a = (node.design as { anchorId?: string } | undefined)?.anchorId
      if (a) out.push(a)
      for (const column of node.columns ?? []) {
        const c = (column.design as { anchorId?: string } | undefined)?.anchorId
        if (c) out.push(c)
        walk(column.blocks ?? [])
      }
    }
  }
  walk(nodes)
  return out
}

describe('uniquifyAnchors (VE-02)', () => {
  it('renames a clashing anchor to -2 and leaves the page tree untouched', () => {
    const page = [section('contact')]
    const copy = [section('contact')]
    const out = uniquifyAnchors(page, copy)
    expect(anchorsOf(out)).toEqual(['contact-2'])
    expect(anchorsOf(page)).toEqual(['contact'])
    expect(anchorsOf(copy)).toEqual(['contact'])
  })

  it('keeps a free anchor as it is', () => {
    const out = uniquifyAnchors([section('hero')], [section('contact')])
    expect(anchorsOf(out)).toEqual(['contact'])
  })

  it('finds the first free suffix', () => {
    const page = [section('contact'), section('contact-2')]
    expect(anchorsOf(uniquifyAnchors(page, [section('contact')]))).toEqual(['contact-3'])
  })

  it('handles nested sections and column-level anchors', () => {
    const inner = section('faq', [], 'col-x')
    const page = [section('hero', [inner])]
    const incoming = [section('faq', [section('x')], 'col-x')]
    const out = uniquifyAnchors(page, incoming)
    expect(anchorsOf(out)).toEqual(['faq-2', 'col-x-2', 'x'])
  })

  it('keeps two incoming nodes with the same anchor from colliding with each other', () => {
    const out = uniquifyAnchors([], [section('promo'), section('promo'), section('promo')])
    expect(anchorsOf(out)).toEqual(['promo', 'promo-2', 'promo-3'])
  })

  it('does not add a design key to nodes that had none', () => {
    const out = uniquifyAnchors([section('a')], [{ blockType: 'element', _id: 'x' } as SectionNode])
    expect(Object.prototype.hasOwnProperty.call(out[0], 'design')).toBe(false)
  })
})

describe('duplicate CSS id warning (VE-02)', () => {
  it('flags every block that uses a duplicated anchor', () => {
    const tree: SectionNode[] = [
      { blockType: 'section', _id: 'a', design: { anchorId: 'contact' }, columns: [] },
      { blockType: 'section', _id: 'b', design: { anchorId: 'contact' }, columns: [] },
      { blockType: 'section', _id: 'c', design: { anchorId: 'unique' }, columns: [] },
    ]
    const dupes = collectWarnings(tree).filter((w) => w.message.startsWith('Duplicate CSS ID'))
    expect(dupes.map((w) => w.nodeId)).toEqual(['a', 'b'])
    expect(dupes[0].message).toBe('Duplicate CSS ID “contact”')
  })

  it('does not warn when anchors are unique', () => {
    const tree: SectionNode[] = [section('one'), section('two')]
    expect(collectWarnings(tree).some((w) => w.message.startsWith('Duplicate CSS ID'))).toBe(false)
  })
})
