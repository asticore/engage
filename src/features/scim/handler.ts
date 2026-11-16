import type { OrgStore } from '@/features/organizations/types'

import {
  SERVICE_PROVIDER_CONFIG,
  groupResource,
  listResponse,
  paging,
  parseEqFilter,
  readPatch,
  readUserBody,
  scimError,
  userResource,
  type ScimGroup,
  type ScimResult,
  type ScimUser,
} from './core'

/**
 * The SCIM 2.0 endpoints for one organisation, as a function of (method, path, query, body). The token check
 * happens before this, in the route; `orgId` is the organisation the token belongs to, and nothing here can
 * reach another organisation. Rules: a SCIM user is a customer account with a membership in the organisation;
 * staff accounts are never created, changed or removed here; owners are never removed; deprovisioning removes
 * the membership and marks the person inactive, it never deletes the account.
 */

export type ScimLink = { userId: number; externalId: string | null; active: boolean }

export type ScimDeps = {
  org: Pick<OrgStore, 'getMember' | 'listMembers' | 'insertMember' | 'removeMember' | 'insertTeam' | 'getTeam' | 'listTeams' | 'deleteTeam' | 'addTeamMember' | 'removeTeamMember' | 'listTeamMembers'>
  links: {
    get(orgId: string, userId: number): Promise<ScimLink | null>
    upsert(orgId: string, userId: number, externalId: string | null, active: boolean, at: string): Promise<void>
  }
  findUserByID(id: number): Promise<{ id: number; email: string; roles: string[]; firstName?: string; lastName?: string } | null>
  findUserByEmail(email: string): Promise<{ id: number; email: string; roles: string[]; firstName?: string; lastName?: string } | null>
  createCustomer(email: string, givenName: string, familyName: string): Promise<number>
  /** Ends the person's sessions when they are deprovisioned. */
  endSessions(userId: number): Promise<void>
  defaultRole: string
  now(): string
  newId(): string
}

const isStaff = (roles: string[]): boolean => roles.some((r) => r === 'admin' || r === 'editor' || r === 'viewer')

async function toScimUser(deps: ScimDeps, orgId: string, userId: number): Promise<ScimUser | null> {
  const user = await deps.findUserByID(userId)
  if (!user) return null
  const [member, link] = await Promise.all([deps.org.getMember(orgId, userId), deps.links.get(orgId, userId)])
  if (!member && !link) return null
  return { id: user.id, email: user.email, externalId: link?.externalId ?? null, active: Boolean(member) && (link?.active ?? true), givenName: user.firstName ?? '', familyName: user.lastName ?? '' }
}

async function deprovision(deps: ScimDeps, orgId: string, userId: number): Promise<ScimResult | null> {
  const member = await deps.org.getMember(orgId, userId)
  if (member && member.role === 'owner') return scimError(409, 'An owner cannot be removed by the provisioning feed. Transfer ownership first.', 'mutability')
  if (member) await deps.org.removeMember(orgId, userId)
  await deps.endSessions(userId).catch((): void => undefined)
  return null
}

async function provision(deps: ScimDeps, orgId: string, userId: number): Promise<void> {
  await deps.org.insertMember({ id: deps.newId(), organizationId: orgId, userId, role: deps.defaultRole, createdAt: deps.now() })
}

const userId = (segment: string): number | null => {
  const n = Number(segment)
  return Number.isInteger(n) && n > 0 ? n : null
}

async function usersRoute(deps: ScimDeps, orgId: string, base: string, method: string, rest: string[], params: URLSearchParams, body: unknown): Promise<ScimResult> {
  if (rest.length === 0 && method === 'GET') {
    const filter = parseEqFilter(params.get('filter'))
    if (filter === 'unsupported') return scimError(400, 'Only filters of the form attribute eq "value" are supported.', 'invalidFilter')
    const members = await deps.org.listMembers(orgId)
    let users = (await Promise.all(members.map((m) => toScimUser(deps, orgId, m.userId)))).filter((u): u is ScimUser => Boolean(u))
    if (filter) {
      users = users.filter((u) => {
        if (filter.attr === 'username') return u.email === filter.value.toLowerCase()
        if (filter.attr === 'externalid') return u.externalId === filter.value
        if (filter.attr === 'id') return String(u.id) === filter.value
        return false
      })
    }
    const { start, count } = paging(params)
    return listResponse(users.slice(start - 1, start - 1 + count).map((u) => userResource(u, base)), users.length, start)
  }

  if (rest.length === 0 && method === 'POST') {
    const data = readUserBody(body)
    if (!data.email) return scimError(400, 'userName must be an email address.', 'invalidValue')
    const existing = await deps.findUserByEmail(data.email)
    if (existing && isStaff(existing.roles)) return scimError(409, 'That address belongs to a staff account, which cannot be managed here.', 'uniqueness')
    const alreadyMember = existing ? await deps.org.getMember(orgId, existing.id) : null
    if (alreadyMember) return scimError(409, 'That user already exists.', 'uniqueness')
    const id = existing ? existing.id : await deps.createCustomer(data.email, data.givenName, data.familyName)
    const active = data.active ?? true
    if (active) await provision(deps, orgId, id)
    await deps.links.upsert(orgId, id, data.externalId, active, deps.now())
    const created = await toScimUser(deps, orgId, id)
    return { status: 201, body: created ? userResource(created, base) : undefined }
  }

  const id = rest.length === 1 ? userId(rest[0]) : null
  if (id === null) return scimError(404, 'Resource not found.')
  const current = await toScimUser(deps, orgId, id)
  if (!current) return scimError(404, 'User not found.')
  const acct = await deps.findUserByID(id)
  if (acct && isStaff(acct.roles)) return scimError(403, 'Staff accounts cannot be managed here.')

  if (method === 'GET') return { status: 200, body: userResource(current, base) }

  if (method === 'DELETE') {
    const refused = await deprovision(deps, orgId, id)
    if (refused) return refused
    await deps.links.upsert(orgId, id, current.externalId, false, deps.now())
    return { status: 204 }
  }

  let active: boolean | null = null
  let externalId = current.externalId
  if (method === 'PUT') {
    const data = readUserBody(body)
    if (data.email && data.email !== current.email) return scimError(400, 'userName cannot be changed.', 'mutability')
    active = data.active
    externalId = data.externalId
  } else if (method === 'PATCH') {
    const patch = readPatch(body)
    if (!patch) return scimError(400, 'Not a valid PatchOp request.', 'invalidSyntax')
    if (patch.active !== undefined) active = patch.active
    if (patch.externalId !== undefined) externalId = patch.externalId
  } else return scimError(405, 'Method not allowed.')

  if (active === false && current.active) {
    const refused = await deprovision(deps, orgId, id)
    if (refused) return refused
  } else if (active === true && !current.active) {
    await provision(deps, orgId, id)
  }
  const nextActive = active ?? current.active
  await deps.links.upsert(orgId, id, externalId, nextActive, deps.now())
  const updated = await toScimUser(deps, orgId, id)
  return { status: 200, body: updated ? userResource(updated, base) : undefined }
}

async function groupOf(deps: ScimDeps, orgId: string, teamId: string): Promise<ScimGroup | null> {
  const team = await deps.org.getTeam(teamId)
  if (!team || team.organizationId !== orgId) return null
  return { id: team.id, displayName: team.name, memberIds: await deps.org.listTeamMembers(team.id) }
}

async function setMembers(deps: ScimDeps, orgId: string, teamId: string, add: number[], remove: number[]): Promise<ScimResult | null> {
  for (const uid of add) {
    // Only people who are members of this organisation can be put in its teams.
    if (!(await deps.org.getMember(orgId, uid))) return scimError(400, `User ${uid} is not a member of this organisation.`, 'invalidValue')
    await deps.org.addTeamMember(teamId, uid, deps.now())
  }
  for (const uid of remove) await deps.org.removeTeamMember(teamId, uid)
  return null
}

async function groupsRoute(deps: ScimDeps, orgId: string, base: string, method: string, rest: string[], params: URLSearchParams, body: unknown): Promise<ScimResult> {
  if (rest.length === 0 && method === 'GET') {
    const filter = parseEqFilter(params.get('filter'))
    if (filter === 'unsupported') return scimError(400, 'Only filters of the form attribute eq "value" are supported.', 'invalidFilter')
    const teams = await deps.org.listTeams(orgId)
    let groups = (await Promise.all(teams.map((t) => groupOf(deps, orgId, t.id)))).filter((g): g is ScimGroup => Boolean(g))
    if (filter) groups = groups.filter((g) => (filter.attr === 'displayname' ? g.displayName === filter.value : filter.attr === 'id' ? g.id === filter.value : false))
    const { start, count } = paging(params)
    return listResponse(groups.slice(start - 1, start - 1 + count).map((g) => groupResource(g, base)), groups.length, start)
  }
  if (rest.length === 0 && method === 'POST') {
    const b = (body && typeof body === 'object' ? body : {}) as { displayName?: unknown; members?: unknown }
    const name = typeof b.displayName === 'string' ? b.displayName.trim().slice(0, 80) : ''
    if (!name) return scimError(400, 'displayName is required.', 'invalidValue')
    const id = deps.newId()
    await deps.org.insertTeam({ id, organizationId: orgId, name, createdAt: deps.now() })
    const ids = (Array.isArray(b.members) ? (b.members as Array<{ value?: unknown }>) : []).map((m) => Number(m?.value)).filter((n) => Number.isInteger(n) && n > 0)
    const refused = await setMembers(deps, orgId, id, ids, [])
    if (refused) {
      await deps.org.deleteTeam(id)
      return refused
    }
    const g = await groupOf(deps, orgId, id)
    return { status: 201, body: g ? groupResource(g, base) : undefined }
  }
  const teamId = rest.length === 1 ? rest[0] : ''
  if (!teamId) return scimError(404, 'Resource not found.')
  const group = await groupOf(deps, orgId, teamId)
  if (!group) return scimError(404, 'Group not found.')
  if (method === 'GET') return { status: 200, body: groupResource(group, base) }
  if (method === 'DELETE') {
    await deps.org.deleteTeam(teamId)
    return { status: 204 }
  }
  if (method === 'PATCH') {
    const patch = readPatch(body)
    if (!patch) return scimError(400, 'Not a valid PatchOp request.', 'invalidSyntax')
    let add = patch.addMembers
    let remove = patch.removeMembers
    if (patch.replaceMembers) {
      remove = [...remove, ...group.memberIds.filter((m) => !patch.replaceMembers!.includes(m))]
      add = [...add, ...patch.replaceMembers.filter((m) => !group.memberIds.includes(m))]
    }
    const refused = await setMembers(deps, orgId, teamId, add, remove)
    if (refused) return refused
    const g = await groupOf(deps, orgId, teamId)
    return { status: 200, body: g ? groupResource(g, base) : undefined }
  }
  return scimError(405, 'Method not allowed.')
}

/** `path` is what follows `/scim/v2/`, split on slashes. */
export async function handleScim(deps: ScimDeps, args: { orgId: string; base: string; method: string; path: string[]; params: URLSearchParams; body: unknown }): Promise<ScimResult> {
  const { orgId, base, method, path, params, body } = args
  const [resource, ...rest] = path
  if (resource === 'ServiceProviderConfig' && method === 'GET') return { status: 200, body: SERVICE_PROVIDER_CONFIG }
  if (resource === 'ResourceTypes' && method === 'GET') {
    return listResponse(
      [
        { id: 'User', name: 'User', endpoint: '/Users', schema: 'urn:ietf:params:scim:schemas:core:2.0:User' },
        { id: 'Group', name: 'Group', endpoint: '/Groups', schema: 'urn:ietf:params:scim:schemas:core:2.0:Group' },
      ],
      2,
      1,
    )
  }
  if (resource === 'Users') return usersRoute(deps, orgId, base, method, rest, params, body)
  if (resource === 'Groups') return groupsRoute(deps, orgId, base, method, rest, params, body)
  return scimError(404, 'Resource not found.')
}
