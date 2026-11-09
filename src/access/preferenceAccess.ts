/**
 * Ownership rules for the preferences collection.
 *
 * The `user` field is polymorphic, so a `where` cannot name the owner. Rows
 * are therefore matched in code. By id (read/update/delete of one row) the
 * single row is fetched and its owner checked. For a list the owned ids are
 * collected and handed back as an `id in [...]` constraint the engine can
 * apply. Server helpers that pass `overrideAccess: true` never reach this.
 *
 * - read / update / delete: an admin, or the row's owner
 * - create: any signed-in user (the owner is then forced to the caller by
 *   `forceOwnerBeforeChange`)
 * - anonymous: nothing
 */

import type { Access, CollectionBeforeChangeHook } from '@/engine'
import type { Engine } from '@/localapi/engine'

type Owner = { id?: unknown; roles?: unknown } | null | undefined

/** True when the stored polymorphic `user` value (ids, `{relationTo,value}`, or a populated doc, bare or in an array) names this user. */
export function ownsPreference(doc: unknown, userId: unknown): boolean {
  const owner = (doc as { user?: unknown } | null | undefined)?.user
  const first = Array.isArray(owner) ? owner[0] : owner
  if (first === null || first === undefined) return false
  const value =
    typeof first === 'object' ? ((first as { value?: unknown; id?: unknown }).value ?? (first as { id?: unknown }).id) : first
  const id = typeof value === 'object' && value !== null ? (value as { id?: unknown }).id : value
  return String(id) === String(userId)
}

const isAdminUser = (user: Owner): boolean => Array.isArray(user?.roles) && (user.roles as unknown[]).includes('admin')

/** Matches no row (ids start at 1). */
const NO_ROWS = { id: { equals: -1 } }

const ownerOrAdmin: Access = async ({ req, id }) => {
  const user = req.user as Owner
  if (!user || user.id === undefined || user.id === null) return false
  if (isAdminUser(user)) return true

  const engine = req.engine as unknown as Engine

  if (id !== undefined && id !== null) {
    const row = await engine.findByID({ collection: 'preferences', id: Number(id), depth: 0, overrideAccess: true, disableErrors: true })
    return ownsPreference(row, user.id)
  }

  const all = await engine.find({ collection: 'preferences', depth: 0, limit: 0, pagination: false, overrideAccess: true })
  const mine = (all.docs as Array<{ id: number }>).filter((doc) => ownsPreference(doc, user.id)).map((doc) => doc.id)
  return mine.length > 0 ? { id: { in: mine } } : NO_ROWS
}

const signedIn: Access = ({ req }) => Boolean(req.user)

export const preferenceAccess = {
  create: signedIn,
  read: ownerOrAdmin,
  update: ownerOrAdmin,
  delete: ownerOrAdmin,
}

/**
 * A signed-in caller always owns what they create, whatever `user` the body
 * names, and an update can never move a row to another owner. A write with no
 * session (internal use) is left as given.
 */
export const forceOwnerBeforeChange: CollectionBeforeChangeHook = ({ data, req, operation, originalDoc }) => {
  const user = req.user as Owner
  if (!user || user.id === undefined || user.id === null) return data
  if (operation === 'create') return { ...data, user: [user.id] }
  if (operation === 'update' && !isAdminUser(user) && 'user' in data) {
    // `user` is required, so put the stored owner back rather than dropping the key.
    return { ...data, user: (originalDoc as { user?: unknown } | undefined)?.user }
  }
  return data
}
