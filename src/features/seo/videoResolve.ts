/**
 * Fills in what the page's video elements do not carry, for VideoObject data:
 * the Vimeo thumbnail (Vimeo's public oEmbed endpoint, cached for an hour, two
 * second timeout, no thumbnail on any failure), the absolute poster picture of an
 * uploaded file, and the media item's date as the upload date. Never throws.
 */

import { parseVideoUrl } from '@/components/blocks/elements/videoUrl'
import { absoluteUrl } from './settings'
import type { VideoElementFact, VideoResolvedFact } from './videoNodes'

const OEMBED_TTL_MS = 60 * 60 * 1000
const OEMBED_TIMEOUT_MS = 2000
const oembedCache = new Map<string, { at: number; thumbnailUrl: string | null }>()

/** Vimeo's thumbnail for a video page url, or null. Cached per url for an hour. */
export async function vimeoThumbnailUrl(videoPageUrl: string, now: number = Date.now()): Promise<string | null> {
  const cached = oembedCache.get(videoPageUrl)
  if (cached && now - cached.at < OEMBED_TTL_MS) return cached.thumbnailUrl
  let thumbnailUrl: string | null = null
  try {
    const response = await fetch(`https://vimeo.com/api/oembed.json?url=${encodeURIComponent(videoPageUrl)}`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(OEMBED_TIMEOUT_MS),
    })
    if (response.ok) {
      const data = (await response.json()) as { thumbnail_url?: unknown }
      if (typeof data.thumbnail_url === 'string' && /^https:\/\//.test(data.thumbnail_url)) thumbnailUrl = data.thumbnail_url
    }
  } catch {
    thumbnailUrl = null
  }
  oembedCache.set(videoPageUrl, { at: now, thumbnailUrl })
  return thumbnailUrl
}

export type VideoResolveOptions = {
  /** The site's absolute base url, for relative poster paths. */
  baseUrl: string
  /** The creation date of a media item, or undefined. */
  mediaDate: (id: number) => Promise<string | undefined>
}

/** Adds the thumbnail and upload date each video element needs for VideoObject. */
export async function resolveVideoFacts(facts: VideoElementFact[], options: VideoResolveOptions): Promise<VideoResolvedFact[]> {
  const out: VideoResolvedFact[] = []
  for (const fact of facts) {
    // A picked file has a path on this site (/api/media/file/...); give it the site's origin so it parses as a URL.
    const mediaUrl = fact.mediaUrl ? absoluteUrl(fact.mediaUrl, options.baseUrl) : undefined
    const resolved: VideoResolvedFact = { ...fact, ...(mediaUrl ? { mediaUrl } : {}) }
    try {
      const source = parseVideoUrl(mediaUrl || fact.url)
      if (source?.kind === 'vimeo') {
        const id = source.src.split('/video/')[1]?.split('?')[0]
        const thumbnail = id ? await vimeoThumbnailUrl(`https://vimeo.com/${id}`) : null
        if (thumbnail) resolved.thumbnailUrl = thumbnail
      } else if (source?.kind === 'file' && fact.posterUrl) {
        resolved.thumbnailUrl = absoluteUrl(fact.posterUrl, options.baseUrl)
      }
      if (fact.mediaId !== undefined) {
        const date = await options.mediaDate(fact.mediaId)
        if (date) resolved.uploadDate = date
      }
    } catch {
      // Keep the element as it is; it simply gets no node when a field is missing.
    }
    out.push(resolved)
  }
  return out
}
