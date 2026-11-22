import React from 'react'

import { getEngine } from '@/lib/engine'
import { getReviews, readReviewAccounts } from '@/features/reviewSources/service'
import type { LiveReview } from '@/features/reviewSources/types'

import { ElementWithMedia } from './ElementWithMedia'
import { str } from './elementUtil'

type P = Record<string, unknown>

/** Live reviews as rows the Reviews element already knows how to draw. Pure, so it can be tested. */
export const liveReviewItems = (reviews: LiveReview[]): Record<string, unknown>[] =>
  reviews.map((r) => ({ name: r.name, rating: r.rating === null ? '' : String(r.rating), text: r.text, source: r.source }))

/**
 * `reviews` on the server: manual reviews first, then reviews from a connected Google, Facebook or Yelp source, in one
 * wall with the source shown as a badge. The provider is only called through a six hour cache, so a visit never makes
 * an API call. Review structured data is switched off whenever live reviews are shown: search engines do not accept
 * third-party reviews as markup for your own page. A failed fetch leaves the manual reviews as they were.
 */
export async function ReviewsLiveElement(props: P): Promise<React.ReactElement | null> {
  const wanted = str(props.liveSource)
  const base = <ElementWithMedia elementType="reviews" props={props} />
  if (!wanted) return base
  let live: LiveReview[] = []
  try {
    const accounts = await readReviewAccounts((await getEngine()) as never)
    const account = accounts.find((a) => a.id === wanted)
    if (account) live = await getReviews(account, str(props.liveId).trim())
  } catch {
    live = []
  }
  if (live.length === 0) return base
  const manual = Array.isArray(props.items) ? (props.items as Record<string, unknown>[]) : []
  return <ElementWithMedia elementType="reviews" props={{ ...props, items: [...manual, ...liveReviewItems(live)], jsonLd: false }} />
}
