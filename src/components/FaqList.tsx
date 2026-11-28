import React from 'react'
import { RichText } from '@/engine/editor/react'

import type { Faq } from '@/engage-types'
import { FaqVote } from '@/features/faq/FaqVote'
import { faqQuestionPath, relatedFaqs } from '@/features/faq/archive'

export const FaqList: React.FC<{ faqs: Faq[]; layout?: 'accordion' | 'list'; groupByCategory?: boolean; showRelated?: boolean }> = ({
  faqs,
  layout = 'accordion',
  groupByCategory = false,
  showRelated = false,
}) => {
  if (!faqs.length) return null

  const groups = groupByCategory
    ? faqs.reduce<Record<string, Faq[]>>((acc, faq) => {
        const key = faq.category || 'General'
        acc[key] = acc[key] || []
        acc[key].push(faq)
        return acc
      }, {})
    : { '': faqs }

  const questionClassName = 'cursor-pointer font-[family-name:var(--font-display)] text-[1.05rem]'
  const answerClassName = 'mt-3 opacity-85'
  const related = (faq: Faq) => {
    const list = showRelated ? relatedFaqs(faqs, faq) : []
    if (!list.length) return null
    return (
      <nav aria-label="Related questions" className="mt-4 text-sm">
        <p className="mb-1 uppercase tracking-[0.08em] opacity-70">Related questions</p>
        <ul className="list-disc pl-5">
          {list.map((r) => (
            <li key={r.id}>
              <a href={faqQuestionPath(r.question)}>{r.question}</a>
            </li>
          ))}
        </ul>
      </nav>
    )
  }
  const itemClassName = 'faq-item mb-3 border border-[var(--color-line)] px-5 py-[18px]'

  return (
    <div>
      {Object.entries(groups).map(([category, items]) => (
        <div key={category || 'all'} className="mb-8">
          {category && (
            <h3 className="mb-3 text-[0.8rem] uppercase tracking-[0.08em] text-[var(--color-gold)]">
              {category}
            </h3>
          )}
          {items.map((faq) =>
            layout === 'accordion' ? (
              <details key={faq.id} className={itemClassName}>
                <summary className={questionClassName}>{faq.question}</summary>
                <div className={answerClassName}>
                  <RichText data={faq.answer} />
                  {related(faq)}
                  {showRelated && typeof faq.id === 'number' && <FaqVote id={faq.id} />}
                </div>
              </details>
            ) : (
              <div key={faq.id} className={itemClassName}>
                <h4 className={questionClassName}>{faq.question}</h4>
                <div className={answerClassName}>
                  <RichText data={faq.answer} />
                  {related(faq)}
                  {showRelated && typeof faq.id === 'number' && <FaqVote id={faq.id} />}
                </div>
              </div>
            ),
          )}
        </div>
      ))}
    </div>
  )
}
