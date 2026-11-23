import type { SocialPost } from './types'

/** One entry per non-empty line (or comma separated item), trimmed. */
const list = (v: unknown): string[] =>
  typeof v === 'string' ? v.split(/[\n,]+/).map((x) => x.trim()).filter(Boolean) : []

const matchesPost = (p: SocialPost, ref: string): boolean => p.id === ref || p.url === ref || p.url.replace(/\/$/, '') === ref.replace(/\/$/, '')

/**
 * Owner moderation for a social feed, applied to the cached posts before they render:
 * `hide` removes posts by id or address, `include` keeps only posts whose caption has one of the words or hashtags
 * (empty means all), `exclude` removes posts whose caption has one, and `pin` moves posts to the top in the order listed.
 */
export function moderatePosts(posts: SocialPost[], props: Record<string, unknown>): SocialPost[] {
  const hide = list(props.hide)
  const include = list(props.include).map((w) => w.toLowerCase())
  const exclude = list(props.exclude).map((w) => w.toLowerCase())
  const pin = list(props.pin)
  let out = posts.filter((p) => !hide.some((h) => matchesPost(p, h)))
  if (include.length) out = out.filter((p) => include.some((w) => p.caption.toLowerCase().includes(w)))
  if (exclude.length) out = out.filter((p) => !exclude.some((w) => p.caption.toLowerCase().includes(w)))
  if (!pin.length) return out
  const pinned: SocialPost[] = []
  for (const ref of pin) {
    const hit = out.find((p) => matchesPost(p, ref) && !pinned.includes(p))
    if (hit) pinned.push(hit)
  }
  return [...pinned, ...out.filter((p) => !pinned.includes(p))]
}
