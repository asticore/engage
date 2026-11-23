import { blogPath, shopPath } from '@/features/seo/permalinks'
import { ancestorsOf, childrenOf, pathSlugs, type CategoryRow, type CategoryScope } from './tree'

/** Public address of a category page. `base` is the blog or shop address of the scope.  Both shop and blog pages carry the full path (/blog/category/parent/child); a bare slug still resolves. */
export function categoryUrl(scope: CategoryScope, rows: CategoryRow[], id: number, base?: string): string {
  if (scope === 'blog') return blogPath(base ?? '', `/category/${pathSlugs(rows, id).join('/')}`)
  return shopPath(base, `/category/${pathSlugs(rows, id).join('/')}`)
}

/** Items for the Breadcrumbs element: Home, the section, each parent, then the category itself (no link). */
export function categoryCrumbs(scope: CategoryScope, rows: CategoryRow[], id: number, base?: string): { label: string; url: string }[] {
  const root = scope === 'shop' ? { label: 'Shop', url: shopPath(base) } : { label: 'Blog', url: blogPath(base ?? '') }
  const chain = ancestorsOf(rows, id)
  return [
    { label: 'Home', url: '/' },
    root,
    ...chain.map((row, i) => ({ label: row.name, url: i === chain.length - 1 ? '' : categoryUrl(scope, rows, row.id, base) })),
  ]
}

/** Links to the direct sub categories of a category (or of the top level when id is null). */
export const subCategoryLinks = (scope: CategoryScope, rows: CategoryRow[], id: number | null, base?: string): { name: string; href: string }[] =>
  childrenOf(rows, id).map((r) => ({ name: r.name, href: categoryUrl(scope, rows, r.id, base) }))
