import type { Engine } from '@/engine'
import { demoPassword, isEmail } from '@/features/demos/core'
import { slugify } from '@/utilities/formatSlug'

import { describeRollout, franchiseLocks, type LockChoice, type RolloutSummary } from './core'
import * as store from './store'

type Doc = Record<string, unknown>

/**
 * Rolls one page template out to every active franchise. Each franchise gets its own page, shown only on its
 * domain, with the template's blocks and the chosen lock. A later rollout updates the same page, so the
 * head office changes reach every franchise (any edit a franchise made to locked parts is replaced).
 */
export async function rolloutTemplate(engine: Engine, d1: store.D1, templateId: number, choice: LockChoice, now: Date): Promise<RolloutSummary> {
  const summary: RolloutSummary = { created: 0, updated: 0, failed: 0, franchises: 0, messages: [] }
  const template = (await engine.findByID({ collection: 'page-templates', id: templateId, depth: 0, overrideAccess: true }).catch((): null => null)) as Doc | null
  if (!template) {
    summary.messages.push('That template was not found.')
    summary.failed = 1
    return summary
  }
  const title = String(template.name ?? 'Page')
  const slug = slugify(title) || 'page'
  const blocks = Array.isArray(template.blocks) ? template.blocks : []
  const locks = franchiseLocks(template.locks, choice)
  for (const franchise of (await store.listFranchises(d1)).filter((f) => f.status === 'active')) {
    summary.franchises += 1
    try {
      const existingId = await store.mappedPageId(d1, franchise.id, templateId)
      const existing = existingId ? ((await engine.findByID({ collection: 'pages', id: existingId, depth: 0, overrideAccess: true }).catch((): null => null)) as Doc | null) : null
      if (existing && typeof existing.id === 'number') {
        await engine.update({ collection: 'pages', id: existing.id, overrideAccess: true, data: { blocks, locks } as never })
        await store.saveMapping(d1, franchise.id, templateId, existing.id, now.toISOString())
        summary.updated += 1
      } else {
        const page = (await engine.create({ collection: 'pages', overrideAccess: true, data: { title, slug, availableDomains: franchise.host, blocks, locks, _status: 'published' } as never })) as Doc
        await store.saveMapping(d1, franchise.id, templateId, Number(page.id), now.toISOString())
        summary.created += 1
      }
    } catch (error) {
      summary.failed += 1
      summary.messages.push(`${franchise.name}: ${error instanceof Error ? error.message : String(error)}`.slice(0, 160))
    }
  }
  return summary
}

export { describeRollout }

/** Makes the franchise owner's account: an editor limited to the franchise domain. Returns the one-time password. */
export async function createOwnerAccount(engine: Engine, franchise: store.Franchise): Promise<{ ok: true; password: string } | { ok: false; error: string }> {
  const email = franchise.ownerEmail.trim().toLowerCase()
  if (!isEmail(email)) return { ok: false, error: 'Add the owner email to the franchise first.' }
  const existing = await engine.find({ collection: 'users', overrideAccess: true, limit: 1, depth: 0, where: { email: { equals: email } } })
  if (existing.totalDocs > 0) return { ok: false, error: 'An account with that email already exists. Set its allowed domains to this franchise domain in Users.' }
  const password = demoPassword()
  try {
    await engine.create({ collection: 'users', overrideAccess: true, data: { email, password, roles: ['editor'], allowedDomains: franchise.host } as never })
  } catch (error) {
    return { ok: false, error: `Could not create the account: ${error instanceof Error ? error.message : String(error)}`.slice(0, 300) }
  }
  return { ok: true, password }
}
