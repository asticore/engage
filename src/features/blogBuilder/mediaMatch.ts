/**
 * Featured image match: finds pictures already in the gallery for a post, before anyone uploads one.
 * The gallery has alt text, a caption and a file name (no tags field), so those are what is searched.
 * Pure: no I/O.
 */

export type MediaMatch = { id: number; url: string; alt: string; filename: string }

const STOP_WORDS = new Set([
  'the', 'and', 'for', 'with', 'from', 'that', 'this', 'your', 'you', 'are', 'how', 'what', 'why', 'when',
  'a', 'an', 'of', 'to', 'in', 'on', 'at', 'by', 'or', 'as', 'is', 'it', 'its', 'our', 'their', 'about',
])

/** Lowercase words of three letters or more, without stop words, once each. Up to 12 words. */
export function mediaKeywords(text: string): string[] {
  const words = text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length >= 3 && !STOP_WORDS.has(word))
  return [...new Set(words)].slice(0, 12)
}

type GalleryDoc = { id?: unknown; url?: unknown; alt?: unknown; caption?: unknown; filename?: unknown; mimeType?: unknown }

/**
 * Scores each picture by the keywords it contains: alt text counts most, then the caption, then the file name.
 * Only pictures with a score are returned, best first (ties: newer id first), at most `limit`.
 */
export function matchMedia(docs: GalleryDoc[], keywords: string[], limit = 12): MediaMatch[] {
  if (keywords.length === 0) return []
  const scored: Array<MediaMatch & { score: number }> = []
  for (const doc of docs) {
    const id = Number(doc.id)
    const mime = typeof doc.mimeType === 'string' ? doc.mimeType : ''
    if (!Number.isInteger(id) || id < 1 || !mime.startsWith('image/')) continue
    const alt = typeof doc.alt === 'string' ? doc.alt : ''
    const caption = typeof doc.caption === 'string' ? doc.caption : ''
    const filename = typeof doc.filename === 'string' ? doc.filename : ''
    const altWords = alt.toLowerCase()
    const captionWords = caption.toLowerCase()
    const fileWords = filename.toLowerCase()
    let score = 0
    for (const word of keywords) {
      if (altWords.includes(word)) score += 3
      if (captionWords.includes(word)) score += 2
      if (fileWords.includes(word)) score += 1
    }
    if (score === 0) continue
    scored.push({ id, url: typeof doc.url === 'string' ? doc.url : '', alt, filename, score })
  }
  scored.sort((a, b) => b.score - a.score || b.id - a.id)
  return scored.slice(0, limit).map(({ score: _score, ...match }) => match)
}
