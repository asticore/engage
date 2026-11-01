import { NextResponse } from 'next/server'

import { authorizeMedia } from '@/features/media/access'
import { IMAGES_UNAVAILABLE_MESSAGE } from '@/features/media/optimise'
import { resolveImagesBinding } from '@/features/media/imagesBinding'
import { optimiseStoredMedia } from '@/features/media/library'
import { isVideoMimeType } from '@/features/media/formats'
import { streamCredentials, type StreamFetch } from '@/features/media/stream'
import { optimiseStoredVideo, type VideoSettings } from '@/features/media/videoOptimise'
import { loadMedia, mediaUpdater, parseIdList, readJsonBody, readMediaSettings, readOptimiseSettings, type MediaEngine } from '@/features/media/store'

/** Hard ceiling on items per request, whatever Media Settings says. */
const MAX_PER_REQUEST = 25

/**
 * POST /api/admin-media-optimise  { ids: number[], force?: boolean }
 *
 * Pictures are re-encoded in place under the same filenames, so every link keeps
 * working. Videos are converted to MP4 through Cloudflare Stream, one step per
 * call (see features/media/stream.ts), and only when a Stream account and token
 * are set. A request takes at most min(bulk.batchSize, 25) items. Pictures that
 * are already optimised are skipped unless force is true.
 */
export async function POST(request: Request): Promise<Response> {
  const auth = await authorizeMedia('update')
  if (!auth.context) return auth.response

  const engine = auth.context.engine as unknown as MediaEngine
  const body = await readJsonBody(request)
  if (!body) return NextResponse.json({ error: 'Send JSON with an ids list.' }, { status: 400 })

  const settings = await readOptimiseSettings(engine)
  const cap = Math.min(settings.batchSize, MAX_PER_REQUEST)
  const ids = parseIdList(body.ids, 100)
  if (!ids) return NextResponse.json({ error: 'Choose at least one item.' }, { status: 400 })
  if (ids.length > cap) {
    return NextResponse.json(
      { error: `Optimise at most ${cap} items at a time. The batch size is set in Media settings.`, cap },
      { status: 400 },
    )
  }
  const force = body.force === true

  const videoGlobal = ((await readMediaSettings(engine))?.video ?? {}) as VideoSettings
  const creds = streamCredentials(videoGlobal)
  const origin = new URL(request.url).origin
  const fetchStream: StreamFetch = (url, init) => fetch(url, init)

  const update = mediaUpdater(engine)
  const docs = await Promise.all(ids.map((id) => loadMedia(engine, id)))
  // Anything that is not a video (or cannot be found) goes through the picture path.
  const pictures = docs.filter((doc) => !doc || !isVideoMimeType(doc.mimeType))

  // Checked before any work starts, so a refused request changes nothing.
  let binding: Awaited<ReturnType<typeof resolveImagesBinding>> = null
  if (pictures.length > 0) {
    if (!settings.enabled) {
      return NextResponse.json({ error: 'Turn on optimisation in Media settings first.' }, { status: 409 })
    }
    binding = await resolveImagesBinding()
    if (!binding) return NextResponse.json({ error: IMAGES_UNAVAILABLE_MESSAGE, code: 'images-unavailable' }, { status: 422 })
  }

  const results = []
  for (let index = 0; index < ids.length; index++) {
    const id = ids[index]
    const doc = docs[index]
    if (!doc) {
      results.push({ id, status: 'failed', reason: 'This item no longer exists.', before: null, after: null })
    } else if (isVideoMimeType(doc.mimeType)) {
      results.push(
        await optimiseStoredVideo(doc as Parameters<typeof optimiseStoredVideo>[0], videoGlobal, creds, origin, {
          update,
          fetch: fetchStream,
        }),
      )
    } else if (binding) {
      results.push(await optimiseStoredMedia(doc, settings, binding, update, undefined, { force }))
    }
  }

  return NextResponse.json({ ok: results.every((result) => result.status !== 'failed'), results })
}
