import { beforeEach, describe, expect, it, vi } from 'vitest'

import { agentDay, checkCap, describeCaps, kindOfMethod, logPath, retentionCutoff, validateGrantInput, type AgentGrant } from '@/features/agentAccess/core'

const state = vi.hoisted(() => ({
  grant: null as null | Record<string, unknown>,
  counted: { reads: 0, writes: 0 },
  logged: [] as Array<Record<string, unknown>>,
  throwOnGrant: false,
}))

vi.mock('@/features/agentAccess/store', () => ({
  grantForKey: async () => {
    if (state.throwOnGrant) throw new Error('no such table')
    return state.grant
  },
  countedToday: async () => state.counted,
  logAction: async (_d1: unknown, row: Record<string, unknown>): Promise<void> => {
    state.logged.push(row)
  },
}))

import { gateAgentRequest } from '@/features/agentAccess/gate'

const grant = (over: Partial<AgentGrant> = {}): AgentGrant => ({
  id: 1,
  keyId: 7,
  label: 'Claude desktop',
  tool: '',
  dailyWriteCap: 2,
  dailyReadCap: 3,
  createdBy: 1,
  createdAt: '2027-01-01T00:00:00.000Z',
  revokedAt: null,
  ...over,
})

describe('agent core rules', () => {
  it('classifies methods and never lets delete count as a kind it allows', () => {
    expect(kindOfMethod('get')).toBe('read')
    expect(kindOfMethod('PATCH')).toBe('write')
    expect(kindOfMethod('DELETE')).toBe('other')
  })
  it('caps writes and reads separately; 0 means no cap', () => {
    const g = grant()
    expect(checkCap(g, 'write', { reads: 99, writes: 1 }).ok).toBe(true)
    expect(checkCap(g, 'write', { reads: 0, writes: 2 }).ok).toBe(false)
    expect(checkCap(g, 'read', { reads: 3, writes: 0 }).ok).toBe(false)
    expect(checkCap(grant({ dailyWriteCap: 0, dailyReadCap: 0 }), 'write', { reads: 0, writes: 9999 }).ok).toBe(true)
  })
  it('validates input with defaults and limits', () => {
    expect(validateGrantInput({ label: '  ' }).ok).toBe(false)
    expect(validateGrantInput({ label: 'x'.repeat(200) }).ok).toBe(false)
    const ok = validateGrantInput({ label: 'Bot' })
    expect(ok.ok && ok.value.dailyWriteCap).toBe(200)
    const custom = validateGrantInput({ label: 'Bot', dailyWriteCap: '5', dailyReadCap: 0 })
    expect(custom.ok && [custom.value.dailyWriteCap, custom.value.dailyReadCap]).toEqual([5, 0])
    const bad = validateGrantInput({ label: 'Bot', dailyWriteCap: -3 })
    expect(bad.ok && bad.value.dailyWriteCap).toBe(200)
  })
  it('describes caps, days, paths and retention', () => {
    expect(describeCaps({ dailyWriteCap: 0, dailyReadCap: 10 })).toBe('unlimited writes and 10 reads a day')
    expect(agentDay(Date.UTC(2027, 0, 5, 23, 59))).toBe('2027-01-05')
    expect(logPath(['pages', '12'])).toBe('pages/12')
    expect(logPath(['a'.repeat(500)]).length).toBe(200)
    expect(retentionCutoff(new Date('2027-04-01T00:00:00Z'), 0)).toBeNull()
    expect(retentionCutoff(new Date('2027-04-01T00:00:00Z'), 90)).toBe('2027-01-01T00:00:00.000Z')
  })
})

describe('agent gate', () => {
  const call = (over: Partial<Parameters<typeof gateAgentRequest>[0]> = {}) =>
    gateAgentRequest({ d1: {} as never, featureOn: true, keyId: 7, method: 'POST', slug: ['pages'], now: 1_800_000_000_000, ...over })

  beforeEach(() => {
    state.grant = grant() as never
    state.counted = { reads: 0, writes: 0 }
    state.logged = []
    state.throwOnGrant = false
  })

  it('leaves a key with no grant alone, and a missing table too', async () => {
    state.grant = null
    expect(await call()).toBeNull()
    state.throwOnGrant = true
    expect(await call()).toBeNull()
    expect(state.logged).toHaveLength(0)
  })
  it('allows and logs a request under the cap', async () => {
    expect(await call()).toBeNull()
    expect(state.logged[0]).toMatchObject({ grantId: 1, keyId: 7, kind: 'write', method: 'POST', path: 'pages', outcome: 'allowed' })
  })
  it('refuses with 429 over the cap and logs it as capped', async () => {
    state.counted = { reads: 0, writes: 2 }
    const res = await call()
    expect(res?.status).toBe(429)
    expect(state.logged[0]).toMatchObject({ outcome: 'capped' })
    expect((await call({ method: 'GET' }))?.status).toBeUndefined()
  })
  it('fails closed when revoked or when the feature is off', async () => {
    state.grant = grant({ revokedAt: '2027-01-02T00:00:00.000Z' }) as never
    expect((await call())?.status).toBe(403)
    state.grant = grant() as never
    expect((await call({ featureOn: false }))?.status).toBe(403)
    expect(state.logged).toHaveLength(0)
  })
})
