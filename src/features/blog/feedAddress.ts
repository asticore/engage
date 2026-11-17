/**
 * Nicer feed addresses (Task 16f): `<blog>/category/<slug>/feed` and `<blog>/tag/<slug>/feed` stand for
 * `/feed.xml?category=<slug>` and `/feed.xml?tag=<slug>`. A nested category uses its last segment, the same
 * slug the archive page and the feed filter use. Pure, so the middleware and tests share it.
 */
export type FeedAddress = { query: 'category' | 'tag'; slug: string }

export function parseFeedAddress(pathname: string, blogBase: string): FeedAddress | null {
  const prefix = `/${blogBase}/`
  if (!pathname.startsWith(prefix)) return null
  const parts = pathname.slice(prefix.length).replace(/\/+$/, '').split('/').filter(Boolean)
  if (parts.length < 3 || parts[parts.length - 1] !== 'feed') return null
  const kind = parts[0]
  if (kind === 'tag' && parts.length === 3) return { query: 'tag', slug: decodeURIComponent(parts[1]) }
  if (kind === 'category') return { query: 'category', slug: decodeURIComponent(parts[parts.length - 2]) }
  return null
}

/** The feed address of an archive page, for the link readers find. */
export const feedPathFor = (kind: 'category' | 'tag', slug: string, blogBase: string): string =>
  `/${blogBase}/${kind}/${encodeURIComponent(slug)}/feed`
