import { redirect } from 'next/navigation'
import { getAdminContext, hasAdminPanelAccess } from '@/admin/auth'
import { adminHref } from '@/features/security/adminPath'
import { getAdminRoot } from '@/features/security/settings'
import { getFeatureFlags } from '@/utilities/features'
import { getEngine } from '@/lib/engine'
import { listCategoriesSafe } from '@/features/categories/store'
import { CategoriesClient } from './CategoriesClient'

/**
 * The category tree at /admin/categories: add, rename, move, reorder and delete nested categories for the shop
 * and the blog, and pick the products that sit in a shop category. Admins only.
 */
export async function CategoriesView() {
  const context = await getAdminContext()
  if (!hasAdminPanelAccess(context.user)) redirect(adminHref('/login', await getAdminRoot()))
  if (!context.isAdmin) redirect(adminHref('', await getAdminRoot()))

  const flags = await getFeatureFlags().catch(() => ({}) as Record<string, boolean>)
  const [shop, blog] = await Promise.all([listCategoriesSafe('shop'), listCategoriesSafe('blog')])
  let products: { id: number; title: string }[] = []
  if (flags.ecommerce) {
    const engine = await getEngine()
    const found = (await engine.find({ collection: 'products', limit: 500, depth: 0, sort: 'title', overrideAccess: true }).catch((): null => null)) as { docs: { id: number; title?: string }[] } | null
    products = (found?.docs ?? []).map((p) => ({ id: p.id, title: String(p.title ?? p.id) }))
  }
  return <CategoriesClient initial={{ shop, blog }} products={products} shopEnabled={Boolean(flags.ecommerce)} blogEnabled={Boolean(flags.blog)} />
}
