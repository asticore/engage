import { slugify } from '@/utilities/formatSlug'
import type { Faq } from '@/engage-types'

/** The FAQ overview works like the blog archive: a search box and "types of question" taken from each FAQ's Category. */

/** A FAQ read for a language: `typeKey` is the type name in the site language, so the type address stays the same in every language. */
export type FaqKeyed = { typeKey?: string }

/** Translated FAQs with each type's untranslated name kept as the key for the address. */
export function keepTypeKeys<T extends Pick<Faq, 'category'>>(source: Pick<Faq, 'category'>[], translated: T[]): (T & FaqKeyed)[] {
  return translated.map((faq, i) => ({ ...faq, typeKey: faqTypeName(source[i] ?? faq) }))
}

export type FaqType = { name: string; slug: string; count: number }

export const FAQ_GENERAL = 'General'

export const faqTypeName = (faq: Pick<Faq, 'category'>): string => (faq.category || '').trim() || FAQ_GENERAL

/** Address key of a FAQ's type (its site-language name, whatever the shown language). */
export const faqSlugOf = (faq: Pick<Faq, 'category'> & FaqKeyed): string => faqTypeSlug(faq.typeKey ?? faqTypeName(faq))

export const faqTypeSlug = (name: string): string => slugify(name) || 'general'

export const faqTypePath = (slug: string): string => `/faq/category/${slug}`

/** Every type of question in use, in the order the questions first use them. */
export function faqTypes(faqs: (Pick<Faq, 'category'> & FaqKeyed)[]): FaqType[] {
  const map = new Map<string, FaqType>()
  for (const faq of faqs) {
    const name = faqTypeName(faq)
    const slug = faqSlugOf(faq)
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
export function filterFaqs<T extends Pick<Faq, 'category' | 'question' | 'answer'> & FaqKeyed>(faqs: T[], options: { q?: string; type?: string }): T[] {
  const words = (options.q || '').toLowerCase().split(/\s+/).filter(Boolean)
  return faqs.filter((faq) => {
    if (options.type && faqSlugOf(faq) !== options.type) return false
    if (!words.length) return true
    const hay = `${faq.question} ${plain(faq.answer)}`.toLowerCase()
    return words.every((w) => hay.includes(w))
  })
}

/** Link to the FAQ overview filtered to one question (the overview search matches every word of the question). */
export const faqQuestionPath = (question: string): string => `/faq?q=${encodeURIComponent(question.trim().slice(0, 200))}`

/** Other questions of the same type, in their own order, for "Related questions" under an answer. */
export function relatedFaqs<T extends Pick<Faq, 'id' | 'category' | 'question'> & FaqKeyed>(faqs: T[], faq: Pick<Faq, 'id' | 'category'> & FaqKeyed, max = 3): T[] {
  const slug = faqSlugOf(faq)
  return faqs.filter((other) => other.id !== faq.id && other.question && faqSlugOf(other) === slug).slice(0, Math.max(0, max))
}
