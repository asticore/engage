// @vitest-environment node
import { DatabaseSync } from 'node:sqlite'
import { describe, expect, it } from 'vitest'

import { isOrgManager, isOrgMember, loadOrgAccess, mayAccessRecord, NO_ORG_ACCESS, orgIdsOf, orgScopeClause, sharesOrg, type OrgAccess } from '@/features/organizations/access'
import type { D1Like } from '@/features/organizations/store'

const access = (userId: number, memberships: OrgAccess['memberships']): OrgAccess => ({ userId, memberships })

describe('mayAccessRecord', () => {
  const member = access(1, [{ organizationId: 'o1', role: 'member', teamIds: ['t1'] }])
  const admin = access(2, [{ organizationId: 'o1', role: 'admin', teamIds: [] }])
  const outsider = access(3, [{ organizationId: 'o2', role: 'owner', teamIds: [] }])

  it('says nothing about unscoped records', () => {
    expect(mayAccessRecord(member, {})).toBeNull()
    expect(mayAccessRecord(NO_ORG_ACCESS, { organizationId: null, teamId: null })).toBeNull()
  })
  it('lets any member see an organisation record with no team', () => {
    expect(mayAccessRecord(member, { organizationId: 'o1' })).toBe(true)
    expect(mayAccessRecord(outsider, { organizationId: 'o1' })).toBe(false)
    expect(mayAccessRecord(NO_ORG_ACCESS, { organizationId: 'o1' })).toBe(false)
  })
  it('limits a team record to the team, the owner, and company managers', () => {
    expect(mayAccessRecord(member, { organizationId: 'o1', teamId: 't1' })).toBe(true)
    expect(mayAccessRecord(member, { organizationId: 'o1', teamId: 't2' })).toBe(false)
    expect(mayAccessRecord(admin, { organizationId: 'o1', teamId: 't2' })).toBe(true)
    expect(mayAccessRecord(member, { organizationId: 'o1', teamId: 't2', ownerUserId: 1 })).toBe(true)
  })
  it('helpers', () => {
    expect(orgIdsOf(member)).toEqual(['o1'])
    expect(isOrgMember(member, 'o1')).toBe(true)
    expect(isOrgManager(member, 'o1')).toBe(false)
    expect(isOrgManager(admin, 'o1')).toBe(true)
    expect(sharesOrg(member, admin)).toBe(true)
    expect(sharesOrg(member, outsider)).toBe(false)
  })
})

describe('orgScopeClause against a real table', () => {
  const db = new DatabaseSync(':memory:')
  db.exec('CREATE TABLE items (id INTEGER, org TEXT, team TEXT, owner INTEGER)')
  const rows: [number, string | null, string | null, number | null][] = [
    [1, null, null, null],
    [2, 'o1', null, null],
    [3, 'o1', 't1', null],
    [4, 'o1', 't2', null],
    [5, 'o2', null, null],
    [6, 'o2', 't9', 7],
  ]
  for (const r of rows) db.prepare('INSERT INTO items VALUES (?, ?, ?, ?)').run(...r)
  const ids = (a: OrgAccess, opts?: Parameters<typeof orgScopeClause>[3]): number[] => {
    const { clause, binds } = orgScopeClause('org', 'team', a, opts)
    return (db.prepare(`SELECT id FROM items WHERE ${clause} ORDER BY id`).all(...(binds as never[])) as { id: number }[]).map((r) => r.id)
  }

  it('member sees organisation records and their own teams', () => {
    expect(ids(access(1, [{ organizationId: 'o1', role: 'member', teamIds: ['t1'] }]))).toEqual([2, 3])
  })
  it('manager sees every record of the organisation', () => {
    expect(ids(access(2, [{ organizationId: 'o1', role: 'owner', teamIds: [] }]))).toEqual([2, 3, 4])
  })
  it('can include unscoped records and the owner column', () => {
    expect(ids(access(7, [{ organizationId: 'o1', role: 'member', teamIds: [] }]), { includeUnscoped: true, ownerColumn: 'owner' })).toEqual([1, 2, 6])
  })
  it('no access sees nothing scoped', () => {
    expect(ids(NO_ORG_ACCESS)).toEqual([])
  })
  it('rejects odd column names', () => {
    expect(() => orgScopeClause('org; DROP TABLE x', 'team', NO_ORG_ACCESS)).toThrow()
  })
})

describe('loadOrgAccess', () => {
  const db = new DatabaseSync(':memory:')
  db.exec(`CREATE TABLE eg_organization_members (organization_id TEXT, user_id INTEGER, role TEXT);
    CREATE TABLE eg_organization_teams (id TEXT, organization_id TEXT);
    CREATE TABLE eg_organization_team_members (team_id TEXT, user_id INTEGER);
    INSERT INTO eg_organization_members VALUES ('o1', 1, 'member'), ('o2', 1, 'admin');
    INSERT INTO eg_organization_teams VALUES ('t1', 'o1'), ('t2', 'o2');
    INSERT INTO eg_organization_team_members VALUES ('t1', 1);`)
  const d1: D1Like = {
    prepare: (query) => ({
      bind: (...values) => ({
        run: async () => ({}),
        all: async () => ({ results: db.prepare(query).all(...(values as never[])) }),
        first: async () => db.prepare(query).get(...(values as never[])),
      }),
    }),
  }

  it('reads memberships with their teams', async () => {
    const result = await loadOrgAccess(d1, 1)
    expect(result.memberships).toEqual([
      { organizationId: 'o1', role: 'member', teamIds: ['t1'] },
      { organizationId: 'o2', role: 'admin', teamIds: [] },
    ])
  })
  it('gives no access for an unknown person or a failed lookup', async () => {
    expect((await loadOrgAccess(d1, null)).memberships).toEqual([])
    expect((await loadOrgAccess(d1, 99)).memberships).toEqual([])
    const broken: D1Like = { prepare: () => { throw new Error('down') } }
    expect(await loadOrgAccess(broken, 1)).toEqual(NO_ORG_ACCESS)
  })
})
