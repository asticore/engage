import type { Engine, TypedUser } from '@/engine'

import { allowedHostsFor } from './access'

/**
 * The admin site switcher: which registered site the admin lists and new content use. The choice is per signed-in
 * person, saved in the shared `preferences` collection under one key (the same store as the list columns and sort).
 *
 * Rules (pure apart from the two reads, so the tests can drive them with plain objects):
 * - Only sites the account may use are offered: its Allowed domains, or every active domain when it has none.
 * - "All sites" is offered only to an account with no domain limit (admins, and editors with no list).
 * - With no saved choice, or a choice the account may no longer use, the primary domain is the default (else the first
 *   site the account can use). A null result means no site filter.
 * - The server applies the same rule on every save, so a choice cannot widen what the account may see.
 */

export const ADMIN_SITE_PREF_KEY = 'admin-site'
export const ALL_SITES = 'all'

export type RegisteredSite = { host: string; label: string; status: 'active' | 'disabled'; isPrimary: boolean }

export type VisibleSites = { sites: RegisteredSite[]; unrestricted: boolean; primary: string | null }

type Actor = Parameters<typeof allowedHostsFor>[0]

/** The registry rows the admin can read (host, name, status, primary). Empty when the registry is unreadable. */
export async function registeredSites(engine: Engine): Promise<RegisteredSite[]> {
  const doc = (await engine.findGlobal({ slug: 'domain-settings', depth: 0 }).catch((): null => null)) as { domains?: unknown } | null
  const rows = Array.isArray(doc?.domains) ? (doc.domains as Record<string, unknown>[]) : []
  return rows
    .filter((row) => typeof row.host === 'string' && row.host.length > 0)
    .map((row) => ({
      host: (row.host as string).toLowerCase(),
      label: typeof row.label === 'string' && row.label.trim() ? row.label.trim() : (row.host as string),
      status: row.status === 'disabled' ? ('disabled' as const) : ('active' as const),
      isPrimary: Boolean(row.isPrimary),
    }))
}

/** The active sites this account may use, plus whether it has no domain limit at all. */
export function visibleSitesFor(user: Actor, registry: readonly RegisteredSite[]): VisibleSites {
  const allowed = allowedHostsFor(user)
  const active = registry.filter((site) => site.status === 'active')
  const sites = allowed === null ? active : active.filter((site) => allowed.includes(site.host))
  const primary = sites.find((site) => site.isPrimary)?.host ?? sites[0]?.host ?? null
  return { sites, unrestricted: allowed === null, primary }
}

/**
 * The site the admin is working on: a host, or null for "no site filter" (All sites, or nothing registered).
 * `choice` is the saved value (a host, ALL_SITES or null). Pure.
 */
export function effectiveSite(choice: string | null | undefined, visible: VisibleSites): string | null {
  if (choice === ALL_SITES && visible.unrestricted) return null
  if (choice && visible.sites.some((site) => site.host === choice)) return choice
  return visible.primary
}

/** Whether a saved choice is one the account may save now (a visible host, or All sites for an unrestricted account). */
export function isChoiceAllowed(choice: unknown, visible: VisibleSites): choice is string {
  if (typeof choice !== 'string') return false
  if (choice === ALL_SITES) return visible.unrestricted
  return visible.sites.some((site) => site.host === choice)
}

const ownedBy = (doc: unknown, user: TypedUser): boolean => {
  const owner = (doc as { user?: unknown }).user
  const first = Array.isArray(owner) ? owner[0] : owner
  if (first === null || first === undefined) return false
  const value = typeof first === 'object' ? ((first as { value?: unknown; id?: unknown }).value ?? (first as { id?: unknown }).id) : first
  const id = typeof value === 'object' && value !== null ? (value as { id?: unknown }).id : value
  return String(id) === String(user.id)
}

/** The saved choice for this person, or null. Errors read as no choice. */
export async function readSiteChoice(engine: Engine, user: TypedUser | null): Promise<string | null> {
  if (!user) return null
  try {
    const docs = await engine.find({
      collection: 'preferences',
      where: { key: { equals: ADMIN_SITE_PREF_KEY } },
      depth: 0,
      limit: 1000,
      pagination: false,
      user,
      overrideAccess: true,
    })
    const mine = (docs.docs ?? []).filter((doc) => ownedBy(doc, user))
    const value = (mine[0] as { value?: { site?: unknown } } | undefined)?.value
    return typeof value?.site === 'string' ? value.site : null
  } catch {
    return null
  }
}

/** Saves the choice for this person (a host or ALL_SITES). The caller has already checked it with isChoiceAllowed. */
export async function saveSiteChoice(engine: Engine, user: TypedUser, site: string): Promise<void> {
  const docs = await engine.find({
    collection: 'preferences',
    where: { key: { equals: ADMIN_SITE_PREF_KEY } },
    depth: 0,
    limit: 1000,
    pagination: false,
    user,
    overrideAccess: true,
  })
  const mine = (docs.docs ?? []).filter((doc) => ownedBy(doc, user))
  if (mine.length > 0) {
    await engine.update({
      collection: 'preferences',
      id: (mine[0] as { id?: unknown }).id as number,
      data: { value: { site } },
      user,
      overrideAccess: true,
    })
    return
  }
  await engine.create({
    collection: 'preferences',
    data: { key: ADMIN_SITE_PREF_KEY, user: [user.id], value: { site } } as never,
    user,
    overrideAccess: true,
  })
}

/** Everything the server needs for one admin request: the visible sites and the effective host (null = no filter). */
export async function resolveAdminSite(engine: Engine, user: TypedUser | null): Promise<{ visible: VisibleSites; host: string | null; choice: string | null }> {
  const visible = visibleSitesFor(user as unknown as Actor, await registeredSites(engine))
  const choice = await readSiteChoice(engine, user)
  return { visible, host: effectiveSite(choice, visible), choice }
}
