import { parseVideoUrl } from '@/components/blocks/elements/videoUrl'

/**
 * VideoObject structured data for the `video` elements on a page. Pure: the page
 * data comes in as plain objects (videoResolve.ts looks up what is not on the
 * page: the Vimeo thumbnail and the media item date). A video is described only
 * when its name, thumbnail and upload date can all be worked out:
 * - YouTube: the thumbnail is the video's own picture;
 * - Vimeo: the thumbnail comes from Vimeo's oEmbed (resolved beforehand);
 * - an uploaded file: the thumbnail is the poster picture chosen for it.
 * The upload date is the media item's date when the video is a media item, and
 * otherwise the page's publish date.
 */

type JsonLdNode = Record<string, unknown>

/** Most video nodes per page. */
export const MAX_VIDEO_NODES = 10

export type VideoElementFact = {
  url: string
  title: string
  caption: string
  /** The media library file picked for the element (upload or video link), when there is one. */
  mediaUrl?: string
  mediaId?: number
  /** The poster picture of the element, when one is picked. */
  posterUrl?: string
}

/** A video element with what the page does not carry filled in by videoResolve.ts. */
export type VideoResolvedFact = VideoElementFact & { thumbnailUrl?: string; uploadDate?: string }

const str = (value: unknown): string => (typeof value === 'string' ? value.trim() : '')

/** The url and numeric id of a media reference (a populated media item or a bare id). */
export function mediaRefOf(value: unknown): { url?: string; id?: number } {
  if (typeof value === 'number' && Number.isFinite(value)) return { id: value }
  if (!value || typeof value !== 'object') return {}
  const record = value as { url?: unknown; id?: unknown }
  const out: { url?: string; id?: number } = {}
  if (typeof record.url === 'string' && record.url.trim()) out.url = record.url.trim()
  if (typeof record.id === 'number' && Number.isFinite(record.id)) out.id = record.id
  return out
}

/** Every `video` element found anywhere in the page's blocks or layout, in order. */
export function videoElementsOf(doc: Record<string, unknown>): VideoElementFact[] {
  const found: VideoElementFact[] = []
  const walk = (value: unknown, depth: number): void => {
    if (depth > 12 || found.length >= MAX_VIDEO_NODES) return
    if (Array.isArray(value)) {
      for (const item of value) walk(item, depth + 1)
      return
    }
    if (!value || typeof value !== 'object') return
    const record = value as Record<string, unknown>
    if (record.blockType === 'element' && record.elementType === 'video') {
      const props = record.props && typeof record.props === 'object' ? (record.props as Record<string, unknown>) : {}
      const fact: VideoElementFact = { url: str(props.url), title: str(props.title), caption: str(props.caption) }
      const picked = mediaRefOf(props.video)
      if (picked.url) fact.mediaUrl = picked.url
      if (picked.id !== undefined) fact.mediaId = picked.id
      const poster = mediaRefOf(props.poster).url
      if (poster) fact.posterUrl = poster
      found.push(fact)
      return
    }
    for (const item of Object.values(record)) walk(item, depth + 1)
  }
  walk(doc.blocks, 0)
  walk(doc.layout, 0)
  return found
}

/** VideoObject nodes for the page's video elements that have everything Google needs. */
export function videoObjectNodes(
  elements: VideoResolvedFact[],
  page: { title: string; description?: string; publishedDate?: string },
): JsonLdNode[] {
  const nodes: JsonLdNode[] = []
  for (const element of elements) {
    const source = parseVideoUrl(element.mediaUrl || element.url)
    if (!source) continue
    const name = element.title || element.caption || page.title
    const uploadDate = element.uploadDate || page.publishedDate
    const videoId = source.kind === 'youtube' ? source.src.split('/embed/')[1] : undefined
    const thumbnailUrl = source.kind === 'youtube' && videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : element.thumbnailUrl
    if (!name || !uploadDate || !thumbnailUrl) continue
    const node: JsonLdNode = {
      '@type': 'VideoObject',
      name,
      thumbnailUrl,
      uploadDate,
    }
    if (source.kind === 'file') node.contentUrl = source.src
    else node.embedUrl = source.src
    const description = element.caption || page.description
    if (description) node.description = description
    nodes.push(node)
    if (nodes.length >= MAX_VIDEO_NODES) break
  }
  return nodes
}
