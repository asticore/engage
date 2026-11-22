import { describe, expect, it } from 'vitest'

import type { SectionNode } from '@/lib/sectionTree'
import { convertNode, convertibleKinds, definitionPairs, tableSeparator } from '@/views/visualEditor/convertText'
import { plainTextToLexical } from '@/views/visualEditor/richTextUtil'

const textNode = (paragraphs: string[]): SectionNode =>
  ({ blockType: 'element', elementType: 'text-editor', _id: 'a1', props: { content: plainTextToLexical(paragraphs.join('\n\n')) } }) as unknown as SectionNode

describe('convert text block (task 16h)', () => {
  it('offers lists for several lines and nothing for one', () => {
    expect(convertibleKinds(textNode(['Only one']))).toEqual([])
    expect(convertibleKinds(textNode(['Mix', 'Fry']))).toEqual(['bullets', 'numbers'])
    expect(convertibleKinds({ blockType: 'element', elementType: 'heading', props: {} } as unknown as SectionNode)).toEqual([])
  })

  it('makes a list and strips existing markers', () => {
    const out = convertNode(textNode(['1. Mix flour', '- Add milk']), 'numbers') as unknown as { elementType: string; _id: string; props: { items: { text: string }[]; marker: string } }
    expect(out.elementType).toBe('list')
    expect(out._id).toBe('a1')
    expect(out.props.marker).toBe('numbers')
    expect(out.props.items.map((i) => i.text)).toEqual(['Mix flour', 'Add milk'])
  })

  it('makes a definition list from Term: description lines', () => {
    expect(definitionPairs(['Prep: 10 minutes', 'Cook: 30 minutes'])).toEqual([{ term: 'Prep', definition: '10 minutes' }, { term: 'Cook', definition: '30 minutes' }])
    expect(definitionPairs(['Prep: 10 minutes', 'no colon here'])).toBeNull()
    const out = convertNode(textNode(['Prep: 10 minutes', 'Cook: 30 minutes']), 'definitions') as unknown as { elementType: string; props: { items: unknown[] } }
    expect(out.elementType).toBe('definition-list')
    expect(out.props.items).toHaveLength(2)
  })

  it('makes a table only when every line has the same cells', () => {
    expect(tableSeparator(['a | b', 'c | d'])).toBe('|')
    expect(tableSeparator(['a | b', 'c'])).toBeNull()
    const out = convertNode(textNode(['Day | Hours', 'Mon | 9, to 5']), 'table') as unknown as { elementType: string; props: { rows: string; headerRow: boolean } }
    expect(out.elementType).toBe('table')
    expect(out.props.rows).toBe('Day,Hours\nMon,"9, to 5"')
    expect(convertNode(textNode(['one', 'two']), 'table')).toBeNull()
  })
})
