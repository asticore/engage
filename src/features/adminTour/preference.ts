/**
 * Server side of the admin tour: reads and writes the signed-in user's own
 * `admin-tour` row in the preferences collection.
 *
 * The collection declares no per-row access, so these helpers enforce
 * ownership themselves: the row is found by key and then filtered to the
 * session user in code (the polymorphic `user` field cannot be queried), a
 * create takes its owner from the session only, and an update targets only an
 * id that came back from that owner filter. Mirrors src/admin/editPrefs.ts.
 */

import type { Engine, TypedUser } from '@/engine'

import { ADMIN_TOUR_PREF_KEY, buildTourPref, parseTourPref, type TourPref, type TourStatus } from './steps'

function belongsTo(doc: unknown, user: TypedUser): boolean {
  const owner = (doc as { user?: unknown }).user
  const first = Array.isArray(owner) ? owner[0] : owner
  if (first === null || first === undefined) return false
  const value =
    typeof first === 'object' ? (first as { value?: unknown; id?: unknown }).value ?? (first as { id?: unknown }).id : first
  const id = typeof value === 'object' && value !== null ? (value as { id?: unknown }).id : value
  return String(id) === String(user.id)
}

async function ownRow(engine: Engine, user: TypedUser): Promise<{ id: unknown; value?: unknown } | null> {
  const found = await engine.find({
    collection: 'preferences',
    where: { key: { equals: ADMIN_TOUR_PREF_KEY } },
    depth: 0,
    limit: 1000,
    pagination: false,
    user,
    overrideAccess: true,
  })
  const mine = (found.docs ?? []).filter((doc) => belongsTo(doc, user))
  return (mine[0] as { id: unknown; value?: unknown } | undefined) ?? null
}

/** The user's stored tour preference, or null when they have not seen it. Throws if the read fails. */
export async function loadTourPref(engine: Engine, user: TypedUser | null): Promise<TourPref | null> {
  if (!user) return null
  const row = await ownRow(engine, user)
  return parseTourPref(row?.value)
}

/** Stores that the user has seen the tour. Returns the stored value. */
export async function saveTourPref(engine: Engine, user: TypedUser | null, status: TourStatus): Promise<TourPref | null> {
  if (!user) return null
  const next = buildTourPref(status)
  const row = await ownRow(engine, user)
  if (row) {
    await engine.update({
      collection: 'preferences',
      id: row.id as number,
      data: { value: next },
      user,
      overrideAccess: true,
    })
  } else {
    await engine.create({
      collection: 'preferences',
      data: { key: ADMIN_TOUR_PREF_KEY, user: [user.id], value: next } as never,
      user,
      overrideAccess: true,
    })
  }
  return next
}

/** Layout helper: true only when the user has no stored preference. A failed read means "do not show". */
export async function resolveTourAutoStart(engine: Engine, user: TypedUser | null): Promise<boolean> {
  if (!user) return false
  try {
    return (await loadTourPref(engine, user)) === null
  } catch {
    return false
  }
}
