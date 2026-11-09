/** Pure model behind the Elements panel: category list (merged, no empties) and search ranking. */

type CardLike = { slug: string; label: string; description: string; category: string }
type CategoryLike = { key: string; label: string }

export type LibraryCategory = { key: string; label: string; /** Every card category this entry covers. */ keys: string[]; count: number }

/** "Layout elements" and "Layout" are the same thing to a person choosing a filter. */
const baseLabel = (label: string): string => label.replace(/\s+elements$/i, '').trim().toLowerCase()

/**
 * The category filter entries: categories that share a name (after dropping a trailing "elements") are
 * merged into one entry, and entries with no cards are left out.
 */
export function libraryCategories(categories: readonly CategoryLike[], cards: readonly CardLike[]): LibraryCategory[] {
  const counts = new Map<string, number>()
  for (const card of cards) counts.set(card.category, (counts.get(card.category) ?? 0) + 1)
  const merged = new Map<string, LibraryCategory>()
  for (const cat of categories) {
    const count = counts.get(cat.key) ?? 0
    if (count === 0) continue
    const id = baseLabel(cat.label)
    const existing = merged.get(id)
    if (existing) {
      existing.keys.push(cat.key)
      existing.count += count
    } else {
      merged.set(id, { key: cat.key, label: cat.label.replace(/\s+elements$/i, ''), keys: [cat.key], count })
    }
  }
  return Array.from(merged.values())
}

const words = (text: string): string[] => text.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean)

/** How well one search word matches a card: label first, then slug (keywords), descriptions only as whole words. */
const tokenScore = (card: CardLike, token: string): number => {
  const label = card.label.toLowerCase()
  if (label === token) return 100
  const labelWords = words(card.label)
  if (labelWords[0]?.startsWith(token)) return 90
  if (labelWords.some((w) => w.startsWith(token))) return 80
  const slugWords = words(card.slug.replace(/^element:/, ''))
  if (slugWords.some((w) => w === token)) return 70
  if (slugWords.some((w) => w.startsWith(token))) return 60
  if (token.length >= 3 && label.includes(token)) return 40
  if (words(card.description).includes(token)) return 10
  return 0
}

/** Cards matching `query` (every word must match), best match first. Empty query: all cards, unchanged order. */
export function rankCards<T extends CardLike>(cards: readonly T[], query: string): T[] {
  const tokens = words(query)
  if (tokens.length === 0) return [...cards]
  const scored: { card: T; score: number; index: number }[] = []
  cards.forEach((card, index) => {
    let total = 0
    for (const token of tokens) {
      const s = tokenScore(card, token)
      if (s === 0) return
      total += s
    }
    scored.push({ card, score: total, index })
  })
  return scored.sort((a, b) => b.score - a.score || a.index - b.index).map((x) => x.card)
}
