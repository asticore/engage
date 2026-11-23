import React from 'react'

import { FaqList } from '@/components/FaqList'
import type { Faq } from '@/engage-types'

import { faqTypePath, type FaqType } from './archive'

/** Search box, type chips and the matching questions. Shared by /faq and /faq/category/[slug]. */
export function FaqBrowser({ faqs, types, q, activeSlug, layout, groupByCategory }: { faqs: Faq[]; types: FaqType[]; q: string; activeSlug?: string; layout: 'accordion' | 'list'; groupByCategory: boolean }) {
  const action = activeSlug ? faqTypePath(activeSlug) : '/faq'
  return (
    <div>
      <form action={action} method="get" role="search" className="mb-4 flex max-w-[640px] gap-2">
        <input type="search" name="q" defaultValue={q} placeholder="Search questions" aria-label="Search questions" className="min-w-0 flex-1 border border-[var(--color-line)] bg-transparent px-3 py-2" />
        <button type="submit" className="border border-[var(--color-line)] px-4 py-2">Search</button>
      </form>
      {types.length > 1 && (
        <nav aria-label="Types of question" className="mb-8 flex flex-wrap gap-2">
          <a href={q ? `/faq?q=${encodeURIComponent(q)}` : '/faq'} aria-current={activeSlug ? undefined : 'page'} className="border border-[var(--color-line)] px-3 py-1 text-sm">All</a>
          {types.map((t) => (
            <a key={t.slug} href={`${faqTypePath(t.slug)}${q ? `?q=${encodeURIComponent(q)}` : ''}`} aria-current={activeSlug === t.slug ? 'page' : undefined} className="border border-[var(--color-line)] px-3 py-1 text-sm">
              {t.name} ({t.count})
            </a>
          ))}
        </nav>
      )}
      {faqs.length === 0 ? <p className="empty-state">{q ? 'No questions match your search.' : 'No questions here yet.'}</p> : <FaqList faqs={faqs} layout={layout} groupByCategory={groupByCategory} />}
    </div>
  )
}
