import { buildRss, lexicalToHtml, type FeedPost } from '@/features/blog/rss'
import { readBlogBase } from '@/features/seo/permalinkStore'
import { getEngine } from '@/lib/engine'
import { slugify } from '@/utilities/formatSlug'
import { requestSiteOrigin } from '@/utilities/siteOrigin'

export const dynamic = 'force-dynamic'

/** The post's featured image as an absolute address, when it has one. */
function feedImage(value: unknown, baseUrl: string): { url: string; mime?: string } | undefined {
  const m = value && typeof value === 'object' ? (value as { url?: unknown; mimeType?: unknown }) : null
  if (!m || typeof m.url !== 'string' || !m.url) return undefined
  const url = /^https?:\/\//i.test(m.url) ? m.url : `${baseUrl}${m.url.startsWith('/') ? '' : '/'}${m.url}`
  return { url, mime: typeof m.mimeType === 'string' ? m.mimeType : undefined }
}

type Row = { title?: string; slug?: string; publishedDate?: string; excerpt?: string; content?: unknown; author?: unknown; featuredImage?: unknown; categories?: Array<{ name?: string }>; tags?: Array<{ name?: string }> }

/**
 * Blog RSS feed. /feed.xml lists the newest posts; ?category=<slug> and ?tag=<slug> narrow it (the same slugs as
 * /blog/category/<slug> and /blog/tag/<slug>). Blog settings, RSS decides whether it exists and whether items carry
 * the full text or a summary.
 */
export async function GET(request: Request): Promise<Response> {
  const engine = await getEngine()
  const settings = (await engine.findGlobal({ slug: 'blog-settings', depth: 0 }).catch((): null => null)) as { rssEnabled?: boolean | null; rssMode?: string | null; archiveTitle?: string | null; archiveIntro?: string | null } | null
  if (settings?.rssEnabled === false) return new Response('Not found', { status: 404 })
  const url = new URL(request.url)
  const category = slugify(url.searchParams.get('category') ?? '')
  const tag = slugify(url.searchParams.get('tag') ?? '')
  const baseUrl = await requestSiteOrigin()
  const site = (await engine.findGlobal({ slug: 'site-settings', depth: 0 }).catch((): null => null)) as { siteName?: string | null } | null
  const found = await engine.find({ collection: 'posts', where: { _status: { equals: 'published' } }, sort: '-publishedDate', limit: 100, depth: 1, overrideAccess: true } as never)
  const full = settings?.rssMode === 'full'
  const posts: FeedPost[] = (found.docs as Row[])
    .filter((p) => p.slug && (!p.publishedDate || Date.parse(p.publishedDate) <= Date.now()))
    .filter((p) => !category || (p.categories ?? []).some((c) => slugify((c?.name ?? '').trim()) === category))
    .filter((p) => !tag || (p.tags ?? []).some((t) => slugify((t?.name ?? '').trim()) === tag))
    .map((p) => ({
      title: p.title ?? '',
      slug: p.slug as string,
      date: p.publishedDate ?? '',
      excerpt: (p.excerpt ?? '').trim(),
      html: full ? lexicalToHtml(p.content) : '',
      author: typeof p.author === 'object' && p.author ? String((p.author as { name?: string; email?: string }).name ?? '') : '',
      image: feedImage(p.featuredImage, baseUrl),
      categories: (p.categories ?? []).map((c) => (c?.name ?? '').trim()).filter(Boolean),
    }))
  const suffix = category ? ` (${category})` : tag ? ` (tag ${tag})` : ''
  const title = `${settings?.archiveTitle || 'Blog'} | ${site?.siteName || ''}`.replace(/ \| $/, '') + suffix
  const xml = buildRss({ title, link: `${baseUrl}/blog`, selfUrl: url.toString(), description: (settings?.archiveIntro ?? '').trim() || title, baseUrl, mode: full ? 'full' : 'summary', posts, blogBase: await readBlogBase() })
  return new Response(xml, { headers: { 'content-type': 'application/rss+xml; charset=utf-8', 'cache-control': 'public, max-age=0, s-maxage=900, stale-while-revalidate=3600' } })
}
