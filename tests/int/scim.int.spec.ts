// @vitest-environment node
// Task 25b: SCIM 2.0 provisioning. In-memory stores only.
import { beforeEach, describe, expect, it } from 'vitest'

import { paging, parseEqFilter, readPatch, readUserBody, tokenShape } from '@/features/scim/core'
import { handleScim, type ScimDeps } from '@/features/scim/handler'
import { generateToken } from '@/features/scim/store'

type U = { id: number; email: string; roles: string[]; firstName?: string; lastName?: string }

function make() {
  const users: U[] = []
  const members: Array<{ orgId: string; userId: number; role: string }> = []
  const teams: Array<{ id: string; organizationId: string; name: string }> = []
  const teamMembers: Array<{ teamId: string; userId: number }> = []
  const links = new Map<string, { userId: number; externalId: string | null; active: boolean }>()
  const ended: number[] = []
  let n = 0
  const deps: ScimDeps = {
    org: {
      getMember: async (o, u) => (members.find((m) => m.orgId === o && m.userId === u) ? ({ id: 'm', organizationId: o, userId: u, role: members.find((m) => m.orgId === o && m.userId === u)!.role, createdAt: '' }) : null),
      listMembers: async (o) => members.filter((m) => m.orgId === o).map((m) => ({ id: 'm', organizationId: o, userId: m.userId, role: m.role, createdAt: '' })),
      insertMember: async (r) => {
        if (members.some((m) => m.orgId === r.organizationId && m.userId === r.userId)) return false
        members.push({ orgId: r.organizationId, userId: r.userId, role: r.role })
        return true
      },
      removeMember: async (o, u) => {
        const i = members.findIndex((m) => m.orgId === o && m.userId === u)
        if (i < 0) return false
        members.splice(i, 1)
        return true
      },
      insertTeam: async (t) => {
        teams.push({ id: t.id, organizationId: t.organizationId, name: t.name })
        return true
      },
      getTeam: async (id) => {
        const t = teams.find((x) => x.id === id)
        return t ? { ...t, createdAt: '' } : null
      },
      listTeams: async (o) => teams.filter((t) => t.organizationId === o).map((t) => ({ ...t, createdAt: '', memberCount: 0 })),
      deleteTeam: async (id) => void teams.splice(teams.findIndex((t) => t.id === id), 1),
      addTeamMember: async (teamId, userId) => void teamMembers.push({ teamId, userId }),
      removeTeamMember: async (teamId, userId) => void teamMembers.splice(teamMembers.findIndex((m) => m.teamId === teamId && m.userId === userId), 1),
      listTeamMembers: async (teamId) => teamMembers.filter((m) => m.teamId === teamId).map((m) => m.userId),
    },
    links: {
      get: async (o, u) => links.get(`${o}:${u}`) ?? null,
      upsert: async (o, u, externalId, active) => void links.set(`${o}:${u}`, { userId: u, externalId, active }),
    },
    findUserByID: async (id) => users.find((u) => u.id === id) ?? null,
    findUserByEmail: async (e) => users.find((u) => u.email === e) ?? null,
    createCustomer: async (email, given, family) => {
      const id = 100 + n++
      users.push({ id, email, roles: ['customer'], firstName: given, lastName: family })
      return id
    },
    endSessions: async (id) => void ended.push(id),
    defaultRole: 'member',
    now: () => '2027-01-01T00:00:00Z',
    newId: () => `id${n++}`,
  }
  return { deps, users, members, teams, teamMembers, ended }
}

const call = (deps: ScimDeps, method: string, path: string, body?: unknown, org = 'org1') => {
  const [p, q] = path.split('?')
  return handleScim(deps, { orgId: org, base: 'https://x/api/scim/v2', method, path: p.split('/').filter(Boolean), params: new URLSearchParams(q ?? ''), body })
}

describe('scim helpers', () => {
  it('parses filters, paging and token shape', () => {
    expect(parseEqFilter('userName eq "a@b.co"')).toEqual({ attr: 'username', value: 'a@b.co' })
    expect(parseEqFilter('userName co "a"')).toBe('unsupported')
    expect(parseEqFilter(null)).toBeNull()
    expect(paging(new URLSearchParams('startIndex=0&count=9999'))).toEqual({ start: 1, count: 100 })
    expect(tokenShape(generateToken())).toBe(true)
    expect(tokenShape('scim_short')).toBe(false)
  })
  it('reads user bodies and patch operations', () => {
    expect(readUserBody({ userName: 'A@B.co', active: 'false', name: { givenName: 'A' } })).toMatchObject({ email: 'a@b.co', active: false, givenName: 'A' })
    expect(readUserBody({ emails: [{ value: 'x@y.zz', primary: true }] }).email).toBe('x@y.zz')
    expect(readPatch({ Operations: [{ op: 'Replace', path: 'active', value: 'False' }] })).toMatchObject({ active: false })
    expect(readPatch({ Operations: [{ op: 'replace', value: { active: true } }] })).toMatchObject({ active: true })
    expect(readPatch({ Operations: [{ op: 'remove', path: 'members[value eq "12"]' }] })?.removeMembers).toEqual([12])
    expect(readPatch({ Operations: [{ op: 'bogus' }] })).toBeNull()
    expect(readPatch({})).toBeNull()
  })
})

describe('users', () => {
  let s: ReturnType<typeof make>
  beforeEach(() => {
    s = make()
  })

  it('creates a customer and membership, and rejects a duplicate', async () => {
    const res = await call(s.deps, 'POST', 'Users', { userName: 'ann@acme.com', externalId: 'e1', name: { givenName: 'Ann', familyName: 'Lee' } })
    expect(res.status).toBe(201)
    expect(s.users[0].roles).toEqual(['customer'])
    expect(s.members).toEqual([{ orgId: 'org1', userId: 100, role: 'member' }])
    expect((res.body as { userName: string; active: boolean }).userName).toBe('ann@acme.com')
    expect((await call(s.deps, 'POST', 'Users', { userName: 'ann@acme.com' })).status).toBe(409)
    expect((await call(s.deps, 'POST', 'Users', { userName: 'nope' })).status).toBe(400)
  })
  it('never touches a staff account', async () => {
    s.users.push({ id: 1, email: 'boss@acme.com', roles: ['admin'] })
    expect((await call(s.deps, 'POST', 'Users', { userName: 'boss@acme.com' })).status).toBe(409)
    s.members.push({ orgId: 'org1', userId: 1, role: 'member' })
    expect((await call(s.deps, 'DELETE', 'Users/1')).status).toBe(403)
    expect(s.members).toHaveLength(1)
  })
  it('lists and filters, and stays inside its organisation', async () => {
    await call(s.deps, 'POST', 'Users', { userName: 'ann@acme.com', externalId: 'e1' })
    await call(s.deps, 'POST', 'Users', { userName: 'bob@acme.com' })
    const all = (await call(s.deps, 'GET', 'Users')).body as { totalResults: number }
    expect(all.totalResults).toBe(2)
    const one = (await call(s.deps, 'GET', 'Users?filter=userName eq "bob@acme.com"')).body as { Resources: Array<{ userName: string }> }
    expect(one.Resources.map((r) => r.userName)).toEqual(['bob@acme.com'])
    const byExt = (await call(s.deps, 'GET', 'Users?filter=externalId eq "e1"')).body as { totalResults: number }
    expect(byExt.totalResults).toBe(1)
    expect((await call(s.deps, 'GET', 'Users', undefined, 'other')).body as { totalResults: number }).toMatchObject({ totalResults: 0 })
    expect((await call(s.deps, 'GET', 'Users/100', undefined, 'other')).status).toBe(404)
    expect((await call(s.deps, 'GET', 'Users?filter=name co "x"')).status).toBe(400)
  })
  it('deactivates by patch, ends sessions, and reactivates', async () => {
    await call(s.deps, 'POST', 'Users', { userName: 'ann@acme.com' })
    const off = await call(s.deps, 'PATCH', 'Users/100', { Operations: [{ op: 'Replace', path: 'active', value: false }] })
    expect(off.status).toBe(200)
    expect((off.body as { active: boolean }).active).toBe(false)
    expect(s.members).toHaveLength(0)
    expect(s.ended).toEqual([100])
    const get = await call(s.deps, 'GET', 'Users/100')
    expect((get.body as { active: boolean }).active).toBe(false)
    const on = await call(s.deps, 'PATCH', 'Users/100', { Operations: [{ op: 'replace', value: { active: true } }] })
    expect((on.body as { active: boolean }).active).toBe(true)
    expect(s.members).toHaveLength(1)
  })
  it('deletes by deactivating, never deleting the account, and refuses to remove an owner', async () => {
    await call(s.deps, 'POST', 'Users', { userName: 'ann@acme.com' })
    expect((await call(s.deps, 'DELETE', 'Users/100')).status).toBe(204)
    expect(s.users).toHaveLength(1)
    expect(s.members).toHaveLength(0)
    await call(s.deps, 'PATCH', 'Users/100', { Operations: [{ op: 'replace', path: 'active', value: true }] })
    s.members[0].role = 'owner'
    expect((await call(s.deps, 'DELETE', 'Users/100')).status).toBe(409)
    expect(s.members).toHaveLength(1)
  })
  it('replaces with PUT but will not change the userName', async () => {
    await call(s.deps, 'POST', 'Users', { userName: 'ann@acme.com' })
    expect((await call(s.deps, 'PUT', 'Users/100', { userName: 'other@acme.com' })).status).toBe(400)
    const ok = await call(s.deps, 'PUT', 'Users/100', { userName: 'ann@acme.com', externalId: 'new', active: true })
    expect((ok.body as { externalId: string }).externalId).toBe('new')
  })
})

describe('groups and discovery', () => {
  it('maps groups to teams and only accepts organisation members', async () => {
    const s = make()
    await call(s.deps, 'POST', 'Users', { userName: 'ann@acme.com' })
    const created = await call(s.deps, 'POST', 'Groups', { displayName: 'Sales', members: [{ value: '100' }] })
    expect(created.status).toBe(201)
    const id = (created.body as { id: string }).id
    expect(s.teamMembers).toEqual([{ teamId: id, userId: 100 }])
    expect((await call(s.deps, 'POST', 'Groups', { displayName: 'Bad', members: [{ value: '999' }] })).status).toBe(400)
    expect(s.teams).toHaveLength(1)
    await call(s.deps, 'PATCH', `Groups/${id}`, { Operations: [{ op: 'remove', path: 'members[value eq "100"]' }] })
    expect(s.teamMembers).toHaveLength(0)
    await call(s.deps, 'PATCH', `Groups/${id}`, { Operations: [{ op: 'add', path: 'members', value: [{ value: '100' }] }] })
    expect(s.teamMembers).toHaveLength(1)
    expect((await call(s.deps, 'GET', `Groups/${id}`, undefined, 'other')).status).toBe(404)
    expect((await call(s.deps, 'DELETE', `Groups/${id}`)).status).toBe(204)
  })
  it('answers the discovery endpoints and 404s the rest', async () => {
    const s = make()
    expect((await call(s.deps, 'GET', 'ServiceProviderConfig')).status).toBe(200)
    expect((await call(s.deps, 'GET', 'ResourceTypes')).status).toBe(200)
    expect((await call(s.deps, 'GET', 'Nothing')).status).toBe(404)
  })
})
