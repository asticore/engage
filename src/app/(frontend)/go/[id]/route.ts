import { getCloudflareContext } from '@opennextjs/cloudflare'

import { recordOutboundClick } from '@/features/ecommerce/outbound'
import { sourceOf } from '@/features/ecommerce/outboundShared'
import { isLikelyBot, todayUtc } from '@/features/ads/track'
import { clientKey, hit } from '@/features/security/rateLimit'

export const dynamic = 'force-dynamic'

const notFound = (): Response => new Response('Not found', { status: 404, headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' } })

/**
 * GET /go/<product id>?s=<source> - the cloaked short link behind an external or affiliate Buy button.
 * Counts the click (bots and rate-limited callers are sent on without being counted), then redirects to the
 * product's own address. Only published external products with an http(s) address ever redirect.
 */
export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await ctx.params
  const productId = /^\d{1,9}$/.test(id) ? Number(id) : 0
  if (productId < 1) return notFound()

  let url: string | null = null
  try {
    const { env } = await getCloudflareContext({ async: true })
    const db = (env as { D1?: D1Database }).D1
    const row = (await db?.prepare("SELECT external_url FROM `eg_products` WHERE id = ? AND product_type = 'external' AND _status = 'published' AND deleted_at IS NULL").bind(productId).first()) as { external_url?: string } | null | undefined
    const raw = row?.external_url?.trim() ?? ''
    url = /^https?:\/\/\S+$/i.test(raw) ? raw : null
  } catch {
    url = null
  }
  if (!url) return notFound()

  const counted = !isLikelyBot(request.headers.get('user-agent')) && !hit(`go:${clientKey(request)}`, 60).limited
  if (counted) {
    const source = sourceOf(new URL(request.url).searchParams.get('s'), request.headers.get('referer'), request.headers.get('host'))
    await recordOutboundClick(productId, source, todayUtc())
  }
  return new Response(null, { status: 302, headers: { Location: url, 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow', 'Referrer-Policy': 'no-referrer' } })
}
