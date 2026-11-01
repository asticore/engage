/**
 * Optimise for uploaded videos: one Stream step per call (see stream.ts), with
 * the uploaded file kept until an MP4 that is smaller has been fetched and
 * written. Video links are never converted: they are already a link.
 */

import type { StoredMedia, UpdateMedia } from './library'
import { defaultStorageIO, type StorageIO } from './library'
import { effectiveVideoFormat, isVideoLinkMimeType, isVideoMimeType } from './formats'
import { advanceVideoConversion, deleteStreamCopy, type StreamCredentials, type StreamFetch } from './stream'

export type VideoOptimiseResult = {
  id: number
  status: 'converting' | 'optimised' | 'kept' | 'skipped' | 'failed' | 'needs-stream'
  reason?: string
  before: number | null
  after: number | null
}

export type VideoSettings = { outputFormat?: unknown; streamAccountId?: unknown; streamApiToken?: unknown }

/** An address Stream can fetch: absolute URLs as they are, site paths with the request origin. */
export function absoluteMediaUrl(url: string, origin: string): string | null {
  if (/^https?:\/\//i.test(url)) return url
  if (url.startsWith('/')) return `${origin}${url}`
  return null
}

export async function optimiseStoredVideo(
  doc: StoredMedia & { url?: string | null; streamUid?: string | null; conversionStatus?: string | null },
  settings: VideoSettings,
  creds: StreamCredentials | null,
  origin: string,
  deps: { update: UpdateMedia; fetch: StreamFetch; io?: StorageIO },
): Promise<VideoOptimiseResult> {
  const before = typeof doc.filesize === 'number' ? doc.filesize : null
  const result = (status: VideoOptimiseResult['status'], extra: Partial<VideoOptimiseResult> = {}): VideoOptimiseResult => ({
    id: doc.id,
    status,
    before,
    after: null,
    ...extra,
  })

  if (isVideoLinkMimeType(doc.mimeType)) return result('skipped', { reason: 'A video link is already a link, so there is nothing to convert.' })
  if (!isVideoMimeType(doc.mimeType)) return result('skipped', { reason: 'Only videos are converted here.' })
  if (doc.mimeType === 'video/mp4') return result('skipped', { reason: 'This video is already MP4.' })

  const target = effectiveVideoFormat(doc.outputFormat, settings.outputFormat)
  if (target === 'original') {
    return result('skipped', { reason: 'Choose MP4 for this video, or in the Video settings, to convert it.' })
  }
  if (target === 'webm') {
    return result('skipped', { reason: 'Cloudflare Stream does not make WebM, so this video is kept as it is.' })
  }
  if (!creds) {
    return result('needs-stream', {
      reason: 'Video conversion needs Cloudflare Stream. Add the account ID and API token under Media settings, Video.',
    })
  }

  const sourceUrl = absoluteMediaUrl(doc.url ?? '', origin)
  if (!sourceUrl || !doc.filename) return result('failed', { reason: 'This video has no public address to convert from.' })

  const step = await advanceVideoConversion(
    deps.fetch,
    creds,
    { conversionStatus: doc.conversionStatus ?? null, streamUid: doc.streamUid ?? null },
    sourceUrl,
    doc.filename,
  )

  if (step.status === 'copying' || step.status === 'downloading') {
    await deps.update(doc.id, { streamUid: step.uid, conversionStatus: step.status })
    return result('converting', {
      reason:
        step.status === 'copying'
          ? 'Stream is copying the video. Press Optimise again to check progress.'
          : 'Stream is making the MP4. Press Optimise again to check progress.',
    })
  }

  if (step.status === 'failed') {
    await deps.update(doc.id, { conversionStatus: 'failed', streamUid: null })
    if (step.uid) await deleteStreamCopy(deps.fetch, creds, step.uid)
    return result('failed', { reason: step.reason })
  }

  // Ready: fetch the MP4 and keep it only when it is smaller than the upload.
  const response = await deps.fetch(step.mp4Url).catch((): null => null)
  if (!response || !response.ok) {
    return result('converting', { reason: 'The MP4 is not ready to download yet. Press Optimise again.' })
  }
  const data = new Uint8Array(await response.arrayBuffer())
  await deleteStreamCopy(deps.fetch, creds, step.uid)

  if (!doc.filesize || data.byteLength >= doc.filesize) {
    await deps.update(doc.id, { conversionStatus: 'kept', streamUid: null })
    return result('kept', { after: data.byteLength, reason: 'The MP4 was not smaller, so the original was kept.' })
  }

  const io = deps.io ?? defaultStorageIO
  const previous = { mimeType: doc.mimeType, filesize: doc.filesize, originalSize: doc.originalSize ?? null, optimizedSize: doc.optimizedSize ?? null }
  await deps.update(doc.id, {
    mimeType: 'video/mp4',
    filesize: data.byteLength,
    originalSize: doc.originalSize ?? doc.filesize,
    optimizedSize: data.byteLength,
    conversionStatus: 'done',
    streamUid: null,
  })
  try {
    await io.put(doc.filename, data, 'video/mp4')
  } catch (error) {
    await deps.update(doc.id, { ...previous, conversionStatus: 'failed' }).catch((restoreError: unknown) =>
      console.error(`Restoring media ${doc.id} failed.`, restoreError),
    )
    throw error
  }
  return result('optimised', { after: data.byteLength })
}
