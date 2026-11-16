// @vitest-environment node
// Task 25c and 25d: the device authorisation rules and the MCP endpoint, with a fake engine.
import { describe, expect, it } from 'vitest'

import { GRANT_TYPE, cleanClientName, cleanScope, deviceCodeShape, hashDeviceCode, newDeviceCode, newUserCode, normaliseUserCode, pollDecision, type DeviceRow } from '@/features/agentAccess/device'
import { handleMcp, type McpDeps } from '@/features/agentAccess/mcp'

const row = (over: Partial<DeviceRow> = {}): DeviceRow => ({ id: 1, userCode: 'BCDF-GHJK', clientName: 'Tool', scope: 'read', status: 'pending', tokenEnc: null, expiresAt: 1_000_000, lastPollAt: 0, interval: 5, ...over })

describe('device codes', () => {
  it('makes readable user codes and accepts them loosely', () => {
    const code = newUserCode()
    expect(code).toMatch(/^[BCDFGHJKLMNPQRSTVWXZ]{4}-[BCDFGHJKLMNPQRSTVWXZ]{4}$/)
    expect(normaliseUserCode('bcdf ghjk')).toBe('BCDF-GHJK')
    expect(normaliseUserCode('BCDFGHJK')).toBe('BCDF-GHJK')
    expect(normaliseUserCode('AEIO-UUUU')).toBeNull()
    expect(normaliseUserCode('BCDF')).toBeNull()
    expect(normaliseUserCode(5)).toBeNull()
  })
  it('makes unguessable device codes that are only stored hashed', async () => {
    const a = newDeviceCode()
    expect(deviceCodeShape(a)).toBe(true)
    expect(deviceCodeShape('dc_short')).toBe(false)
    expect(newDeviceCode()).not.toBe(a)
    expect(await hashDeviceCode(a)).toMatch(/^[0-9a-f]{64}$/)
    expect(GRANT_TYPE).toBe('urn:ietf:params:oauth:grant-type:device_code')
  })
  it('cleans what the tool says about itself', () => {
    expect(cleanClientName('  <b>Claude</b>\n')).toBe('bClaude/b')
    expect(cleanClientName(undefined)).toBe('An AI tool')
    expect(cleanScope('write')).toBe('write')
    expect(cleanScope('admin')).toBe('read')
  })
  it('answers polls the way RFC 8628 says', () => {
    const t = 100_000
    expect(pollDecision(row(), t)).toEqual({ kind: 'error', error: 'authorization_pending' })
    expect(pollDecision(row({ lastPollAt: t - 1000 }), t)).toEqual({ kind: 'error', error: 'slow_down', interval: 10 })
    expect(pollDecision(row({ expiresAt: t - 1 }), t)).toEqual({ kind: 'error', error: 'expired_token' })
    expect(pollDecision(row({ status: 'denied' }), t)).toEqual({ kind: 'error', error: 'access_denied' })
    expect(pollDecision(row({ status: 'used' }), t)).toEqual({ kind: 'error', error: 'invalid_grant' })
    expect(pollDecision(row({ status: 'approved', tokenEnc: 'x' }), t)).toEqual({ kind: 'token' })
    expect(pollDecision(row({ status: 'approved', tokenEnc: null }), t)).toEqual({ kind: 'error', error: 'authorization_pending' })
  })
})

function mcp(scopes: string[], gateMessage: string | null = null) {
  const calls: string[] = []
  const gates: string[] = []
  const deps: McpDeps = {
    scopes,
    collections: [
      { slug: 'pages', label: 'Pages' },
      { slug: 'orders', label: 'Orders' },
    ],
    gate: async (m, slug) => {
      gates.push(`${m} ${slug.join('/')}`)
      return gateMessage
    },
    engine: {
      find: async (a) => (calls.push(`find ${a.collection} ${a.limit} ${a.page}`), { docs: [{ id: 1 }] }),
      findByID: async (a) => (calls.push(`get ${a.collection} ${a.id}`), { id: a.id }),
      create: async (a) => (calls.push(`create ${a.collection}`), { id: 9, ...a.data }),
      update: async (a) => (calls.push(`update ${a.collection} ${a.id}`), { id: a.id, ...a.data }),
    },
  }
  return { deps, calls, gates }
}
const rpc = (method: string, params?: Record<string, unknown>, id: number | undefined = 1) => ({ jsonrpc: '2.0' as const, id, method, params })
const tool = async (deps: McpDeps, name: string, args: Record<string, unknown>) => {
  const r = await handleMcp(deps, rpc('tools/call', { name, arguments: args }))
  return (r?.result ?? {}) as { content: Array<{ text: string }>; isError?: boolean }
}

describe('MCP endpoint', () => {
  it('answers initialize, ping and tools/list, and has no delete tool', async () => {
    const { deps } = mcp(['*:read'])
    expect((await handleMcp(deps, rpc('initialize')))?.result).toMatchObject({ serverInfo: { name: 'engage' } })
    expect((await handleMcp(deps, rpc('ping')))?.result).toEqual({})
    const tools = ((await handleMcp(deps, rpc('tools/list')))?.result as { tools: Array<{ name: string }> }).tools.map((t) => t.name)
    expect(tools).toEqual(['list_collections', 'find', 'get', 'create', 'update'])
  })
  it('treats notifications as no reply and rejects bad requests and methods', async () => {
    const { deps } = mcp(['*:read'])
    expect(await handleMcp(deps, { jsonrpc: '2.0', method: 'notifications/initialized' })).toBeNull()
    expect((await handleMcp(deps, { jsonrpc: '1.0' } as never))?.error?.code).toBe(-32600)
    expect((await handleMcp(deps, rpc('nope')))?.error?.code).toBe(-32601)
    expect((await handleMcp(deps, rpc('tools/call', { name: 'delete' })))?.error?.code).toBe(-32602)
  })
  it('lists only readable collections and marks the writable ones', async () => {
    const { deps } = mcp(['pages:read', 'pages:write'])
    expect(JSON.parse((await tool(deps, 'list_collections', {})).content[0].text)).toEqual([{ slug: 'pages', label: 'Pages', canWrite: true }])
  })
  it('reads within scope, clamps find, and counts each call', async () => {
    const { deps, calls, gates } = mcp(['pages:read'])
    expect((await tool(deps, 'find', { collection: 'pages', limit: 9999, page: 0 })).isError).toBeUndefined()
    expect(calls).toEqual(['find pages 50 1'])
    await tool(deps, 'get', { collection: 'pages', id: 4 })
    expect(gates).toEqual(['GET pages', 'GET pages/4'])
  })
  it('refuses outside the scopes, unknown collections and forbidden fields without calling the engine', async () => {
    const { deps, calls, gates } = mcp(['pages:read'])
    expect((await tool(deps, 'find', { collection: 'orders' })).isError).toBe(true)
    expect((await tool(deps, 'create', { collection: 'pages', data: { title: 'x' } })).isError).toBe(true)
    expect((await tool(deps, 'find', { collection: 'users' })).content[0].text).toContain('Unknown collection')
    expect((await tool(deps, 'find', { collection: '../etc' })).isError).toBe(true)
    const w = mcp(['pages:read', 'pages:write'])
    expect((await tool(w.deps, 'update', { collection: 'pages', id: 1, data: { password: 'x' } })).content[0].text).toContain('cannot write the field')
    expect((await tool(w.deps, 'update', { collection: 'pages', id: 1, data: 'str' })).isError).toBe(true)
    expect(calls).toEqual([])
    expect(w.calls).toEqual([])
    expect(gates).toEqual([])
  })
  it('writes within scope and stops when the daily cap says so', async () => {
    const { deps, calls } = mcp(['pages:read', 'pages:write'])
    expect((await tool(deps, 'create', { collection: 'pages', data: { title: 'Hi' } })).isError).toBeUndefined()
    expect((await tool(deps, 'update', { collection: 'pages', id: 3, data: { title: 'Yo' } })).isError).toBeUndefined()
    expect(calls).toEqual(['create pages', 'update pages 3'])
    const capped = mcp(['pages:read', 'pages:write'], 'This agent has used its 5 writes for today.')
    const r = await tool(capped.deps, 'create', { collection: 'pages', data: { title: 'x' } })
    expect(r.isError).toBe(true)
    expect(r.content[0].text).toContain('5 writes')
    expect(capped.calls).toEqual([])
  })
})
