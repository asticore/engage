// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { faqTypes, faqTypeSlug, filterFaqs } from '../../src/features/faq/archive'

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
})
