import { NextRequest, NextResponse } from 'next/server'

import { domainMiddleware } from '@/features/domains/middleware'
import { multilingualMiddleware } from '@/features/multilingual/middleware'
import { LOCALE_HEADER } from '@/features/multilingual/routing'
import { securityMiddleware, readSecuritySettingsFromD1 } from '@/features/security'
import { STAGING_NOINDEX, isStaging } from '@/features/site/staging'
import { NOINDEX_HEADER_VALUE, isPickerRequest, isNoindexPath } from '@/features/security/noindex'
import { SESSION_COOKIE, tokenIssuedAt } from '@/features/security/loginProtection'
import {
  ADMIN_PATH_ENV,
  DEFAULT_ADMIN_PATH,
  isUnderAdminRoot,
  resolveAdminRoot,
} from '@/features/security/adminPath'
import {
  CUSTOMER_SIGN_IN_PATH_ENV,
  DEFAULT_SIGN_IN_PATHS,
  MEMBER_SIGN_IN_PATH_ENV,
  isUnderSignInRoot,
  resolveSignInPaths,
  type SignInPlace,
} from '@/features/security/signInPath'
import { DEFAULT_BLOG_BASE, DEFAULT_SHOP_BASE, isUnderPath } from '@/features/seo/permalinks'
import { parseFeedAddress } from '@/features/blog/feedAddress'
import { traceMark } from '@/features/speed/d1Timing'
import { readBlogBase, readShopBase } from '@/features/seo/permalinkStore'
import { readMultilingualSettingsFromD1 } from '@/features/multilingual/settings'
import { readDomainsFromD1 } from '@/features/domains/store'
import { readIpRulesCached } from '@/features/security/ipRulesStore'
import { readRateRulesCached } from '@/features/security/routeRulesStore'
import { refreshCspBuilder } from '@/features/security/cspBuilderStore'

/**
 * Host routing (features/domains) wraps locale routing (features/multilingual), which wraps the
 * security pipeline in features/security. Each lives in its feature; this file only composes them.
 *
 * The admin URL is configurable. When it is not /admin, requests under the configured path are
 * served by the admin at /admin (the rewrite runs the whole pipeline on the /admin path), and /admin
 * itself answers 404. Redirects that point at /admin are sent to the configured path instead.
 *
 * The blog address is configurable too (Task 16e). A custom one is served by the /blog folder, and a GET to /blog
 * redirects (308) to it.
 *
 * The customer and member sign-in URLs are configurable too (Task 19l). A custom path is served by the
 * default route (a rewrite), and a GET to the default path redirects to the custom one.
 *
 * Kept as a one-liner on purpose. Middleware runs on every single request, so
 * it is the worst place for logic to accumulate quietly.
 */
export async function middleware(request: NextRequest) {
  await traceMark('middleware start')
  await warmSettingCaches()
  await traceMark('middleware warmed')
  const served = await domainMiddleware(request, (routed) => serveAdminAware(routed))
  // The locale strip rewrites the path, so the stripped path (x-pathname) is checked as well as the request path.
  const { pathname } = request.nextUrl
  const root = await adminRootFor()
  // Any redirect a route handler sends into /admin (social sign-in, passkeys, Google) lands on the configured path.
  const adminAware = root === DEFAULT_ADMIN_PATH ? served : relocate(served, request, root)
  const response = relocateSignIn(adminAware, request, await signInPathsFor(root))
  const stripped = response.headers.get('x-pathname') ?? pathname
  if (isNoindexPath(pathname, root) || isNoindexPath(stripped, root) || isPickerRequest(request.nextUrl)) {
    response.headers.set('X-Robots-Tag', NOINDEX_HEADER_VALUE)
  }
  const signInPaths = await signInPathsFor(root)
  if (isUnderSignInRoot(pathname, signInPaths.customer) || isUnderSignInRoot(pathname, signInPaths.member)) {
    response.headers.set('X-Robots-Tag', NOINDEX_HEADER_VALUE)
  }
  // A staging site is never indexed, whatever the page says.
  if (isStaging()) response.headers.set('X-Robots-Tag', STAGING_NOINDEX)
  await traceMark('middleware end')
  return response
}

/**
 * Starts every per-isolate settings read the pipeline needs at the same time. They used to run one after
 * another, and with the database far from the Worker each is a full round trip (about 165 ms from Sydney
 * to a Denver primary). Reads already cached cost nothing; the rest now share one round trip. A failed
 * read is ignored here: the step that needs it reads it again and handles the failure as before.
 */
async function warmSettingCaches(): Promise<void> {
  await Promise.allSettled([
    readDomainsFromD1(),
    readMultilingualSettingsFromD1(),
    readSecuritySettingsFromD1(),
    readIpRulesCached(),
    readRateRulesCached(),
    refreshCspBuilder(),
    readBlogBase(),
    readShopBase(),
  ])
}

async function adminRootFor(): Promise<string> {
  const settings = await readSecuritySettingsFromD1()
  return resolveAdminRoot(settings.adminPath, process.env[ADMIN_PATH_ENV])
}

/** The sign-in paths in use: env first, then the saved settings, then the defaults. */
async function signInPathsFor(adminRoot: string): Promise<Record<SignInPlace, string>> {
  const settings = await readSecuritySettingsFromD1()
  return resolveSignInPaths(
    settings.signInPaths ?? {},
    { customer: process.env[CUSTOMER_SIGN_IN_PATH_ENV], member: process.env[MEMBER_SIGN_IN_PATH_ENV] },
    adminRoot,
  )
}

/** Routes one request: the configured admin path, the retired /admin, or the normal locale and security pipeline. */
async function serveAdminAware(request: NextRequest): Promise<NextResponse> {
  const root = await adminRootFor()
  const { pathname } = request.nextUrl
  if (root !== DEFAULT_ADMIN_PATH && isUnderAdminRoot(pathname, root)) return serveCustomAdmin(request, root)
  if (root !== DEFAULT_ADMIN_PATH && isUnderAdminRoot(pathname, DEFAULT_ADMIN_PATH)) {
    // A signed-in admin who follows an old /admin link (a bookmark, a link in a saved page) is sent to the same
    // place on the configured path. Anyone else gets a plain 404, which does not reveal the new path.
    if (hasAdminSessionCookie(request)) {
      const target = new URL(request.url)
      target.pathname = `${root}${pathname.slice(DEFAULT_ADMIN_PATH.length)}`
      return NextResponse.redirect(target, { status: 307, headers: { 'cache-control': 'private, no-store' } })
    }
    return new NextResponse('Not found', { status: 404, headers: { 'content-type': 'text/plain; charset=utf-8' } })
  }
  // The blog address (SEO settings, Permalinks): a custom one is served by the /blog folder, and /blog redirects to it.
  const blog = await readBlogBase()
  const feed = parseFeedAddress(pathname, blog)
  if (feed && isPlainNavigation(request)) {
    const target = new URL(request.url)
    target.pathname = '/feed.xml'
    target.search = `?${feed.query}=${encodeURIComponent(feed.slug)}`
    return NextResponse.rewrite(target)
  }
  // Moved addresses: the blog and the shop (with its products and categories). A custom one is served by the app folder,
  // and the old address redirects to it.
  const moves = addressMoves(blog, await readShopBase())
  for (const { custom, fallback } of moves) {
    if (isUnderPath(pathname, custom)) return serveRewritten(request, custom, fallback)
    if (isUnderPath(pathname, fallback) && isPlainNavigation(request)) {
      const target = new URL(request.url)
      target.pathname = `${custom}${pathname.slice(fallback.length)}`
      return NextResponse.redirect(target, { status: 308, headers: { 'cache-control': 'private, no-store' } })
    }
  }
  const signIn = await signInPathsFor(root)
  for (const place of ['customer', 'member'] as const) {
    const custom = signIn[place]
    const fallback = DEFAULT_SIGN_IN_PATHS[place]
    if (custom === fallback) continue
    if (isUnderSignInRoot(pathname, custom)) return serveRewritten(request, custom, fallback)
    if (isUnderSignInRoot(pathname, fallback) && isPlainNavigation(request)) {
      const target = new URL(request.url)
      target.pathname = `${custom}${pathname.slice(fallback.length)}`
      return NextResponse.redirect(target, { status: 307, headers: { 'cache-control': 'private, no-store' } })
    }
  }
  // With a custom address, a language prefix goes first (`/fr/news/hello`): the handler sees the stripped path.
  return multilingualMiddleware(request, moves.length > 0 ? addressAwareSecurity(moves) : securityMiddleware)
}

type AddressMove = { custom: string; fallback: string }

/** The addresses that differ from the app folder they are served from. Empty when the blog and the shop keep /blog and /shop. */
function addressMoves(blog: string, shop: string): AddressMove[] {
  const moves: AddressMove[] = []
  if (blog !== DEFAULT_BLOG_BASE) moves.push({ custom: `/${blog}`, fallback: `/${DEFAULT_BLOG_BASE}` })
  if (shop !== DEFAULT_SHOP_BASE) moves.push({ custom: `/${shop}`, fallback: `/${DEFAULT_SHOP_BASE}` })
  return moves
}

/**
 * The security pipeline for a request whose language prefix has already been stripped, on a site with a custom blog or shop
 * address: the custom address is served by the app folder, and the old address redirects to it (under the same language prefix).
 */
function addressAwareSecurity(moves: AddressMove[]): (request: NextRequest) => Promise<NextResponse> {
  return async (request) => {
    const { pathname } = request.nextUrl
    for (const { custom, fallback } of moves) {
      if (isUnderPath(pathname, custom)) {
        const url = new URL(request.url)
        url.pathname = `${fallback}${pathname.slice(custom.length)}`
        const readable = request.method === 'GET' || request.method === 'HEAD'
        const target = readable ? new NextRequest(url, { headers: request.headers, method: request.method }) : request
        const inner = await securityMiddleware(target)
        if (!readable || inner.headers.get('x-middleware-next') !== '1') return inner
        const out = NextResponse.rewrite(url, { request: { headers: target.headers } })
        inner.headers.forEach((value, key) => {
          if (!key.startsWith('x-middleware-') && key !== 'set-cookie') out.headers.set(key, value)
        })
        for (const cookie of inner.headers.getSetCookie()) out.headers.append('set-cookie', cookie)
        return out
      }
      if (isUnderPath(pathname, fallback) && isPlainNavigation(request)) {
        const locale = request.headers.get(LOCALE_HEADER)
        const target = new URL(request.url)
        target.pathname = `${locale ? `/${locale}` : ''}${custom}${pathname.slice(fallback.length)}`
        return NextResponse.redirect(target, { status: 308, headers: { 'cache-control': 'private, no-store' } })
      }
    }
    return securityMiddleware(request)
  }
}

/** A page view (GET or HEAD, not a server action): the only request that is redirected off the old sign-in path. */
function isPlainNavigation(request: NextRequest): boolean {
  return (request.method === 'GET' || request.method === 'HEAD') && !request.headers.has('next-action')
}

/** True when the request carries a session cookie shaped like one this site issues (a three-part token with an issue time). */
function hasAdminSessionCookie(request: NextRequest): boolean {
  const token = request.cookies.get(SESSION_COOKIE)?.value
  return Boolean(token && token.split('.').length === 3 && tokenIssuedAt(token) !== null)
}

/** Runs the pipeline on the /admin path that a configured admin URL stands for, then rewrites to it. */
async function serveCustomAdmin(request: NextRequest, root: string): Promise<NextResponse> {
  return serveRewritten(request, root, DEFAULT_ADMIN_PATH)
}

/** Runs the pipeline on the internal path that a custom URL stands for, then rewrites to it. */
async function serveRewritten(request: NextRequest, root: string, internal: string): Promise<NextResponse> {
  const rest = request.nextUrl.pathname.slice(root.length)
  const url = new URL(request.url)
  url.pathname = `${internal}${rest}`
  const readable = request.method === 'GET' || request.method === 'HEAD'
  const target = readable
    ? new NextRequest(url, { headers: request.headers, method: request.method })
    : new NextRequest(url, { headers: request.headers, method: request.method, body: request.body, duplex: 'half' } as RequestInit)

  const inner = await multilingualMiddleware(target, securityMiddleware)
  if (inner.headers.get('x-middleware-next') !== '1') return internal === DEFAULT_ADMIN_PATH ? relocate(inner, request, root) : inner

  const out = NextResponse.rewrite(url, { request: { headers: target.headers } })
  inner.headers.forEach((value, key) => {
    if (!key.startsWith('x-middleware-') && key !== 'set-cookie') out.headers.set(key, value)
  })
  for (const cookie of inner.headers.getSetCookie()) out.headers.append('set-cookie', cookie)
  return out
}

/** A redirect that points into /admin is sent to the configured admin URL instead. */
function relocate(response: NextResponse, request: NextRequest, root: string): NextResponse {
  const location = response.headers.get('location')
  if (!location) return response
  let target: URL
  try {
    target = new URL(location, request.nextUrl.origin)
  } catch {
    return response
  }
  if (target.origin !== request.nextUrl.origin || !isUnderAdminRoot(target.pathname, DEFAULT_ADMIN_PATH)) return response
  target.pathname = `${root}${target.pathname.slice(DEFAULT_ADMIN_PATH.length)}`
  response.headers.set('location', /^https?:\/\//.test(location) ? target.toString() : `${target.pathname}${target.search}`)
  return response
}

/** A redirect that points at a default sign-in path is sent to the custom one instead, saving a hop. */
function relocateSignIn(response: NextResponse, request: NextRequest, paths: Record<SignInPlace, string>): NextResponse {
  const location = response.headers.get('location')
  if (!location) return response
  let target: URL
  try {
    target = new URL(location, request.nextUrl.origin)
  } catch {
    return response
  }
  if (target.origin !== request.nextUrl.origin) return response
  for (const place of ['customer', 'member'] as const) {
    const fallback = DEFAULT_SIGN_IN_PATHS[place]
    if (paths[place] === fallback || !isUnderSignInRoot(target.pathname, fallback)) continue
    target.pathname = `${paths[place]}${target.pathname.slice(fallback.length)}`
    response.headers.set('location', /^https?:\/\//.test(location) ? target.toString() : `${target.pathname}${target.search}`)
    return response
  }
  return response
}
