import React from 'react'

import { getEngine } from '@/lib/engine'
import { getMediaConfig } from '@/features/media/settings'
import { buildImageUrl, buildSrcSet } from '@/features/media/url'
import { isVideoMimeType } from '@/features/media/formats'
import type { MediaLike } from '@/features/media/types'

import { MEDIA_PROP_KEYS, collectMediaIds, substituteMedia, type MediaRef } from './elementUtil'
import { renderElement } from './renderElement'

/**
 * Server wrapper for elements that hold pictures. The element props store media as ids (that is all the editor's
 * picker keeps); this looks the ids up once and hands renderElement the resolved {url, alt}. A missing or deleted
 * id is left as a number, which the renderers treat as "no image".
 *
 * Pictures get their delivery URL here (format and size from Media settings, and the file's own format override),
 * so block images use the optimised copy rather than the upload. Videos keep their stored address.
 */
export const ElementWithMedia = async ({ elementType, props }: { elementType: string; props: Record<string, unknown> }) => {
  const keys = MEDIA_PROP_KEYS[elementType] || []
  const ids = collectMediaIds(props, keys)
  let resolved = props
  if (ids.length > 0) {
    const engine = await getEngine()
    const config = await getMediaConfig()
    const docs = new Map<number, MediaRef>()
    await Promise.all(
      ids.slice(0, 60).map(async (id) => {
        const doc = await engine.findByID({ collection: 'media', id, depth: 0 }).catch((): null => null)
        if (!doc || typeof doc.url !== 'string') return
        const isVideo = isVideoMimeType(typeof doc.mimeType === 'string' ? doc.mimeType : null)
        const url = isVideo ? doc.url : buildImageUrl(doc as MediaLike, config)
        // Pictures also get a srcset of the sizes Media settings generates, so the browser picks the smallest adequate file.
        const srcSet = isVideo ? undefined : buildSrcSet(doc as MediaLike, config)
        docs.set(id, { id, url, alt: typeof doc.alt === 'string' ? doc.alt : null, ...(srcSet ? { srcSet } : {}) })
      }),
    )
    resolved = substituteMedia(props, keys, docs)
  }
  return <>{renderElement(elementType, resolved)}</>
}
