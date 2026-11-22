export const REVIEW_PROVIDERS = ['google-reviews', 'facebook-reviews', 'yelp-reviews'] as const
export type ReviewProvider = (typeof REVIEW_PROVIDERS)[number]

/** A saved key for a review provider, read from the Integrations global. `token` is server-side only. */
export type ReviewAccount = {
  id: string
  provider: ReviewProvider
  label: string
  /** Default place, page or business ID. A block can override it. */
  accountId: string
  token: string
}

/** One review, normalised across providers. Everything here is safe to render publicly. */
export type LiveReview = {
  name: string
  /** 1 to 5, or null when the provider gave no star rating. */
  rating: number | null
  text: string
  date: string
  url: string
  /** Badge text such as "Google". */
  source: string
}

export const SOURCE_LABEL: Record<ReviewProvider, string> = {
  'google-reviews': 'Google',
  'facebook-reviews': 'Facebook',
  'yelp-reviews': 'Yelp',
}
