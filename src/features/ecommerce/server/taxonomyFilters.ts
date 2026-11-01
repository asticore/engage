/**
 * Brand and tag filters done in the database. A product stores its brand and its
 * tags as relationships, so a filter by name first finds the matching brand and tag
 * ids (both lists are small) and then asks the products table for those ids. This
 * replaces scanning the newest products in memory, which only saw part of a shop.
 */

import { slugify } from '@/utilities/formatSlug'

type Finder = {
  find(args: { collection: string; where?: Record<string, unknown>; limit?: number; depth?: number; overrideAccess?: boolean }): Promise<{ docs: unknown[] }>
}

/** Taxonomy lists are read whole; a shop does not have thousands of brands or tags. */
const TAXONOMY_LIMIT = 1000

const nameOfDoc = (doc: unknown): string => {
  const name = (doc as { name?: unknown } | null)?.name
  return typeof name === 'string' ? name.trim() : ''
}

/** Ids of the brands whose name passes `matches`. */
export async function brandIdsWhere(engine: Finder, matches: (name: string) => boolean): Promise<number[]> {
  const { docs } = await engine.find({ collection: 'product-brands', limit: TAXONOMY_LIMIT, depth: 0, overrideAccess: true })
  return (docs as { id?: unknown; name?: unknown }[])
    .filter((doc) => typeof doc.id === 'number' && matches(nameOfDoc(doc)))
    .map((doc) => doc.id as number)
}

/** Ids of the tags whose name passes `matches`. */
export async function tagIdsWhere(engine: Finder, matches: (name: string) => boolean): Promise<number[]> {
  const { docs } = await engine.find({ collection: 'product-tags', limit: TAXONOMY_LIMIT, depth: 0, overrideAccess: true })
  return (docs as { id?: unknown; name?: unknown }[])
    .filter((doc) => typeof doc.id === 'number' && matches(nameOfDoc(doc)))
    .map((doc) => doc.id as number)
}

/** The brand ids whose slug (the name slugified, as in brandKey) is `slug`. */
export function brandIdsForSlug(engine: Finder, slug: string): Promise<number[]> {
  return brandIdsWhere(engine, (name) => slugify(name) === slug)
}

/** The tag ids whose slug is `slug`. */
export function tagIdsForSlug(engine: Finder, slug: string): Promise<number[]> {
  return tagIdsWhere(engine, (name) => slugify(name) === slug)
}

/**
 * The product where-clause for "brand is one of these ids". An empty list matches
 * nothing, so the caller can keep the clause in place without a special case.
 */
export const brandIn = (ids: number[]) => ({ brand: { in: ids.length > 0 ? ids : [-1] } })

/** The product where-clause for "has one of these tags". An empty list matches nothing. */
export const tagIn = (ids: number[]) => ({ tags: { in: ids.length > 0 ? ids : [-1] } })
