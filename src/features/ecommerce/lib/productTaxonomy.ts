import { slugify } from '@/utilities/formatSlug'

/**
 * Brand and tags of a product for the storefront. The product page reads them with depth 1, so each is an object
 * with a name; an id that was not populated is skipped rather than shown as a number.
 */

const nameOf = (value: unknown): string | null => {
  if (!value || typeof value !== 'object') return null
  const name = (value as { name?: unknown }).name
  if (typeof name !== 'string') return null
  const trimmed = name.trim()
  return trimmed ? trimmed : null
}

export function brandName(brand: unknown): string | null {
  return nameOf(brand)
}

/** Tag names in the order they were picked, without repeats. */
export function tagNames(tags: unknown): string[] {
  if (!Array.isArray(tags)) return []
  const out: string[] = []
  for (const tag of tags) {
    const name = nameOf(tag)
    if (name && !out.includes(name)) out.push(name)
  }
  return out
}

/** Fills the one placeholder of a translated line ({name} or {tags}). The value is inserted as text, never as a pattern. */
export function fillLine(template: string, value: string): string {
  return template.replace(/\{(?:name|tags)\}/, () => value)
}

/** The brand's key in a link or filter: the slug of its name, so ?brand=acme matches the brand "Acme". */
export function brandKey(brand: unknown): string | null {
  const name = nameOf(brand)
  return name ? slugify(name) : null
}

/** One choice per distinct brand across the products, by name, for the brand filter. */
export function brandOptionsOf(products: unknown[]): { slug: string; name: string }[] {
  const out = new Map<string, string>()
  for (const product of products) {
    const brand = (product as { brand?: unknown } | null)?.brand
    const slug = brandKey(brand)
    if (slug && !out.has(slug)) out.set(slug, brandName(brand) ?? slug)
  }
  return [...out.entries()].map(([slug, name]) => ({ slug, name })).sort((a, b) => a.name.localeCompare(b.name))
}

/** One choice per distinct tag across the products, by name, for the tag filter. */
export function tagOptionsOf(products: unknown[]): { slug: string; name: string }[] {
  const out = new Map<string, string>()
  for (const product of products) {
    for (const name of tagNames((product as { tags?: unknown } | null)?.tags)) {
      const slug = slugify(name)
      if (slug && !out.has(slug)) out.set(slug, name)
    }
  }
  return [...out.entries()].map(([slug, name]) => ({ slug, name })).sort((a, b) => a.name.localeCompare(b.name))
}

/** True when the brand name or one of the tag names contains the search text (case-insensitive). Used by site search. */
export function productTaxonomyMatches(product: unknown, query: string): boolean {
  const needle = query.trim().toLowerCase()
  if (!needle) return false
  const brand = brandName((product as { brand?: unknown } | null)?.brand)
  if (brand && brand.toLowerCase().includes(needle)) return true
  return tagNames((product as { tags?: unknown } | null)?.tags).some((name) => name.toLowerCase().includes(needle))
}
