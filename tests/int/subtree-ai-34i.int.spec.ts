import { describe, expect, it } from 'vitest'
import { unwrapAiReplacement, wrapForAi } from '@/features/ai/subtreeEdit'
import type { SectionNode } from '@/lib/sectionTree'

describe('34i AI on a selected element', () => {
  const button: SectionNode = { blockType: 'element', elementType: 'button', _id: 'b1', label: 'Go' }
  it('wraps an element in a one-column section keeping its id', () => {
    const w = wrapForAi(button)
    expect(w.blockType).toBe('section')
    expect(w._id).toBe('b1')
    expect(w.columns?.[0].blocks).toEqual([button])
  })
  it('leaves sections alone', () => {
    const s: SectionNode = { blockType: 'section', _id: 's', columns: [] }
    expect(wrapForAi(s)).toBe(s)
    expect(unwrapAiReplacement(s, [s])).toEqual([s])
  })
  it('unwraps the reply to the replacement blocks', () => {
    const edited = { ...button, label: 'Go now' }
    const reply: SectionNode[] = [{ blockType: 'section', columns: [{ blocks: [edited] }] }]
    expect(unwrapAiReplacement(button, reply)).toEqual([edited])
  })
})
