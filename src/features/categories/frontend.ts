import { ancestorsOf, childrenOf, pathSlugs, type CategoryRow, type CategoryScope } from './tree'

/** Public address of a category page. Shop pages carry the full path; blog pages use the slug alone (slugs are unique per scope). */
export function categoryUrl(scope: CategoryScope, rows: CategoryRow[], id: number): string {
  if (scope === 'blog') return `/blog/category/${rows.find((r) => r.id === id)?.slug ?? ''}`
  return `/shop/category/${pathSlugs(rows, id).join('/')}`
}

/** Items for the Breadcrumbs element: Home, the section, each parent, then the category itself (no link). */
export function categoryCrumbs(scope: CategoryScope, rows: CategoryRow[], id: number): { label: string; url: string }[] {
  const root = scope === 'shop' ? { label: 'Shop', url: '/shop' } : { label: 'Blog', url: '/blog' }
  const chain = ancestorsOf(rows, id)
  return [
    { label: 'Home', url: '/' },
    root,
    ...chain.map((row, i) => ({ label: row.name, url: i === chain.length - 1 ? '' : categoryUrl(scope, rows, row.id) })),
  ]
}

/** Links to the direct sub categories of a category (or of the top level when id is null). */
export const subCategoryLinks = (scope: CategoryScope, rows: CategoryRow[], id: number | null): { name: string; href: string }[] =>
  childrenOf(rows, id).map((r) => ({ name: r.name, href: categoryUrl(scope, rows, r.id) }))
