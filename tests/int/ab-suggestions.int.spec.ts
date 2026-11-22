import { describe, expect, it } from 'vitest'

import { goalChoices, suggestTests } from '@/features/abTesting/suggestions'
import type { SectionNode } from '@/lib/sectionTree'

const el = (elementType: string, props: Record<string, unknown>): SectionNode => ({ blockType: 'element', elementType, props })
const section = (id: string | undefined, blocks: SectionNode[], columns = 1): SectionNode => ({
  blockType: 'section',
  ...(id ? { id } : {}),
  columns: Array.from({ length: columns }, (_, i) => ({ blocks: i === 0 ? blocks : [] })),
} as SectionNode)

describe('A/B test ideas', () => {
  it('suggests a headline test first, then a clearer button label', () => {
    const ideas = suggestTests([section('s1', [el('heading', { text: 'Welcome to our shop' }), el('button', { text: 'Learn more' })])])
    expect(ideas.map((i) => i.kind)).toEqual(['headline', 'button'])
    expect(ideas[0]).toMatchObject({ sectionId: 's1', sectionIndex: 0 })
    expect(ideas[0].title).toContain('Welcome to our shop')
    expect(ideas[1].title).toContain('Learn more')
  })
  it('is quiet about a button that already names the outcome below the first section', () => {
    const ideas = suggestTests([section('a', []), section('b', [el('button', { text: 'Get my quote' })])])
    expect(ideas).toEqual([])
  })
  it('suggests the top picture and a simpler layout', () => {
    const ideas = suggestTests([section('a', [el('image', { url: '/x.jpg' })], 3)])
    expect(ideas.map((i) => i.kind).sort()).toEqual(['image', 'layout'])
  })
  it('has no section id for an unsaved section and honours the limit', () => {
    expect(suggestTests([section(undefined, [el('heading', { text: 'Hi' })])])[0].sectionId).toBeNull()
    const many = [0, 1].map((i) => section(`s${i}`, [el('heading', { text: `H${i}` }), el('button', { text: 'Submit' }), el('image', {})], 3))
    expect(suggestTests(many, 2)).toHaveLength(2)
  })
})

describe('A/B goal picker', () => {
  it('lists the page buttons and forms as wins, and refuses unsafe links', () => {
    const tree = [
      section('s1', [
        el('button', { text: 'Book now', url: '/book?x=1' }),
        el('button', { text: 'Docs', url: 'https://example.com/docs' }),
        el('button', { text: 'Bad', url: 'javascript:alert(1)' }),
        el('button', { text: 'Quote', url: '/book?x=1' }),
        { blockType: 'form', form: 7 } as unknown as SectionNode,
      ]),
    ]
    const choices = goalChoices(tree)
    expect(choices.map((c) => c.goal)).toEqual([
      { type: 'element-clicked', selector: 'a[href="/book?x=1"]' },
      { type: 'page-visited', path: '/book' },
      { type: 'element-clicked', selector: 'a[href="https://example.com/docs"]' },
      { type: 'form-submitted', formId: '7' },
    ])
  })
})
