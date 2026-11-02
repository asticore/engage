import type { getAdminContext } from '@/admin/auth'
import { adminHref } from '@/features/security/adminPath'

import { pagesUsingForms, type PageUse, type PageUsePage, type PageUseStatus } from './pageUsage'

/** The engine the admin screens hold. Only its find and findByID are used here. */
export type EngineLike = Awaited<ReturnType<typeof getAdminContext>>['engine']
type FindUser = Parameters<EngineLike['find']>[0]['user']

const idOf = (value: unknown): number | string | undefined => {
  if (value && typeof value === 'object') return (value as { id?: number | string }).id
  return typeof value === 'number' || typeof value === 'string' ? value : undefined
}

/** Public URL of a page: its slug under every ancestor's slug (the parent chain is the URL). */
export async function pageLiveHref(engine: EngineLike, doc: Record<string, unknown>): Promise<string | undefined> {
  if (doc.isHomepage) return '/'
  const segments: string[] = []
  let current: Record<string, unknown> | null = doc
  for (let depth = 0; current && depth < 9; depth++) {
    const slug = current.slug
    if (typeof slug !== 'string' || !slug) return undefined
    segments.unshift(slug)
    const parentId = idOf(current.parent)
    if (parentId === undefined) return `/${segments.join('/')}`
    current = (await engine.findByID({ collection: 'pages', depth: 0, id: parentId as number, overrideAccess: true }).catch((): null => null)) as Record<string, unknown> | null
  }
  return undefined
}

/**
 * Every page that puts a form on it, keyed by form id. Reads drafts too: a form used only in an unpublished
 * draft is still a use, listed with the draft status. Only pages the viewer may read are scanned.
 *
 * Two reads: the live versions (drafts off, which skips pages never published) and the latest version of every
 * page (drafts on, which includes them). The live row decides the status and the public address.
 */
export async function loadFormUsage(engine: EngineLike, user: FindUser, forms: Array<{ id: number | string; embedKey?: string | null }>): Promise<Record<string, PageUse[]>> {
  // The usage list is an extra on the Forms screens: if the pages cannot be read, the screen still works without it.
  if (!engine || typeof engine.find !== 'function') return {}
  const [live, latest] = await Promise.all([
    engine.find({ collection: 'pages', depth: 0, limit: 2000, user }).catch(() => ({ docs: [] as unknown[] })),
    engine.find({ collection: 'pages', depth: 0, limit: 2000, user, draft: true } as never).catch(() => ({ docs: [] as unknown[] })),
  ])
  const liveById = new Map<string, Record<string, unknown>>()
  for (const raw of live.docs) {
    const doc = raw as Record<string, unknown>
    const id = idOf(doc.id)
    if (id !== undefined) liveById.set(String(id), doc)
  }
  const pages: PageUsePage[] = []
  for (const raw of latest.docs) {
    const doc = raw as Record<string, unknown>
    const id = idOf(doc.id)
    if (id === undefined) continue
    const published = liveById.get(String(id))
    const source = published ?? doc
    pages.push({
      id,
      title: typeof source.title === 'string' ? source.title : undefined,
      slug: typeof source.slug === 'string' ? source.slug : undefined,
      status: published ? 'published' : 'draft',
      blocks: published?.blocks,
      draftBlocks: doc.blocks,
      liveHref: published ? await pageLiveHref(engine, published) : undefined,
    })
  }
  return Object.fromEntries(pagesUsingForms(forms, pages))
}

/** A usage row with the admin links the screens need. */
export type FormUsageLink = PageUse & { editHref: string; statusLabel: string }

/** Adds the page's visual editor address and the status wording to each use. `root` is the admin base path. */
export function withUsageLinks(pages: PageUse[], root: string, statusLabels: Record<PageUseStatus, string>): FormUsageLink[] {
  return pages.map((page) => ({
    ...page,
    editHref: adminHref(`/visual-editor/collection/pages/${encodeURIComponent(String(page.id))}`, root),
    statusLabel: statusLabels[page.status],
  }))
}
