/**
 * Who may set, clear or list document passwords and shared password groups.
 *
 * Admins always may. Otherwise the existing permission matrix decides: a role that holds
 * "Password protect" (admin-visibility-password) may, and so may a role with content update on the
 * collection concerned, so a content editor can protect the pages or posts they are allowed to edit.
 * Per-document ownership (an own-scoped grant) is checked separately by assertDocAccess.
 */

import type { Action, Resource } from '@/features/roles/permissions'

export const PASSWORD_PERMISSION: Resource = 'admin-visibility-password'

/** Collections that can carry a document password (also the allow-list in the password routes). */
export const PASSWORD_COLLECTIONS = ['pages', 'posts', 'products', 'events'] as const

type PermissionContext = { isAdmin?: boolean; can: (resource: Resource, action: Action) => boolean }

/**
 * With a collection: may this user manage passwords on that collection's documents.
 * Without one (group and list routes): may this user manage passwords on any content collection.
 */
export function canManagePasswords(context: PermissionContext, collection?: string): boolean {
  if (context.isAdmin) return true
  if (context.can(PASSWORD_PERMISSION, 'update')) return true
  const targets: readonly string[] = collection ? [collection] : PASSWORD_COLLECTIONS
  return targets.some((target) => context.can(target as Resource, 'update'))
}
