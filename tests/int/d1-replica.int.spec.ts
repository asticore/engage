import { describe, expect, it } from 'vitest'

import { envWithReplicaReads, openReplicaEnv, readBookmark, replicaConstraint, usesReplica, withBookmarkCookie } from '@/features/speed/d1Replica'

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
    ['signed-in with bookmark', req('https://x.test/admin/pages', 'GET', 'engage-token=abc; eg_d1_bm=00000123-0000abcd-ffff0000'), '00000123-0000abcd-ffff0000'],
    ['signed-in with a bad bookmark', req('https://x.test/admin/pages', 'GET', 'engage-token=abc; eg_d1_bm=bad value!'), 'first-primary'],
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

describe('bookmark cookie', () => {
  const r = (method: string, url: string, cookie: string) => ({ method, url, headers: { get: (n: string) => (n.toLowerCase() === 'cookie' ? cookie : null) } })
  const ok = () => new Response('x', { status: 200 })
  it('reads only well-formed bookmarks', () => {
    expect(readBookmark('a=1; eg_d1_bm=00000123-0000abcd-ffff0000')).toBe('00000123-0000abcd-ffff0000')
    expect(readBookmark('eg_d1_bm=no')).toBeNull()
    expect(readBookmark(null)).toBeNull()
  })
  it('sets the cookie from the session bookmark for signed-in reads only', () => {
    const handle = { bookmark: () => '00000123-0000abcd-ffff0000' }
    const set = withBookmarkCookie(r('GET', 'https://x.test/admin', 'engage-token=a'), ok(), handle)
    expect(set.headers.get('set-cookie')).toContain('eg_d1_bm=00000123-0000abcd-ffff0000')
    expect(set.headers.get('set-cookie')).toContain('HttpOnly')
    const anon = withBookmarkCookie(r('GET', 'https://x.test/blog', ''), ok(), handle)
    expect(anon.headers.get('set-cookie')).toBeNull()
    const none = withBookmarkCookie(r('GET', 'https://x.test/admin', 'engage-token=a'), ok(), { bookmark: () => null })
    expect(none.headers.get('set-cookie')).toBeNull()
  })
  it('clears the cookie after a write or api call, not after an asset read', () => {
    const cookie = 'engage-token=a; eg_d1_bm=00000123-0000abcd-ffff0000'
    expect(withBookmarkCookie(r('POST', 'https://x.test/admin', cookie), ok(), null).headers.get('set-cookie')).toContain('Max-Age=0')
    expect(withBookmarkCookie(r('GET', 'https://x.test/api/x', cookie), ok(), null).headers.get('set-cookie')).toContain('Max-Age=0')
    expect(withBookmarkCookie(r('GET', 'https://x.test/_next/static/a.js', cookie), ok(), null).headers.get('set-cookie')).toBeNull()
  })
  it('drops the bookmark when a read made from it ends in a server error', () => {
    const cookie = 'engage-token=a; eg_d1_bm=00000123-0000abcd-ffff0000'
    const failed = withBookmarkCookie(r('GET', 'https://x.test/admin', cookie), new Response('x', { status: 500 }), { bookmark: () => '00000123-0000abcd-ffff0001' })
    expect(failed.headers.get('set-cookie')).toContain('Max-Age=0')
  })
  it('exposes the session bookmark through openReplicaEnv', () => {
    const session = { prepare: () => 1, getBookmark: () => '00000123-0000abcd-ffff0000' }
    const handle = openReplicaEnv({ D1: { withSession: () => session } }, 'first-primary')
    expect(handle.bookmark()).toBe('00000123-0000abcd-ffff0000')
    expect(openReplicaEnv({ D1: {} }).bookmark()).toBeNull()
  })
})
