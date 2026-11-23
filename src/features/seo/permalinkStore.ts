import { shareInflight } from '@/lib/shareInflight'
import { DEFAULT_BLOG_BASE, DEFAULT_SHOP_BASE, resolveBlogBase, resolveShopBase } from './permalinks'

/**
 * Reads the saved blog address (Task 16e) for the middleware, the sitemap and the blog canonical tags.
 * One row, cached for a minute per isolate, the same way the security settings are read. Saving
 * drops this isolate's copy at once (see the SEO settings afterChange hook).
 *
 * Fails open: a missing table or column, or no D1 binding (tests, local dev), gives the default.
 */

const CACHE_TTL_MS = 60_000
const SEO_SETTINGS_TABLE = 'eg_seo_settings'

let cached: { at: number; value: string } | null = null

async function getD1(): Promise<D1Database | null> {
  try {
    const { getCloudflareContext } = await import('@opennextjs/cloudflare')
    const context = await getCloudflareContext({ async: true })
    return context?.env?.D1 ?? null
  } catch {
    return null
  }
}

async function readBlogBaseImpl(): Promise<string> {
  // Recovery: an environment variable wins over the saved value, for a site locked out by a bad address.
  const override = typeof process !== 'undefined' ? process.env?.ENGAGE_BLOG_BASE : undefined
  if (typeof override === 'string' && override.trim()) return resolveBlogBase(override)
  const now = Date.now()
  if (cached && now - cached.at < CACHE_TTL_MS) return cached.value

  let value = DEFAULT_BLOG_BASE
  try {
    const db = await getD1()
    if (db) {
      const rows = await db.prepare(`SELECT permalinks_blog_base AS blog_base FROM \`${SEO_SETTINGS_TABLE}\` LIMIT 1`).all()
      const raw = (rows.results?.[0] as { blog_base?: unknown } | undefined)?.blog_base
      value = resolveBlogBase(raw)
    }
  } catch {
    // Keep the default: the blog must stay reachable on a half-migrated database.
  }
  cached = { at: now, value }
  return value
}

/** Drops the isolate's copy so the next request re-reads. Called after a save. */
export function invalidateBlogBaseCache(): void {
  cached = null
  cachedShop = null
}

/** Concurrent callers share one read (see shareInflight). */
export const readBlogBase: () => Promise<string> = shareInflight(readBlogBaseImpl)

let cachedShop: { at: number; value: string } | null = null

async function readShopBaseImpl(): Promise<string> {
  const blog = await readBlogBase()
  // Recovery: an environment variable wins over the saved value, for a site locked out by a bad address.
  const override = typeof process !== 'undefined' ? process.env?.ENGAGE_SHOP_BASE : undefined
  if (typeof override === 'string' && override.trim()) return resolveShopBase(override, blog)
  const now = Date.now()
  if (cachedShop && now - cachedShop.at < CACHE_TTL_MS) return cachedShop.value

  let value = DEFAULT_SHOP_BASE
  try {
    const db = await getD1()
    if (db) {
      const rows = await db.prepare(`SELECT permalinks_shop_base AS shop_base FROM \`${SEO_SETTINGS_TABLE}\` LIMIT 1`).all()
      const raw = (rows.results?.[0] as { shop_base?: unknown } | undefined)?.shop_base
      value = resolveShopBase(raw, blog)
    }
  } catch {
    // Keep the default: the shop must stay reachable on a half-migrated database.
  }
  cachedShop = { at: now, value }
  return value
}

/** The saved shop address (Task 16e), read like the blog address: one row, a minute per isolate, fails open to /shop. */
export const readShopBase: () => Promise<string> = shareInflight(readShopBaseImpl)
