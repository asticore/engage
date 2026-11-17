/**
 * The customer types a buyer counts as for price tiers and pricing rules: their roles (for example wholesale) and,
 * when companies are in use, each company they belong to, by name and by slug. A tier set for "Acme Pty" or
 * "company:acme-pty" therefore applies to every member of that company, whatever their role.
 * Never throws: with the companies tables missing or unreadable the buyer just has their roles.
 */

export type CompanyLike = { name?: string | null; slug?: string | null }

/** Roles plus company names and slugs, trimmed and without repeats. Pure. */
export function customerTypeList(roles: unknown, companies: CompanyLike[], extra: string[] = []): string[] {
  const out: string[] = []
  const add = (value: unknown) => {
    const v = typeof value === 'string' ? value.trim() : ''
    if (v && !out.some((x) => x.toLowerCase() === v.toLowerCase())) out.push(v)
  }
  for (const role of Array.isArray(roles) ? roles : []) add(role)
  for (const c of companies) {
    add(c.name)
    if (c.slug) add(`company:${c.slug}`)
  }
  for (const e of extra) add(e)
  return out
}

export async function customerTypesForUser(user: { id?: number | string; roles?: unknown } | null | undefined): Promise<string[]> {
  const roles = user?.roles
  const id = Number(user?.id)
  if (!user || !Number.isInteger(id) || id < 1) return customerTypeList(roles, [])
  // Wholesale role (approved applications) and customer tags: looked up on their own so a failure in one never hides the rest.
  const extra = await import('./wholesale').then((m) => m.wholesaleTypesForUser(id)).catch((): string[] => [])
  try {
    const { defaultOrgStore } = await import('@/features/organizations/store')
    return customerTypeList(roles, await defaultOrgStore.listOrgsForUser(id), extra)
  } catch {
    return customerTypeList(roles, [], extra)
  }
}
