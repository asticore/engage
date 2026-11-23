import { describe, expect, it } from 'vitest'
import { examplePresetCards, examplePresetNode, filterExamplePresetCards } from '@/views/visualEditor/libraryExamplePresets'

describe('example presets', () => {
  it('builds every card', () => {
    for (const c of examplePresetCards()) expect(examplePresetNode(c.id)?.blockType).toBe('section')
    expect(examplePresetNode('nope')).toBeNull()
  })
  it('filters by label', () => {
    expect(filterExamplePresetCards(examplePresetCards(), 'ticket').map((c) => c.id)).toEqual(['ticket-card'])
  })
})
