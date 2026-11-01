import { parseHostList } from './scope'

/**
 * Which page a menu link points at on this domain. A menu stores the page's id, so when that page is scoped to another
 * domain it shows only if this domain has a page of its own at the same address, and points there. Pure, so the layout
 * and the tests share the rule.
 *
 * `onDomain` lists the pages this request can show (by id, and by address); `anyDomain` lists every published page.
 * With no registered host nothing is narrowed: the page the link names is used as it is.
 */
export type MenuPageEntry = { page: { id: number | string; availableDomains?: unknown }; path: string[] }

export function menuPageEntry<T extends MenuPageEntry>(
  pageId: number | string,
  host: string | null,
  onDomain: readonly T[],
  anyDomain: readonly T[],
): T | null {
  const id = String(pageId)
  const here = onDomain.find((entry) => String(entry.page.id) === id)
  if (here) return here
  const original = anyDomain.find((entry) => String(entry.page.id) === id)
  if (!original) return null
  if (!host) return original
  const address = original.path.join('/')
  const same = onDomain.find((entry) => entry.path.join('/') === address)
  return same && parseHostList(same.page.availableDomains).includes(host) ? same : null
}

/**
 * A menu link to a page scoped only to other domains (no same-address page here): the absolute address of that page on
 * its first domain, so the link still works from this domain. Null when the page is shared, scoped here, unknown, or when
 * the request is not on a registered domain. Pure.
 */
export function menuPageOtherDomain<T extends MenuPageEntry & { page: { isHomepage?: boolean } }>(
  pageId: number | string,
  host: string | null,
  anyDomain: readonly T[],
): { host: string; path: string } | null {
  if (!host) return null
  const id = String(pageId)
  const original = anyDomain.find((entry) => String(entry.page.id) === id)
  if (!original) return null
  const hosts = parseHostList(original.page.availableDomains)
  if (hosts.length === 0 || hosts.includes(host)) return null
  const target = hosts[0]
  return { host: target, path: original.page.isHomepage ? '/' : `/${original.path.join('/')}` }
}
