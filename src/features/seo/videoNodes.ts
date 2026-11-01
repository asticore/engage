import { parseVideoUrl } from '@/components/blocks/elements/videoUrl'

/**
 * VideoObject structured data for the `video` elements on a page. Pure: the page
 * data comes in as plain objects. A video is described only when its name,
 * thumbnail and upload date can all be worked out from the page. Vimeo, uploaded
 * files and any video without a thumbnail get no node (there is no thumbnail to
 * read for them).
 */

type JsonLdNode = Record<string, unknown>

/** Most video nodes per page. */
export const MAX_VIDEO_NODES = 10

export type VideoElementFact = { url: string; title: string; caption: string }

const str = (value: unknown): string => (typeof value === 'string' ? value.trim() : '')

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
      found.push({ url: str(props.url), title: str(props.title), caption: str(props.caption) })
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
  elements: VideoElementFact[],
  page: { title: string; description?: string; publishedDate?: string },
): JsonLdNode[] {
  const nodes: JsonLdNode[] = []
  for (const element of elements) {
    const source = parseVideoUrl(element.url)
    if (!source) continue
    const name = element.title || element.caption || page.title
    // The page's publish date stands in for the upload date: the element does not record its own.
    const uploadDate = page.publishedDate
    const videoId = source.kind === 'youtube' ? source.src.split('/embed/')[1] : undefined
    if (!name || !uploadDate || !videoId) continue
    const node: JsonLdNode = {
      '@type': 'VideoObject',
      name,
      thumbnailUrl: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
      uploadDate,
      embedUrl: source.src,
    }
    const description = element.caption || page.description
    if (description) node.description = description
    nodes.push(node)
    if (nodes.length >= MAX_VIDEO_NODES) break
  }
  return nodes
}
