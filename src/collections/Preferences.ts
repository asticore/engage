import type { Access, CollectionBeforeChangeHook, CollectionConfig } from '@/engine'

import { PREFERENCES_SLUG } from '@/features/accounts/types'

/**
 * The reference engine's own internal `engine-preferences` collection, reproduced
 * just enough to back this app's local `engine.find/create/update` calls
 * (`src/features/accounts/preferences.ts`, `AdminNav.tsx`, `NavGroup.tsx` -
 * confirmed the only real callers, all via the plain Local API, never the
 * REST `/:key` convenience endpoint the reference engine also exposes - that
 * endpoint is deliberately NOT reproduced here, see rest.ts's header for
 * why).
 *
 * FIDELITY NOTE - the `user` field: the reference engine declares this as
 * `relationTo: [...every auth-enabled collection]`, which is why the real
 * `eg_preferences` table has NO `user_id` column of its own and instead
 * carries the relationship through the shared `eg_preferences_rels` table
 * (confirmed by tracing every migration in `src/migrations/index.ts` - see
 * the plan doc's architecture-reference section). This app has exactly one
 * auth collection (`users`), so `relationTo: ['users']` here is not a
 * simplification - it is the exact real shape, just with a one-element
 * array instead of the original engine's own multi-collection one. Declaring it as an
 * array (rather than a plain single-target `relationTo: 'users'`) is what
 * routes it through `generateRelsTable`/`createCollectionOps`'s
 * `topLevelRelsFieldTargets` machinery instead of a plain `user_id` column -
 * see ../cms/db/schema/index.ts's `preferencesGenerated` and
 * ../cms/db/collections/preferences.ts.
 *
 * `key`/`value` are plain columns, matching the real `eg_preferences` table
 * exactly (id, key, value, updated_at, created_at - confirmed, no other
 * columns exist).
 *
 * ACCESS - owner-only. The reference engine restricts read/update/delete to
 * the owning user and lets any logged-in user create. This collection used to
 * declare no `access` block at all, which does NOT fall back to anything
 * owner-scoped: `executeAccess` (`src/localapi/access.ts`) treats a missing
 * access function as "allowed, unrestricted" for any signed-in caller, so
 * every signed-in user could list, read, update and delete every other
 * user's rows through `/api/preferences` (the REST handlers in
 * `src/localapi/rest.ts` pass `overrideAccess: false` on reads and leave it
 * unset - i.e. enforced - on writes, but enforced-with-no-rule is open).
 *
 * The owner check cannot be a plain `{ user: { equals: id } }` Where: `user`
 * is a rels-table field, which `src/cms/db/where.ts` cannot map, and the two
 * in-memory matchers (`operations.ts`/`read-operations.ts` `matchesWhere`)
 * compare `doc[field]` by identity against a `number[]`. So the access
 * function resolves the caller's own row ids first (a trusted,
 * `overrideAccess: true`, depth-0 scan filtered in code - the same
 * `belongsTo` shape every server helper already uses) and returns
 * `{ id: { in: ownIds } }`, which every one of the three matchers handles.
 * The table is one row per user per remembered UI setting, so the scan stays
 * small.
 *
 * Trusted server helpers (`src/admin/editPrefs.ts`, `src/admin/list/listPrefs.ts`,
 * `src/features/domains/adminSite.ts`, `AdminNav.tsx`'s nav-state read) pass
 * `overrideAccess: true` or use the Local API's read default, and keep
 * working unchanged; `src/features/accounts/preferences.ts`'s access-enforced
 * read now actually gets narrowed to the caller's own rows.
 *
 * `create` needs a signed-in caller, and the `beforeChange` hook stamps the
 * owner from the session (any `user` in the request body is ignored). On
 * update, a non-admin cannot reassign a row's owner.
 */
const isAdminUser = (user: unknown): boolean => Boolean((user as { roles?: string[] } | null | undefined)?.roles?.includes('admin'))

/** The owner id of a depth-0 preferences row (`user` comes back as `number[]`), tolerant of a populated/polymorphic shape. */
const ownerIdOf = (doc: unknown): string | null => {
  const owner = (doc as { user?: unknown }).user
  const first = Array.isArray(owner) ? owner[0] : owner
  if (first === null || first === undefined) return null
  const value = typeof first === 'object' ? ((first as { value?: unknown; id?: unknown }).value ?? (first as { id?: unknown }).id) : first
  const id = typeof value === 'object' && value !== null ? (value as { id?: unknown }).id : value
  return id === null || id === undefined ? null : String(id)
}

/** Admin: everything. Other signed-in users: only rows they own. Anonymous: nothing. */
const adminOrOwner: Access = async ({ req }) => {
  const user = req.user
  if (!user) return false
  if (isAdminUser(user)) return true
  const { docs } = await req.engine.find({ collection: PREFERENCES_SLUG, depth: 0, pagination: false, overrideAccess: true })
  const ownIds = (docs as Array<{ id: number }>).filter((doc) => ownerIdOf(doc) === String(user.id)).map((doc) => doc.id)
  // Row ids start at 1, so `[0]` matches nothing - avoids an empty `IN ()`.
  return { id: { in: ownIds.length > 0 ? ownIds : [0] } }
}

/**
 * Create: the owner is always the signed-in caller. Update: a non-admin keeps
 * the row's existing owner. The field-level `beforeValidate` step always sets
 * a `data.user` key (to `undefined` when the request sent none), so the value
 * is pinned to `originalDoc.user` rather than deleted - deleting the key fails
 * the field's `required` check on a plain `{ value }` update.
 */
const stampOwner: CollectionBeforeChangeHook = ({ data, req, operation, originalDoc }) => {
  const user = req.user
  if (!user || !data) return data
  if (operation === 'create') return { ...data, user: [user.id] }
  if (!isAdminUser(user) && 'user' in data) return { ...data, user: (originalDoc as { user?: unknown } | undefined)?.user }
  return data
}

export const Preferences: CollectionConfig = {
  slug: PREFERENCES_SLUG,
  dbName: 'eg_preferences',
  access: {
    create: ({ req }) => Boolean(req.user),
    read: adminOrOwner,
    update: adminOrOwner,
    delete: adminOrOwner,
  },
  hooks: {
    beforeChange: [stampOwner],
  },
  fields: [
    { name: 'user', type: 'relationship', relationTo: ['users'], required: true },
    { name: 'key', type: 'text' },
    { name: 'value', type: 'json' },
  ],
}
