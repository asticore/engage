import { findLibraryItem } from '@/features/templateLibraries/list'
import { loadItemTemplate } from '@/features/templateLibraries/loader'
import { importItemPictures, libraryJson, librarySettingsAccess, slugFromTitle, storeEngine, uniquePageSlug } from '@/features/templateLibraries/server'
import { SLUG_RE } from '@/features/templateRepos/manifest'
import { clientKey, hit } from '@/features/security/rateLimit'

export const dynamic = 'force-dynamic'

const RATE_LIMIT_PER_MINUTE = 10

type PageDoc = { id: number | string; blocks?: unknown }

/**
 * POST /api/template-libraries/install-example   { library: string, item: string }
 *
 * Used by the setup questionnaire (administrators only). Installs one example page from a library onto a blank site:
 * if the Home page has no content yet, the example becomes the Home page; otherwise it is added as a new published page.
 * Pictures are saved to Media the same way "Create page from this template" does.
 */
export async function POST(request: Request): Promise<Response> {
  try {
    const access = await librarySettingsAccess()
    if (!access.ok) return access.response
    if (hit(`template-libraries-install:${clientKey(request)}`, RATE_LIMIT_PER_MINUTE).limited) {
      return libraryJson({ ok: false, error: 'Too many requests. Wait a minute and try again.' }, 429)
    }
    const body = (await request.json().catch((): null => null)) as Record<string, unknown> | null
    const slug = typeof body?.item === 'string' ? body.item : ''
    if (!SLUG_RE.test(slug)) return libraryJson({ ok: false, error: 'That item name is not valid.' }, 400)

    const engine = storeEngine(access.context)
    const found = await findLibraryItem(engine, typeof body?.library === 'string' ? body.library : '')
    if (!found.ok) return libraryJson({ ok: false, error: found.error }, found.status)
    const item = found.manifestItems.find((candidate) => candidate.slug === slug)
    if (!item || !found.row.config) return libraryJson({ ok: false, error: 'That item is not in this library.' }, 404)
    if (item.kind !== 'page') return libraryJson({ ok: false, error: 'Only whole pages can be installed as an example.' }, 400)

    const template = await loadItemTemplate(found.row.config, item, {}, found.token)
    if (!template.ok) return libraryJson({ ok: false, error: template.error }, 502)
    const imported = await importItemPictures(access.context, found.row.config, template.value, `${found.row.url}#${item.file}`, false)
    if (!imported.ok) return libraryJson({ ok: false, error: imported.error }, 422)

    const home = (await engine.find({ collection: 'pages', where: { isHomepage: { equals: true } }, limit: 1, depth: 0, draft: true, overrideAccess: true })).docs[0] as PageDoc | undefined
    const homeBlank = home !== undefined && (!Array.isArray(home.blocks) || home.blocks.length === 0)
    if (home && homeBlank) {
      await (engine as unknown as { update: (args: Record<string, unknown>) => Promise<unknown> }).update({
        collection: 'pages',
        id: home.id,
        data: { blocks: imported.tree, _status: 'published' },
        overrideAccess: true,
      })
      return libraryJson({ ok: true, id: String(home.id), slug: 'home', placed: 'home' })
    }
    const pageSlug = await uniquePageSlug(engine, slugFromTitle(item.title))
    const doc = await engine.create({
      collection: 'pages',
      data: { title: item.title, slug: pageSlug, blocks: imported.tree, _status: 'published' },
      overrideAccess: true,
    })
    return libraryJson({ ok: true, id: String(doc.id), slug: pageSlug, placed: 'page' })
  } catch (error) {
    console.error('template-libraries install-example error:', error instanceof Error ? error.name : 'unknown')
    return libraryJson({ ok: false, error: 'The example could not be installed.' }, 500)
  }
}
