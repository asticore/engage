import { normaliseCode } from '@/features/affiliates/core'
import * as store from '@/features/affiliates/store'

export const dynamic = 'force-dynamic'

const notFound = (): Response => new Response('Not found', { status: 404, headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' } })

/**
 * GET /a/<vanity code> - an affiliate's short link. Sends the visitor to the product page (or the home page) with the
 * affiliate's referral code and any utm_ values attached, so the normal tracking picks it up. The destination is always
 * a path on this site, never an address taken from the request. Unknown codes and a switched-off program give 404.
 */
export async function GET(request: Request, ctx: { params: Promise<{ code: string }> }): Promise<Response> {
  const code = normaliseCode((await ctx.params).code)
  if (!code) return notFound()
  try {
    const { getFeatureFlags } = await import('@/utilities/features')
    if (!(await getFeatureFlags()).affiliates) return notFound()
    const { rawD1 } = await import('@/features/ecommerce/server/db')
    const d1 = (await rawD1()) as never as store.D1
    const link = await store.resolveShortLink(d1, code)
    if (!link) return notFound()
    const affiliate = await store.getAffiliateById(d1, link.affiliateId)
    const target = new URL(link.path, request.url)
    if (affiliate && affiliate.status === 'active') target.searchParams.set('ref', affiliate.code)
    const incoming = new URL(request.url).searchParams
    for (const key of ['utm_source', 'utm_medium', 'utm_campaign']) {
      const value = incoming.get(key)
      if (value) target.searchParams.set(key, value.slice(0, 100))
    }
    return new Response(null, { status: 302, headers: { Location: `${target.pathname}${target.search}`, 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' } })
  } catch {
    return notFound()
  }
}
