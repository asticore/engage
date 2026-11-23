import { findLibraryItem } from '@/features/templateLibraries/list'
import { loadItemTemplate } from '@/features/templateLibraries/loader'
import { importItemPictures, libraryJson, libraryUseAccess, storeEngine } from '@/features/templateLibraries/server'
import { SLUG_RE } from '@/features/templateRepos/manifest'
import { clientKey, hit } from '@/features/security/rateLimit'
import { SITE_TEMPLATE_KINDS } from '@/features/siteTemplates/kinds'

export const dynamic = 'force-dynamic'

const RATE_LIMIT_PER_MINUTE = 20

/**
 * POST /api/template-libraries/create-template   { library: string, item: string }
 *
 * Makes a Templates hub item from a library item of type site-template, loop or popup. A site template or loop
 * becomes a site template of the item's siteKind, switched OFF so the live site does not change until the owner
 * has looked at it. A popup becomes a reusable section. Created as the signed-in user, so collection rules apply.
 */
export async function POST(request: Request): Promise<Response> {
  try {
    const access = await libraryUseAccess()
    if (!access.ok) return access.response
    if (hit(`template-libraries-template:${clientKey(request)}`, RATE_LIMIT_PER_MINUTE).limited) {
      return libraryJson({ ok: false, error: 'Too many requests. Wait a minute and try again.' }, 429)
    }
    const body = (await request.json().catch((): null => null)) as Record<string, unknown> | null
    const slug = typeof body?.item === 'string' ? body.item : ''
    if (!SLUG_RE.test(slug)) return libraryJson({ ok: false, error: 'That item name is not valid.' }, 400)

    const found = await findLibraryItem(storeEngine(access.context), typeof body?.library === 'string' ? body.library : '')
    if (!found.ok) return libraryJson({ ok: false, error: found.error }, found.status)
    const item = found.manifestItems.find((candidate) => candidate.slug === slug)
    if (!item || !found.row.config) return libraryJson({ ok: false, error: 'That item is not in this library.' }, 404)

    const popup = item.type === 'popup'
    const siteKind = item.type === 'loop' ? 'loop' : item.siteKind
    if (!popup && !(siteKind && (SITE_TEMPLATE_KINDS as readonly string[]).includes(siteKind))) {
      return libraryJson({ ok: false, error: 'This item is not a site template, loop or popup.' }, 400)
    }
    const collection = popup ? 'reusable-sections' : 'site-templates'
    const permission = (access.context.can as unknown as (resource: string, action: string) => boolean)(collection, 'create')
    if (!access.context.isAdmin && !permission) return libraryJson({ ok: false, error: 'You do not have permission to create this.' }, 403)

    const template = await loadItemTemplate(found.row.config, item, {}, found.token)
    if (!template.ok) return libraryJson({ ok: false, error: template.error }, 502)
    const imported = await importItemPictures(access.context, found.row.config, template.value, `${found.row.url}#${item.file}`, false)
    if (!imported.ok) return libraryJson({ ok: false, error: imported.error }, 422)

    const engine = storeEngine(access.context)
    const data = popup
      ? { name: item.title, blocks: imported.tree }
      : { name: item.title, kind: siteKind, enabled: false, blocks: imported.tree }
    const doc = await engine.create({ collection, data, user: access.context.user })
    const id = String(doc.id)
    return libraryJson({ ok: true, id, collection, enabled: popup ? undefined : false, editHref: `/admin/visual-editor/collection/${collection}/${id}` })
  } catch (error) {
    console.error('template-libraries create-template error:', error instanceof Error ? error.name : 'unknown')
    return libraryJson({ ok: false, error: 'The template could not be created.' }, 500)
  }
}
