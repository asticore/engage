import { getMediaBucket } from '@/localapi/storage'
import { builtInFontKey, isBuiltInFontFile } from '@/features/fonts/selfHost'

export const dynamic = 'force-dynamic'

const PATH_SEGMENT = /^[a-z0-9][a-z0-9.@-]{0,80}$/
const FONT_HEADERS = {
  'Content-Type': 'font/woff2',
  'Cache-Control': 'public, max-age=31536000, immutable',
  'X-Content-Type-Options': 'nosniff',
}

/**
 * Serves a built-in theme font from this site when the Speed setting is on.
 * The first request copies the file from the pinned Fontsource package on
 * jsDelivr into R2; later requests read it back from R2. Only the built-in
 * faces at their pinned versions are served, so this cannot be used as a proxy.
 */
export async function GET(_request: Request, context: { params: Promise<{ path: string[] }> }): Promise<Response> {
  const { path } = await context.params
  if (path.length !== 2 || !path.every((segment) => PATH_SEGMENT.test(segment))) return new Response('Not found', { status: 404 })
  const [packagePath, file] = path
  if (!isBuiltInFontFile(packagePath, file)) return new Response('Not found', { status: 404 })

  const key = builtInFontKey(packagePath, file)
  const bucket = await getMediaBucket()
  const stored = await bucket.get(key)
  if (stored) return new Response(stored.body, { headers: FONT_HEADERS })

  const upstream = await fetch(`https://cdn.jsdelivr.net/npm/@fontsource/${packagePath}/files/${file}`, { signal: AbortSignal.timeout(15000) })
  if (!upstream.ok) return new Response('Not found', { status: 404 })
  const bytes = new Uint8Array(await upstream.arrayBuffer())
  // A WOFF2 starts with the four bytes "wOF2".
  if (bytes.length < 4 || String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]) !== 'wOF2') return new Response('Not found', { status: 404 })
  await bucket.put(key, bytes, { httpMetadata: { contentType: 'font/woff2' } })
  return new Response(bytes, { headers: FONT_HEADERS })
}
