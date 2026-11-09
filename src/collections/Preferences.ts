import type { CollectionConfig } from '@/engine'

import { forceOwnerBeforeChange, preferenceAccess } from '@/access/preferenceAccess'
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
 * Access: read/update/delete are admin or the row's owner, create is any
 * signed-in user with the owner forced to the caller, anonymous gets nothing
 * (see `src/access/preferenceAccess.ts`). Before this the collection fell back
 * to the "any signed-in user" default, so one user could list, read, edit and
 * delete another's rows over `/api/preferences`. Server helpers pass
 * `overrideAccess: true` and keep filtering to the session user themselves.
 */
export const Preferences: CollectionConfig = {
  slug: PREFERENCES_SLUG,
  dbName: 'eg_preferences',
  access: preferenceAccess,
  hooks: { beforeChange: [forceOwnerBeforeChange] },
  fields: [
    { name: 'user', type: 'relationship', relationTo: ['users'], required: true },
    { name: 'key', type: 'text' },
    { name: 'value', type: 'json' },
  ],
}
