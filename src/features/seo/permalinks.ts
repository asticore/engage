/**
 * Task 16e, blog address (the first slice of permalink names). Pure and edge-safe: the middleware,
 * the sitemap, the blog canonical tags and the SEO field validator all use the same rules from here.
 *
 * The owner sets `permalinks.blogBase` on SEO settings. The blog itself stays in the app folder
 * /blog. A custom address is a rewrite in the middleware, and the old /blog address redirects to
 * the new one (308). Only the blog moves in this slice; the shop and product bases stay as they are.
 */

import { RESERVED_ADMIN_PATHS } from '@/features/security/adminPath'

export const DEFAULT_BLOG_BASE = 'blog'
export const BLOG_BASE_MIN_LENGTH = 3
export const BLOG_BASE_MAX_LENGTH = 40

const SEGMENT = /^[a-z0-9-]+$/

/**
 * Top-level routes of the site that are not in the admin list. A blog address may never take one of
 * these, or the rewrite would hide a real page.
 */
const SITE_ROUTES: readonly string[] = [
  'admin',
  'affiliates',
  'book',
  'client-report',
  'courses',
  'feed',
  'font-files',
  'go',
  'quote',
  'request-quote',
  'styles',
  'wishlist',
  'indexnow-key',
  'humans',
  'llms',
  'manifest',
  'page',
  'not-found',
  'error',
]

const RESERVED = new Set<string>([...RESERVED_ADMIN_PATHS, ...SITE_ROUTES])

export type BlogBaseError = 'format' | 'length' | 'reserved' | 'admin' | 'signIn'

export const BLOG_BASE_MESSAGES: Record<BlogBaseError, string> = {
  format: 'Use lowercase letters, digits and hyphens, in one part, for example news.',
  length: 'The blog address must be between 3 and 40 characters.',
  reserved: 'That word is used by the site itself. Choose another blog address.',
  admin: 'The blog address cannot be the admin address or sit under it.',
  signIn: 'The blog address cannot be a sign-in address.',
}

export type BlogBaseContext = {
  /** The admin root in use (resolveAdminRoot). */
  adminRoot: string
  /** The sign-in paths in use, with a leading slash each. */
  signInPaths: readonly string[]
}

/** Trims whitespace and slashes. Empty input gives ''. The result has no leading slash. */
export function normaliseBlogBase(raw: unknown): string {
  if (typeof raw !== 'string') return ''
  return raw.trim().replace(/^\/+|\/+$/g, '')
}

/**
 * Null when the value is a valid blog address, otherwise the first rule it breaks. The default
 * address is always valid. Empty counts as the default, so callers check it first.
 */
export function validateBlogBase(raw: unknown, context: BlogBaseContext): BlogBaseError | null {
  const core = normaliseBlogBase(raw)
  if (core === '' || core === DEFAULT_BLOG_BASE) return null
  if (!SEGMENT.test(core)) return 'format'
  if (core.length < BLOG_BASE_MIN_LENGTH || core.length > BLOG_BASE_MAX_LENGTH) return 'length'
  if (RESERVED.has(core)) return 'reserved'
  const path = `/${core}`
  const admin = context.adminRoot
  if (path === admin || path.startsWith(`${admin}/`) || admin.startsWith(`${path}/`)) return 'admin'
  if (context.signInPaths.includes(path)) return 'signIn'
  return null
}

/**
 * The blog address to serve and link to: the saved value when it is valid on its own rules, else
 * the default. A bad stored value can never take the blog away.
 */
export function resolveBlogBase(raw: unknown): string {
  const core = normaliseBlogBase(raw)
  if (core === '') return DEFAULT_BLOG_BASE
  if (!SEGMENT.test(core) || core.length < BLOG_BASE_MIN_LENGTH || core.length > BLOG_BASE_MAX_LENGTH) return DEFAULT_BLOG_BASE
  if (RESERVED.has(core)) return DEFAULT_BLOG_BASE
  return core
}

/** The public path of a blog address and what follows it, for example blogPath('news', '/hello') gives /news/hello. */
export function blogPath(base: string, rest = ''): string {
  return `/${base || DEFAULT_BLOG_BASE}${rest}`
}

/** True when the pathname is the root or inside it. */
export function isUnderPath(pathname: string, root: string): boolean {
  return pathname === root || pathname.startsWith(`${root}/`)
}
