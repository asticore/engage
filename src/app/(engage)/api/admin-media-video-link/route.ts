import { NextResponse } from 'next/server'

import { authorizeMedia } from '@/features/media/access'
import { readJsonBody, type MediaEngine } from '@/features/media/store'
import { parseVideoUrl } from '@/components/blocks/elements/videoUrl'

/**
 * POST /api/admin-media-video-link  { url, title }
 *
 * Adds a video link to the media library: a YouTube, Vimeo or direct .mp4 / .webm
 * address. Nothing is downloaded. The item is stored with mimeType `video/link`,
 * so it is listed with the videos, and the poster picture is set afterwards on
 * its edit screen.
 */
export async function POST(request: Request): Promise<Response> {
  const auth = await authorizeMedia('create')
  if (!auth.context) return auth.response

  const body = await readJsonBody(request)
  if (!body) return NextResponse.json({ error: 'Send JSON with a link and a title.' }, { status: 400 })

  const url = typeof body.url === 'string' ? body.url.trim() : ''
  const source = parseVideoUrl(url)
  if (!source) {
    return NextResponse.json({ error: 'Paste a YouTube, Vimeo or direct .mp4 or .webm link.' }, { status: 400 })
  }

  const rawTitle = typeof body.title === 'string' ? body.title.trim() : ''
  if (rawTitle.length > 200) return NextResponse.json({ error: 'Keep the title to 200 characters.' }, { status: 400 })
  const title = rawTitle || `${source.kind === 'file' ? new URL(url).pathname.split('/').pop() || 'Video' : source.kind} video`

  const engine = auth.context.engine as unknown as MediaEngine
  const doc = await engine.create({
    collection: 'media',
    data: {
      alt: '',
      filename: title,
      url,
      mimeType: 'video/link',
      source: 'upload',
      folder: '',
      outputFormat: 'default',
    },
    overrideAccess: true,
  })

  return NextResponse.json({ ok: true, doc: { id: doc.id, filename: title, url, mimeType: 'video/link' } })
}
