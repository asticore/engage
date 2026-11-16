import { getEngine } from '@/lib/engine'
import { findPageByPath } from '@/utilities/pagePaths'

/**
 * Task 23d: the shop can swap the built-in /cart page for a page built in the visual editor (slug "cart").
 * True only when the switch is on AND a page with that slug is published and visible on this domain, so a
 * missing or draft page never leaves shoppers without a cart.
 */
export async function cartPageReplaced(): Promise<boolean> {
  try {
    const engine = (await getEngine()) as unknown as { findGlobal: (a: unknown) => Promise<{ cartPageFromEditor?: unknown } | null> }
    const extra = await engine.findGlobal({ slug: 'shop-extra-settings', depth: 0, overrideAccess: true })
    if (extra?.cartPageFromEditor !== true) return false
    const found = await findPageByPath(['cart'])
    return Boolean(found && (found.page as { _status?: string | null })._status !== 'draft')
  } catch {
    return false
  }
}
