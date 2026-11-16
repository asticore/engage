import { UPLOAD_PREFIX, getUploadBucket } from '@/features/forms/upload'
import { verifyFileLink } from '@/features/forms/fileLinks'

export const dynamic = 'force-dynamic'

const text = (message: string, status: number): Response =>
  new Response(message, { status, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' } })

/**
 * GET /api/form-file-link?key=form-uploads/...&exp=<unix>&sig=<hex>
 *
 * Serves one file a visitor attached to a form entry, to whoever holds a link
 * signed by this site (see fileLinks.ts). The link names the file and a deadline.
 * Sent as a download in a sandbox, never rendered on this site's origin.
 */
export async function GET(request: Request): Promise<Response> {
  try {
    const params = new URL(request.url).searchParams
    const key = params.get('key') || ''
    if (!key.startsWith(UPLOAD_PREFIX) || key.includes('..') || key.includes('\0') || key.length > 300) return text('Not found', 404)
    if (!(await verifyFileLink(process.env.ENGAGE_SECRET || '', key, params.get('exp') || '', params.get('sig') || ''))) {
      return text('This link is not valid or has expired.', 403)
    }
    const bucket = await getUploadBucket()
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
    console.error('form-file-link GET error:', error)
    return text('Internal server error', 500)
  }
}
