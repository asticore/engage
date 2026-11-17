import { getAdminContext } from '@/admin/auth'
import { getQuoteBucket, isQuoteKey, listQuoteFiles } from '@/features/quotes/attachments'

export const dynamic = 'force-dynamic'

const text = (message: string, status: number): Response =>
  new Response(message, { status, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' } })

/**
 * GET /api/admin-quote-file?number=QR-XXXXXX           the files attached to that request, as JSON { files: [{ key, name, size }] }
 * GET /api/admin-quote-file?number=QR-XXXXXX&key=...   one of them, as a download. Admin only. Never rendered in this site's origin.
 */
export async function GET(request: Request): Promise<Response> {
  try {
    const context = await getAdminContext()
    if (!context.user) return text('Unauthorised', 401)
    if (!context.isAdmin) return text('Forbidden', 403)
    const params = new URL(request.url).searchParams
    const number = params.get('number') || ''
    const key = params.get('key')
    const bucket = await getQuoteBucket()
    if (key === null) {
      return new Response(JSON.stringify({ files: await listQuoteFiles(bucket, number) }), { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } })
    }
    if (!isQuoteKey(number, key)) return text('Not found', 404)
    const object = (await bucket.get(key)) as { body?: ReadableStream; httpMetadata?: { contentType?: string } } | null
    if (!object?.body) return text('Not found', 404)
    const name = key.split('/').pop() || 'file'
    const safe = name.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_')
    return new Response(object.body, {
      headers: {
        'Content-Type': object.httpMetadata?.contentType || 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${safe}"; filename*=UTF-8''${encodeURIComponent(name)}`,
        'Content-Security-Policy': "default-src 'none'; sandbox",
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'private, no-store',
      },
    })
  } catch (error) {
    console.error('admin-quote-file GET error:', error)
    return text('Internal server error', 500)
  }
}
