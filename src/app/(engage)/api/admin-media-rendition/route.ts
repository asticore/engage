import { NextResponse } from 'next/server'

import { outputMime, isRenderable, renditionFileName } from '@/features/dam/renditions'
import * as store from '@/features/dam/store'
import { rawD1 } from '@/features/ecommerce/server/db'
import { authorizeMedia } from '@/features/media/access'
import { resolveImagesBinding } from '@/features/media/imagesBinding'
import { applySafeServingHeaders, readMediaObject } from '@/localapi/storage'
import { getFeatureFlags } from '@/utilities/features'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin-media-rendition?id=12&preset=3[&download=1]
 * A picture made to a named preset (size, fit, format) by the Cloudflare Images service, for download. Staff with media
 * access only. Without the Images service the answer is 501 with a plain message; nothing is stored.
 */
export async function GET(request: Request): Promise<Response> {
  const auth = await authorizeMedia('read')
  if (!auth.context) return auth.response
  if (!(await getFeatureFlags()).dam) return NextResponse.json({ error: 'Switch Asset manager on in Site Settings first.' }, { status: 409 })
  const url = new URL(request.url)
  const id = Number(url.searchParams.get('id'))
  const presetId = Number(url.searchParams.get('preset'))
  if (!Number.isInteger(id) || id < 1 || !Number.isInteger(presetId) || presetId < 1) return NextResponse.json({ error: 'Choose a file and a preset.' }, { status: 400 })
  const d1 = (await rawD1()) as never as store.D1
  const preset = (await store.listRenditions(d1)).find((r) => r.id === presetId)
  const [row] = await store.mediaRows(d1, [id])
  if (!preset || !row) return NextResponse.json({ error: 'File or preset not found.' }, { status: 404 })
  if (!isRenderable(row.mimeType)) return NextResponse.json({ error: 'Presets work on JPEG, PNG, WebP and GIF pictures.' }, { status: 415 })
  const binding = await resolveImagesBinding()
  if (!binding) return NextResponse.json({ error: 'Image transformations are not enabled on this account.' }, { status: 501 })
  const stored = await readMediaObject(row.filename)
  if (!stored) return NextResponse.json({ error: 'The file could not be read.' }, { status: 404 })
  const mime = outputMime(preset.format, row.mimeType)
  try {
    const result = await binding
      .input(new Blob([stored.data as BlobPart]).stream() as ReadableStream<Uint8Array>)
      .transform({ ...(preset.width ? { width: preset.width } : {}), ...(preset.height ? { height: preset.height } : {}), fit: preset.fit })
      .output({ format: mime as 'image/webp', quality: 85 })
    const bytes = new Uint8Array(await new Response(result.image()).arrayBuffer())
    const name = renditionFileName(row.filename, preset.name, mime)
    const headers = new Headers({ 'Content-Type': mime, 'Cache-Control': 'private, no-store' })
    applySafeServingHeaders(headers, name)
    if (url.searchParams.get('download') === '1') headers.set('Content-Disposition', `attachment; filename="${name}"`)
    await store.logActivity(d1, id, 'download', `Rendition ${preset.name}`, Number((auth.context.user as { id?: unknown } | null)?.id) || null, new Date().toISOString())
    return new Response(bytes as unknown as BodyInit, { headers })
  } catch (error) {
    console.error('Rendition failed:', error)
    return NextResponse.json({ error: 'The picture could not be made. Try another preset.' }, { status: 502 })
  }
}
