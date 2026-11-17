import type { Metadata } from 'next'
import { feedPathFor } from '@/features/blog/feedAddress'
import { readBlogBase } from '@/features/seo/permalinkStore'
import { getEngine } from '@/lib/engine'

/** Adds the feed link of a category or tag page to its metadata, unless the feed is off in Blog settings. */
export async function withArchiveFeed(meta: Metadata, kind: 'category' | 'tag', slug: string): Promise<Metadata> {
  const engine = await getEngine()
  const settings = (await engine.findGlobal({ slug: 'blog-settings', depth: 0 }).catch((): null => null)) as { rssEnabled?: boolean | null } | null
  if (settings?.rssEnabled === false) return meta
  return { ...meta, alternates: { ...(meta.alternates ?? {}), types: { 'application/rss+xml': feedPathFor(kind, slug, await readBlogBase()) } } }
}
