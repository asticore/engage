import Link from 'next/link'
import React from 'react'

import { getBlockContext } from '@/lib/blockContext'
import { archiveQueryString, isArchiveFilterActive, NO_ARCHIVE_FILTERS } from '@/features/siteTemplates/archiveFilter'

import ArchiveFilterForm from './ArchiveFilterForm'

/**
 * Filter widget: a plain GET form (works without JavaScript) that writes the archive filter params
 * (?category=&tag=&min=&max=&q=&sort=) to the archive's own address. The archive pages and the Loop grid read them.
 * Renders nothing outside an archive.
 */

type P = Record<string, unknown>

const flag = (v: unknown, fallback: boolean): boolean => (typeof v === 'boolean' ? v : fallback)

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest' },
  { value: 'oldest', label: 'Oldest' },
  { value: 'title', label: 'A to Z' },
  { value: 'price-asc', label: 'Price: low to high' },
  { value: 'price-desc', label: 'Price: high to low' },
] as const

export async function ArchiveFilterElement(props: P): Promise<React.ReactElement | null> {
  const archive = getBlockContext().archive
  if (!archive) return null
  const f = archive.filters ?? NO_ARCHIVE_FILTERS
  const facets = archive.facets ?? { categories: [], tags: [] }
  const isProducts = archive.kind === 'products'
  const path = archive.basePath.split('?')[0] || '/'

  const showSearch = flag(props.showSearch, true)
  const showCategory = flag(props.showCategory, true) && facets.categories.length > 0
  const showTag = flag(props.showTag, true) && facets.tags.length > 0
  const showPrice = flag(props.showPrice, true) && isProducts
  const showSort = flag(props.showSort, true)
  const showInStock = flag(props.showInStock, true) && isProducts
  const showOnSale = flag(props.showOnSale, true) && isProducts
  const showRating = flag(props.showRating, true) && isProducts
  const showChips = flag(props.showChips, true)
  const instant = flag(props.instant, true)
  const sortOptions = SORT_OPTIONS.filter((o) => isProducts || !o.value.startsWith('price'))

  const field = 'archive-filter__field'
  return (
    <ArchiveFilterForm path={path} instant={instant} chips={showChips ? chipsFor(f, path, facets) : []}>
      <div className="archive-filter__fields" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'flex-end' }}>
        {showSearch && (
          <label className={field}>
            <span>Search</span>
            <input type="search" name="q" defaultValue={f.q} maxLength={100} />
          </label>
        )}
        {showCategory && (
          <label className={field}>
            <span>Category</span>
            <select name="category" defaultValue={f.category}>
              <option value="">All categories</option>
              {facets.categories.map((c) => (
                <option key={c.slug} value={c.slug}>{c.name}</option>
              ))}
            </select>
          </label>
        )}
        {showTag && (
          <label className={field}>
            <span>Tag</span>
            <select name="tag" defaultValue={f.tag}>
              <option value="">All tags</option>
              {facets.tags.map((t) => (
                <option key={t.slug} value={t.slug}>{t.name}</option>
              ))}
            </select>
          </label>
        )}
        {showPrice && (
          <>
            <label className={field}>
              <span>Min price</span>
              <input type="number" name="min" min={0} step="0.01" defaultValue={f.min ?? ''} />
            </label>
            <label className={field}>
              <span>Max price</span>
              <input type="number" name="max" min={0} step="0.01" defaultValue={f.max ?? ''} />
            </label>
          </>
        )}
        {showSort && (
          <label className={field}>
            <span>Sort</span>
            <select name="sort" defaultValue={f.sort}>
              {sortOptions.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </label>
        )}
        {showInStock && (
          <label className={field}>
            <input type="checkbox" name="instock" value="1" defaultChecked={!!f.inStock} />
            <span> In stock only</span>
          </label>
        )}
        {showOnSale && (
          <label className={field}>
            <input type="checkbox" name="onsale" value="1" defaultChecked={!!f.onSale} />
            <span> On sale</span>
          </label>
        )}
        {showRating && (
          <label className={field}>
            <span>Rating</span>
            <select name="rating" defaultValue={f.rating ? String(f.rating) : ''}>
              <option value="">Any rating</option>
              {[4, 3, 2, 1].map((n) => (
                <option key={n} value={String(n)}>{`${n} stars and up`}</option>
              ))}
            </select>
          </label>
        )}
        <button type="submit" className="archive-filter__apply">Apply</button>
        {isArchiveFilterActive(f) && <Link href={path} className="archive-filter__clear">Clear filters</Link>}
      </div>
    </ArchiveFilterForm>
  )
}

type Chip = { label: string; href: string }

/** One removable chip per active filter. Each link is the same archive address without that one filter. */
function chipsFor(f: NonNullable<ReturnType<typeof getBlockContext>['archive']>['filters'] & object, path: string, facets: { categories: { slug: string; name: string }[]; tags: { slug: string; name: string }[] }): Chip[] {
  const without = (patch: Partial<typeof f>): string => `${path}${archiveQueryString({ ...f, ...patch })}`
  const chips: Chip[] = []
  if (f.q) chips.push({ label: `Search: ${f.q}`, href: without({ q: '' }) })
  if (f.category) chips.push({ label: facets.categories.find((c) => c.slug === f.category)?.name ?? f.category, href: without({ category: '' }) })
  if (f.tag) chips.push({ label: `#${facets.tags.find((t) => t.slug === f.tag)?.name ?? f.tag}`, href: without({ tag: '' }) })
  if (f.min !== null) chips.push({ label: `From ${f.min}`, href: without({ min: null }) })
  if (f.max !== null) chips.push({ label: `Up to ${f.max}`, href: without({ max: null }) })
  if (f.inStock) chips.push({ label: 'In stock', href: without({ inStock: false }) })
  if (f.onSale) chips.push({ label: 'On sale', href: without({ onSale: false }) })
  if (f.rating) chips.push({ label: `${f.rating} stars and up`, href: without({ rating: null }) })
  return chips
}
