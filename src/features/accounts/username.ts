import type { Engine } from '@/engine'

import { USERS_SLUG } from './types'

/**
 * Usernames for sign-in (Task 23g).
 *
 * A username is optional, unique, stored lowercase and used only to find the
 * account at the sign-in form. It is never shown to anyone else. The lookup
 * only turns it into the account's email; the password check, the lockout and
 * the error text are the ones email sign-in already uses, so a username cannot
 * be probed for existence.
 */

export const USERNAME_MIN = 3
export const USERNAME_MAX = 32

const USERNAME_PATTERN = /^[a-z0-9_-]+$/

/** Words nobody may take: routes, roles and names that look official. */
export const RESERVED_USERNAMES: readonly string[] = [
  'admin',
  'administrator',
  'root',
  'system',
  'support',
  'help',
  'staff',
  'moderator',
  'owner',
  'webmaster',
  'postmaster',
  'security',
  'billing',
  'sales',
  'info',
  'contact',
  'api',
  'null',
  'undefined',
  'anonymous',
  'guest',
  'customer',
  'member',
  'editor',
  'account',
  'login',
  'logout',
  'signin',
  'signup',
  'register',
]

/** Trimmed and lowercased. Empty means "no username". */
export const normalizeUsername = (value: unknown): string => (typeof value === 'string' ? value.trim().toLowerCase() : '')

/** The reason a normalized, non-empty username is refused, or null when it is fine. */
export const usernameProblem = (username: string): string | null => {
  if (username.length < USERNAME_MIN || username.length > USERNAME_MAX) {
    return `A username is ${USERNAME_MIN} to ${USERNAME_MAX} characters long.`
  }
  if (!USERNAME_PATTERN.test(username)) {
    return 'A username can only use letters, digits, underscores and dashes.'
  }
  if (RESERVED_USERNAMES.includes(username)) return 'That username cannot be used.'
  return null
}

/** What the sign-in form sent can only be a username when it holds no "@" (every email has one). */
export const looksLikeUsername = (identifier: string): boolean => {
  const value = identifier.trim()
  return value.length > 0 && !value.includes('@')
}

/**
 * The email behind a username, or null when there is none. Case-insensitive,
 * because usernames are stored lowercase. Callers treat null exactly like a
 * wrong password.
 */
export const emailForUsername = async (engine: Engine, identifier: string): Promise<string | null> => {
  const username = normalizeUsername(identifier)
  if (!username || usernameProblem(username)) return null
  try {
    const found = await engine.find({
      collection: USERS_SLUG,
      where: { username: { equals: username } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    const user = found.docs[0] as { email?: string | null } | undefined
    return user?.email ? user.email.trim().toLowerCase() : null
  } catch {
    return null
  }
}
