import { describe, expect, it } from 'vitest'
import { examplePresetCards, examplePresetNode, filterExamplePresetCards } from '@/views/visualEditor/libraryExamplePresets'

describe('example presets', () => {
  it('builds every card', () => {
    for (const c of examplePresetCards()) expect(examplePresetNode(c.id)?.blockType).toBe('section')
    expect(examplePresetNode('nope')).toBeNull()
  })
  it('blog sidebar uses the categories and tags element', () => {
    const node = examplePresetNode('blog-sidebar') as { columns: { blocks: { elementType?: string }[] }[] }
    expect(node.columns[0].blocks.filter((b) => b.elementType === 'taxonomy-list')).toHaveLength(2)
  })
  it('filters by label', () => {
    expect(filterExamplePresetCards(examplePresetCards(), 'ticket').map((c) => c.id)).toEqual(['ticket-card'])
  })
})
