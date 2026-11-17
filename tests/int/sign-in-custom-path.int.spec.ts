// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

import {
  DEFAULT_CUSTOMER_SIGN_IN_PATH,
  DEFAULT_MEMBER_SIGN_IN_PATH,
  resolveSignInPaths,
  validateSignInPath,
} from '@/features/security/signInPath'
import { validateSignInPathField } from '@/features/security/signInPathValidate'

const state = vi.hoisted(() => ({
  adminPath: '/admin' as string,
  customer: '' as string,
  member: '' as string,
  seen: [] as string[],
  redirectTo: null as string | null,
}))

vi.mock('@/features/security', () => ({
  readSecuritySettingsFromD1: async () => ({ adminPath: state.adminPath, signInPaths: { customer: state.customer, member: state.member } }),
  securityMiddleware: async (request: NextRequest) => {
    state.seen.push(request.nextUrl.pathname)
    if (state.redirectTo) return NextResponse.redirect(new URL(state.redirectTo, request.url))
    return NextResponse.next()
  },
}))
vi.mock('@/features/multilingual/middleware', () => ({
  multilingualMiddleware: async (request: NextRequest, handle: (r: NextRequest) => Promise<NextResponse>) => handle(request),
}))

import { middleware } from '@/middleware'

const ctx = { adminRoot: '/admin' }
const get = (path: string, init?: RequestInit) => middleware(new NextRequest(`https://site.test${path}`, init as never))

describe('sign-in path validation', () => {
  it.each(['/welcome-in', 'welcome-in', '/abc', '/a-b-c', DEFAULT_CUSTOMER_SIGN_IN_PATH])('accepts %s', (v) => {
    expect(validateSignInPath(v, 'customer', ctx)).toBeNull()
  })
  it('rejects bad format, length and reserved words', () => {
    expect(validateSignInPath('/Has Caps', 'customer', ctx)).toBe('format')
    expect(validateSignInPath('/a/b', 'customer', ctx)).toBe('format')
    expect(validateSignInPath('/ab', 'customer', ctx)).toBe('length')
    expect(validateSignInPath('/account', 'customer', ctx)).toBe('reserved')
    expect(validateSignInPath('/admin', 'customer', { adminRoot: '/studio-7f3' })).toBe('reserved')
  })
  it('never equals the admin URL', () => {
    expect(validateSignInPath('/studio-7f3', 'customer', { adminRoot: '/studio-7f3' })).toBe('admin')
  })
  it('refuses the same path for both places', () => {
    expect(validateSignInPath('/welcome-in', 'member', { ...ctx, otherPath: '/welcome-in' })).toBe('clash')
  })
  it('field validator returns messages and accepts empty', async () => {
    const v = validateSignInPathField('customer', 'memberSignInPath')
    expect(await v('')).toBe(true)
    expect(await v('/ab')).toMatch(/between 3 and 40/)
    expect(await v('/studio-7f3', { siblingData: { adminPath: '/studio-7f3' } })).toMatch(/admin URL/)
    expect(await v('/same-one', { siblingData: { memberSignInPath: '/same-one' } })).toMatch(/cannot share/)
  })
  it('refuses an address a top-level page already uses', async () => {
    const v = validateSignInPathField('customer', 'memberSignInPath')
    const withPages = (slugs: string[]) => ({
      engine: {
        find: async (args: Record<string, unknown>) => ({
          docs: slugs.filter((s) => s === (args as { where: { and: { slug?: { equals: string } }[] } }).where.and[0].slug?.equals),
        }),
      },
    })
    expect(await v('/welcome-in', { req: withPages(['welcome-in']) })).toMatch(/page already uses/)
    expect(await v('/welcome-in', { req: withPages(['about']) })).toBe(true)
    expect(await v('/account/sign-in', { req: withPages(['account']) })).toBe(true)
    const broken = { engine: { find: async () => { throw new Error('db down') } } }
    expect(await v('/welcome-in', { req: broken })).toBe(true)
  })
})

describe('resolveSignInPaths', () => {
  it('uses defaults, then the setting, then the env override', () => {
    expect(resolveSignInPaths({}, {}, '/admin')).toEqual({ customer: DEFAULT_CUSTOMER_SIGN_IN_PATH, member: DEFAULT_MEMBER_SIGN_IN_PATH })
    expect(resolveSignInPaths({ customer: '/welcome-in' }, {}, '/admin').customer).toBe('/welcome-in')
    expect(resolveSignInPaths({ customer: '/welcome-in' }, { customer: '/rescue' }, '/admin').customer).toBe('/rescue')
  })
  it('skips invalid values so a place is never lost', () => {
    expect(resolveSignInPaths({ customer: '/admin' }, { customer: '!!' }, '/admin').customer).toBe(DEFAULT_CUSTOMER_SIGN_IN_PATH)
    expect(resolveSignInPaths({ customer: '/studio-7f3' }, {}, '/studio-7f3').customer).toBe(DEFAULT_CUSTOMER_SIGN_IN_PATH)
    expect(resolveSignInPaths({ customer: '/same-one', member: '/same-one' }, {}, '/admin')).toEqual({
      customer: '/same-one',
      member: DEFAULT_MEMBER_SIGN_IN_PATH,
    })
  })
})

describe('middleware with custom sign-in paths', () => {
  beforeEach(() => {
    state.adminPath = '/admin'
    state.customer = '/welcome-in'
    state.member = ''
    state.seen = []
    state.redirectTo = null
  })

  it('serves the custom path from the default route and marks it noindex', async () => {
    const res = await get('/welcome-in')
    expect(state.seen).toEqual([DEFAULT_CUSTOMER_SIGN_IN_PATH])
    expect(res.headers.get('x-middleware-rewrite')).toBe(`https://site.test${DEFAULT_CUSTOMER_SIGN_IN_PATH}`)
    expect(res.headers.get('x-robots-tag')).toContain('noindex')
  })

  it('keeps the rest of the path and query (the emailed link)', async () => {
    const res = await get('/welcome-in/link?token=abc')
    expect(res.headers.get('x-middleware-rewrite')).toBe('https://site.test/account/sign-in/link?token=abc')
  })

  it('redirects a page view of the old path to the new one, with query', async () => {
    const res = await get('/account/sign-in?next=%2Faccount')
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toBe('https://site.test/welcome-in?next=%2Faccount')
  })

  it('does not redirect a form post or server action on the old path', async () => {
    const post = await get('/account/sign-in', { method: 'POST', body: 'x' })
    expect(post.status).not.toBe(307)
    const action = await get('/account/sign-in', { headers: { 'next-action': 'abc' } })
    expect(action.status).not.toBe(307)
  })

  it('leaves the member sign-in alone when only the customer path is set', async () => {
    const res = await get('/account/member-sign-in')
    expect(res.status).not.toBe(307)
    expect(state.seen).toEqual([DEFAULT_MEMBER_SIGN_IN_PATH])
  })

  it('moves the member sign-in on its own', async () => {
    state.member = '/members-in'
    const redirect = await get('/account/member-sign-in')
    expect(redirect.headers.get('location')).toBe('https://site.test/members-in')
    const served = await get('/members-in')
    expect(served.headers.get('x-middleware-rewrite')).toBe('https://site.test/account/member-sign-in')
  })

  it('sends a redirect aimed at the old path straight to the new one', async () => {
    state.redirectTo = '/account/sign-in?social_error=state'
    const res = await get('/account/profile')
    expect(res.headers.get('location')).toBe('https://site.test/welcome-in?social_error=state')
  })

  it('does nothing when no custom path is set', async () => {
    state.customer = ''
    const res = await get('/account/sign-in')
    expect(res.status).not.toBe(307)
    expect(res.headers.get('x-middleware-rewrite')).toBeNull()
  })
})
