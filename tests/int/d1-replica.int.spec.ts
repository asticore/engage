import { describe, expect, it } from 'vitest'

import { envWithReplicaReads, replicaConstraint, usesReplica } from '@/features/speed/d1Replica'

const req = (url: string, method = 'GET', cookie = '') => ({
  method,
  url,
  headers: { get: (name: string) => (name.toLowerCase() === 'cookie' ? cookie : null) },
})

describe('usesReplica', () => {
  it.each([
    ['anonymous page', req('https://x.test/blog'), true],
    ['anonymous HEAD', req('https://x.test/', 'HEAD'), true],
    ['consent cookie only', req('https://x.test/', 'GET', 'engage_consent=1'), true],
    ['POST', req('https://x.test/', 'POST'), false],
    ['session cookie', req('https://x.test/', 'GET', 'a=1; engage-token=abc'), false],
    ['unlock cookie', req('https://x.test/p', 'GET', 'eg_unlock_p=1'), false],
    ['admin', req('https://x.test/admin/pages'), false],
    ['api', req('https://x.test/api/x'), false],
    ['next assets', req('https://x.test/_next/static/a.js'), false],
  ])('%s', (_n, r, expected) => {
    expect(usesReplica(r)).toBe(expected)
  })
})

describe('envWithReplicaReads', () => {
  it('swaps D1 for a session and keeps other bindings', () => {
    const session = { prepare: () => 1 }
    const env = { D1: { withSession: (c: string) => (c === 'first-unconstrained' ? session : null) }, R2: 'r2' }
    const out = envWithReplicaReads(env) as { D1: unknown; R2: string }
    expect(out.D1).toBe(session)
    expect(out.R2).toBe('r2')
  })
  it('returns the env unchanged without withSession', () => {
    const env = { D1: { prepare: () => 1 } }
    expect(envWithReplicaReads(env)).toBe(env)
    expect(envWithReplicaReads(undefined)).toBe(undefined)
  })
})

describe('replicaConstraint', () => {
  it.each([
    ['anonymous page', req('https://x.test/blog'), 'first-unconstrained'],
    ['signed-in admin read', req('https://x.test/admin/pages', 'GET', 'engage-token=abc'), 'first-primary'],
    ['signed-in page read', req('https://x.test/blog', 'GET', 'engage-token=abc'), 'first-primary'],
    ['signed-in api', req('https://x.test/api/x', 'GET', 'engage-token=abc'), null],
    ['signed-in write', req('https://x.test/admin/pages', 'POST', 'engage-token=abc'), null],
    ['anonymous admin', req('https://x.test/admin/login'), null],
  ])('%s', (_n, r, expected) => {
    expect(replicaConstraint(r)).toBe(expected)
  })
  it('passes the constraint to withSession', () => {
    const seen: string[] = []
    const env = { D1: { withSession: (c: string) => (seen.push(c), { prepare: () => 1 }) } }
    envWithReplicaReads(env, 'first-primary')
    expect(seen).toEqual(['first-primary'])
  })
})
