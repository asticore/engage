import type { D1Like } from './store'

/**
 * Access-control query helper (Task 23j). One place that answers "which companies and teams is this
 * person in, and may they see this record?", so the shop (orders), forms (submissions), approval
 * (requests) and the taskboard (tasks) all ask the same question the same way.
 *
 * Usage:
 *   const access = await loadOrgAccess(d1, userId)           // two small queries
 *   mayAccessRecord(access, { organizationId, teamId, ownerUserId })   // one record
 *   const { clause, binds } = orgScopeClause('organization_id', 'team_id', access) // many records, in SQL
 *
 * Rules: a record with no organisation and no team is not scoped (this helper says nothing about it, so
 * callers apply their own rule). A record is visible to its owner, to any member of its organisation when
 * it names no team, and to members of its team when it names one. Company owners and admins see every
 * record of their organisation. A missing user sees nothing scoped. Lookup failures lock: callers get
 * the empty access and so no scoped records.
 */

export type OrgMembership = { organizationId: string; role: string; teamIds: string[] }
export type OrgAccess = { userId: number | null; memberships: OrgMembership[] }

export type ScopedRecord = { organizationId?: string | null; teamId?: string | null; ownerUserId?: number | null }

export const NO_ORG_ACCESS: OrgAccess = { userId: null, memberships: [] }

const MANAGER_ROLES = ['owner', 'admin']

/** Reads the person's memberships and team memberships. Returns the empty access when the person is unknown or a lookup fails. */
export async function loadOrgAccess(d1: D1Like, userId: number | null | undefined): Promise<OrgAccess> {
  if (typeof userId !== 'number' || !Number.isFinite(userId)) return NO_ORG_ACCESS
  try {
    const members = ((await d1.prepare('SELECT organization_id, role FROM `eg_organization_members` WHERE user_id = ?').bind(userId).all()).results ?? []) as { organization_id: string; role: string }[]
    if (members.length === 0) return { userId, memberships: [] }
    const teams = ((await d1.prepare('SELECT t.id AS team_id, t.organization_id AS organization_id FROM `eg_organization_team_members` m JOIN `eg_organization_teams` t ON t.id = m.team_id WHERE m.user_id = ?').bind(userId).all()).results ?? []) as { team_id: string; organization_id: string }[]
    return {
      userId,
      memberships: members.map((m) => ({ organizationId: m.organization_id, role: m.role, teamIds: teams.filter((t) => t.organization_id === m.organization_id).map((t) => t.team_id) })),
    }
  } catch {
    return NO_ORG_ACCESS
  }
}

export const orgIdsOf = (access: OrgAccess): string[] => access.memberships.map((m) => m.organizationId)

export const isOrgMember = (access: OrgAccess, organizationId: string): boolean => access.memberships.some((m) => m.organizationId === organizationId)

export const isOrgManager = (access: OrgAccess, organizationId: string): boolean => access.memberships.some((m) => m.organizationId === organizationId && MANAGER_ROLES.includes(m.role))

/** True when the two people share at least one organisation. */
export const sharesOrg = (a: OrgAccess, b: OrgAccess): boolean => orgIdsOf(a).some((id) => isOrgMember(b, id))

/**
 * Whether the person may see a record. Unscoped records (no organisation, no team) return `null`:
 * not this helper's call, the caller applies its own rule.
 */
export function mayAccessRecord(access: OrgAccess, record: ScopedRecord): boolean | null {
  const orgId = record.organizationId || null
  const teamId = record.teamId || null
  if (!orgId && !teamId) return null
  if (access.userId !== null && record.ownerUserId === access.userId) return true
  const memberships = orgId ? access.memberships.filter((m) => m.organizationId === orgId) : access.memberships
  if (memberships.length === 0) return false
  if (orgId && memberships.some((m) => MANAGER_ROLES.includes(m.role))) return true
  if (teamId) return memberships.some((m) => m.teamIds.includes(teamId))
  return true
}

const placeholders = (n: number): string => Array.from({ length: n }, () => '?').join(', ')

/**
 * A SQL condition for lists: records the person may see among scoped ones, plus unscoped records when
 * `includeUnscoped` is true. Column names are trusted code constants, never user input. The condition is
 * always parenthesised and safe to AND with other filters.
 */
export function orgScopeClause(
  orgColumn: string,
  teamColumn: string,
  access: OrgAccess,
  opts: { ownerColumn?: string; includeUnscoped?: boolean } = {},
): { clause: string; binds: unknown[] } {
  for (const column of [orgColumn, teamColumn, opts.ownerColumn]) {
    if (column !== undefined && !/^[A-Za-z_][A-Za-z0-9_.]*$/.test(column)) throw new Error('Invalid column name')
  }
  const parts: string[] = []
  const binds: unknown[] = []
  if (opts.includeUnscoped) parts.push(`(${orgColumn} IS NULL AND ${teamColumn} IS NULL)`)
  if (opts.ownerColumn && access.userId !== null) {
    parts.push(`${opts.ownerColumn} = ?`)
    binds.push(access.userId)
  }
  const managed = access.memberships.filter((m) => MANAGER_ROLES.includes(m.role)).map((m) => m.organizationId)
  if (managed.length > 0) {
    parts.push(`${orgColumn} IN (${placeholders(managed.length)})`)
    binds.push(...managed)
  }
  const plain = access.memberships.filter((m) => !MANAGER_ROLES.includes(m.role))
  if (plain.length > 0) {
    parts.push(`(${orgColumn} IN (${placeholders(plain.length)}) AND ${teamColumn} IS NULL)`)
    binds.push(...plain.map((m) => m.organizationId))
  }
  const teamIds = access.memberships.flatMap((m) => m.teamIds)
  if (teamIds.length > 0) {
    parts.push(`${teamColumn} IN (${placeholders(teamIds.length)})`)
    binds.push(...teamIds)
  }
  return parts.length === 0 ? { clause: '(0)', binds: [] } : { clause: `(${parts.join(' OR ')})`, binds }
}
