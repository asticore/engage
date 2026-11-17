/**
 * The configurable customer and member sign-in URLs (Task 19l). Pure and edge-safe: the middleware,
 * the Security field validators and the tests all use the same rules from here.
 *
 * The owner sets the two paths on the Security screen. ENGAGE_CUSTOMER_SIGN_IN_PATH and
 * ENGAGE_MEMBER_SIGN_IN_PATH, when set to a valid path, win over the settings, so an owner who
 * forgets a URL can recover from the Cloudflare dashboard without touching the database. The
 * routes themselves stay at the default paths; a custom path is a rewrite in the middleware and
 * the default path redirects to it.
 */

import { RESERVED_ADMIN_PATHS, normaliseAdminPath } from './adminPath'

export const DEFAULT_CUSTOMER_SIGN_IN_PATH = '/account/sign-in'
export const DEFAULT_MEMBER_SIGN_IN_PATH = '/account/member-sign-in'
export const CUSTOMER_SIGN_IN_PATH_ENV = 'ENGAGE_CUSTOMER_SIGN_IN_PATH'
export const MEMBER_SIGN_IN_PATH_ENV = 'ENGAGE_MEMBER_SIGN_IN_PATH'

export const SIGN_IN_PATH_MIN_LENGTH = 3
export const SIGN_IN_PATH_MAX_LENGTH = 40

/** The admin and the site's own routes can never be a sign-in path. */
const RESERVED = new Set<string>([...RESERVED_ADMIN_PATHS, 'admin'])

export type SignInPathError = 'format' | 'length' | 'reserved' | 'admin' | 'clash'

export type SignInPlace = 'customer' | 'member'

export const DEFAULT_SIGN_IN_PATHS: Record<SignInPlace, string> = {
  customer: DEFAULT_CUSTOMER_SIGN_IN_PATH,
  member: DEFAULT_MEMBER_SIGN_IN_PATH,
}

const SEGMENT = /^[a-z0-9-]+$/

export type SignInPathContext = {
  /** The admin root in use (resolveAdminRoot). The sign-in path may never equal it or sit under it. */
  adminRoot: string
  /** The other sign-in place's path in use. The two places may not share a path. */
  otherPath?: string
}

/**
 * Null when the value is a valid sign-in path, otherwise the first rule it breaks. The default path
 * is always valid. Empty is not valid here; callers treat empty as "use the default" first.
 */
export function validateSignInPath(raw: unknown, place: SignInPlace, context: SignInPathContext): SignInPathError | null {
  const normalised = normaliseAdminPath(raw)
  if (normalised === DEFAULT_SIGN_IN_PATHS[place]) return null
  const core = normalised.slice(1)
  if (!SEGMENT.test(core)) return 'format'
  if (core.length < SIGN_IN_PATH_MIN_LENGTH || core.length > SIGN_IN_PATH_MAX_LENGTH) return 'length'
  if (RESERVED.has(core)) return 'reserved'
  const admin = context.adminRoot
  if (normalised === admin || normalised.startsWith(`${admin}/`) || admin.startsWith(`${normalised}/`)) return 'admin'
  const other = context.otherPath
  if (other && (normalised === other || normalised === DEFAULT_SIGN_IN_PATHS[place === 'customer' ? 'member' : 'customer'])) return 'clash'
  return null
}

const usable = (raw: unknown, place: SignInPlace, context: SignInPathContext): string | null => {
  const normalised = normaliseAdminPath(raw)
  return normalised && validateSignInPath(normalised, place, context) === null ? normalised : null
}

/**
 * The two sign-in paths to serve and link to. Per place: env override first, then the saved
 * setting, then the default. An invalid, empty or clashing value is skipped, so a bad value can
 * never make a sign-in place unreachable.
 */
export function resolveSignInPaths(
  setting: { customer?: unknown; member?: unknown },
  env: { customer?: unknown; member?: unknown },
  adminRoot: string,
): Record<SignInPlace, string> {
  const customerOnly = usable(env.customer, 'customer', { adminRoot }) ?? usable(setting.customer, 'customer', { adminRoot }) ?? DEFAULT_CUSTOMER_SIGN_IN_PATH
  const member =
    usable(env.member, 'member', { adminRoot, otherPath: customerOnly }) ??
    usable(setting.member, 'member', { adminRoot, otherPath: customerOnly }) ??
    DEFAULT_MEMBER_SIGN_IN_PATH
  // The customer path must also not collide with the member path in use (the member default counts).
  const customer = customerOnly === member ? DEFAULT_CUSTOMER_SIGN_IN_PATH : customerOnly
  return { customer, member }
}

/** True when the pathname is the sign-in root or inside it. */
export function isUnderSignInRoot(pathname: string, root: string): boolean {
  return pathname === root || pathname.startsWith(`${root}/`)
}

export const SIGN_IN_PATH_MESSAGES: Record<SignInPathError, string> = {
  format: 'Use lowercase letters, digits and hyphens, in one part, for example /welcome-in.',
  length: 'The sign-in URL must be between 3 and 40 characters.',
  reserved: 'That word is used by the site itself. Choose another sign-in URL.',
  admin: 'The sign-in URL cannot be the admin URL or sit under it.',
  clash: 'The customer and member sign-in cannot share one URL.',
}
