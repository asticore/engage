import type { Engine } from '@/engine'

/**
 * The admin dashboard notice "Review your privacy policy and cookie notice".
 *
 * Shown until the admin dismisses it (remembered in this browser, see
 * PolicyReviewNotice.tsx), or until the linked privacy policy page has been
 * changed after it was first created. A page that was only seeded and never
 * touched keeps the notice up. Pages that are not linked from Site pages
 * cannot be checked, so the notice stays until it is dismissed.
 */

export const POLICY_REVIEW_TEXT = 'Review your privacy policy and cookie notice'
export const POLICY_REVIEW_STORAGE_KEY = 'eg-admin-notice-policy-review-dismissed'

/** A change this many milliseconds after creation counts as a real edit (saving a page the moment it is made does not). */
export const POLICY_EDIT_GRACE_MS = 60 * 1000

export type PolicyPageTimes = { createdAt?: string | null; updatedAt?: string | null } | null

/** Pure rule: true unless the policy page was edited after it was created. */
export function policyPageEdited(page: PolicyPageTimes): boolean {
  if (!page?.createdAt || !page.updatedAt) return false
  const created = Date.parse(page.createdAt)
  const updated = Date.parse(page.updatedAt)
  if (!Number.isFinite(created) || !Number.isFinite(updated)) return false
  return updated - created > POLICY_EDIT_GRACE_MS
}

/** Reads the linked privacy policy page (Site pages > Privacy policy page). Any failure reads as "not linked". */
export async function loadPolicyPageTimes(engine: Engine): Promise<PolicyPageTimes> {
  try {
    const pages = (await engine.findGlobal({ slug: 'site-pages', depth: 0 })) as { privacyPolicyPage?: unknown } | null
    const raw = pages?.privacyPolicyPage
    const id = raw && typeof raw === 'object' ? (raw as { id?: unknown }).id : raw
    if (id === null || id === undefined || id === '') return null
    const page = (await engine.findByID({ collection: 'pages', id: id as number, depth: 0, overrideAccess: true } as never)) as {
      createdAt?: string
      updatedAt?: string
    } | null
    return page ? { createdAt: page.createdAt ?? null, updatedAt: page.updatedAt ?? null } : null
  } catch {
    return null
  }
}

/** Whether the notice may show for this site. The dismissal is checked in the browser. */
export async function policyReviewCanShow(engine: Engine): Promise<boolean> {
  return !policyPageEdited(await loadPolicyPageTimes(engine))
}
