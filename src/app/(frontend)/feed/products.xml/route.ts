import { productFeed, type ProductRow } from '@/features/blog/listFeeds'
import { excludeProtected } from '@/features/visibility/excludeProtected'
import { readShopBase } from '@/features/seo/permalinkStore'
import { getEngine } from '@/lib/engine'
import { getFeatureFlags } from '@/utilities/features'
import { requestSiteOrigin } from '@/utilities/siteOrigin'

export const dynamic = 'force-dynamic'

/** RSS feed of the newest published products. Off when the shop is off. Password protected products are left out. */
export async function GET(request: Request): Promise<Response> {
  if (!(await getFeatureFlags()).ecommerce) return new Response('Not found', { status: 404 })
  const engine = await getEngine()
  const site = (await engine.findGlobal({ slug: 'site-settings', depth: 0 }).catch((): null => null)) as { siteName?: string | null } | null
  const found = await engine.find({ collection: 'products', where: { _status: { equals: 'published' } }, sort: '-createdAt', limit: 30, depth: 1 } as never)
  const rows = await excludeProtected('products', found.docs as unknown as (ProductRow & { id: number })[], null)
  const xml = productFeed({ rows: rows as ProductRow[], baseUrl: await requestSiteOrigin(), selfUrl: request.url, siteName: site?.siteName ?? '', shopBase: await readShopBase() })
  return new Response(xml, { headers: { 'content-type': 'application/rss+xml; charset=utf-8', 'cache-control': 'public, max-age=0, s-maxage=900, stale-while-revalidate=3600' } })
}
