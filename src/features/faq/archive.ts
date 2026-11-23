import { slugify } from '@/utilities/formatSlug'
import type { Faq } from '@/engage-types'

/** The FAQ overview works like the blog archive: a search box and "types of question" taken from each FAQ's Category. */

export type FaqType = { name: string; slug: string; count: number }

export const FAQ_GENERAL = 'General'

export const faqTypeName = (faq: Pick<Faq, 'category'>): string => (faq.category || '').trim() || FAQ_GENERAL

export const faqTypeSlug = (name: string): string => slugify(name) || 'general'

export const faqTypePath = (slug: string): string => `/faq/category/${slug}`

/** Every type of question in use, in the order the questions first use them. */
export function faqTypes(faqs: Pick<Faq, 'category'>[]): FaqType[] {
  const map = new Map<string, FaqType>()
  for (const faq of faqs) {
    const name = faqTypeName(faq)
    const slug = faqTypeSlug(name)
    const hit = map.get(slug)
    if (hit) hit.count += 1
    else map.set(slug, { name, slug, count: 1 })
  }
  return [...map.values()]
}

const plain = (value: unknown): string => {
  if (typeof value === 'string') return value
  if (Array.isArray(value)) return value.map(plain).join(' ')
  if (value && typeof value === 'object') return Object.values(value).map(plain).join(' ')
  return ''
}

/** Keeps the FAQs matching a search (every word, in the question or answer) and, if given, one type. */
export function filterFaqs<T extends Pick<Faq, 'category' | 'question' | 'answer'>>(faqs: T[], options: { q?: string; type?: string }): T[] {
  const words = (options.q || '').toLowerCase().split(/\s+/).filter(Boolean)
  return faqs.filter((faq) => {
    if (options.type && faqTypeSlug(faqTypeName(faq)) !== options.type) return false
    if (!words.length) return true
    const hay = `${faq.question} ${plain(faq.answer)}`.toLowerCase()
    return words.every((w) => hay.includes(w))
  })
}
