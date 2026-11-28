// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { faqQuestionPath, faqTypes, faqTypeSlug, filterFaqs, relatedFaqs } from '../../src/features/faq/archive'

const faqs = [
  { category: 'Shipping', question: 'How long is delivery?', answer: 'Three to five days.' },
  { category: 'Shipping', question: 'Do you ship abroad?', answer: { root: { children: [{ text: 'Yes, to the EU.' }] } } },
  { category: '', question: 'Who are you?', answer: 'A small team.' },
] as never[]

describe('faq archive helpers', () => {
  it('groups types and counts them', () => {
    expect(faqTypes(faqs)).toEqual([
      { name: 'Shipping', slug: 'shipping', count: 2 },
      { name: 'General', slug: 'general', count: 1 },
    ])
  })
  it('filters by type', () => {
    expect(filterFaqs(faqs, { type: 'shipping' })).toHaveLength(2)
    expect(filterFaqs(faqs, { type: faqTypeSlug('General') })).toHaveLength(1)
  })
  it('searches questions and rich answers, every word', () => {
    expect(filterFaqs(faqs, { q: 'abroad' })).toHaveLength(1)
    expect(filterFaqs(faqs, { q: 'EU yes' })).toHaveLength(1)
    expect(filterFaqs(faqs, { q: 'delivery team' })).toHaveLength(0)
  })
  it('finds related questions of the same type, not the question itself', () => {
    const rows = [
      { id: 1, category: 'Shipping', question: 'A?' },
      { id: 2, category: 'Shipping', question: 'B?' },
      { id: 3, category: 'Shipping', question: 'C?' },
      { id: 4, category: '', question: 'D?' },
    ]
    expect(relatedFaqs(rows as never[], rows[0] as never, 1).map((r: { id: number }) => r.id)).toEqual([2])
    expect(relatedFaqs(rows as never[], rows[3] as never)).toEqual([])
  })
  it('links to the overview filtered to the question', () => {
    expect(faqQuestionPath(' Do you ship abroad? ')).toBe('/faq?q=Do%20you%20ship%20abroad%3F')
  })
})
