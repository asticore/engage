/**
 * Runtime half of the edge page cache (wave 17). Called from the Worker entry
 * (cloudflare-worker.ts) around the OpenNext handler.
 *
 * Every failure in here falls through to the normal handler, so a broken
 * cache can slow a page down but never break one. The handler is called
 * exactly once per request, whichever path is taken.
 *
 * Settings come from one D1 query, memoised per isolate for 10 seconds. The
 * query also checks the "speed" feature flag, so with the feature off nothing
 * is read from the cache and no header is added.
 */
import { publishEpoch } from './epochState'
import { readSnapshot, readSnapshotBucket, snapshotKeyFor, snapshotResponse, snapshotVerdict, writeSnapshot, type SnapshotBucket } from './pageSnapshot'
import { isOptInCountry } from '../consent/regions'
import {
  clampTtl,
  cacheKeyFor,
  isCacheableResponse,
  isMobileUserAgent,
  visitorVariant,
  parseRuleLines,
  requestVerdict,
  type EdgeRules,
} from './edgeCache'

export type EdgeSettings = EdgeRules & {
  enabled: boolean
  ttlSeconds: number
  epoch: number
  mobileSeparately: boolean
}

export type D1Like = {
  prepare(sql: string): { first<T>(): Promise<T | null> }
}

type CacheLike = {
  match(key: string): Promise<Response | undefined>
  put(key: string, response: Response): Promise<void>
}

type WaitUntilCtx = { waitUntil(promise: Promise<unknown>): void }

type Handler = (request: Request, env: unknown, ctx: unknown) => Promise<Response>

type SettingsRow = {
  rowId?: unknown
  pageCache: unknown
  ttl: unknown
  epoch: unknown
  paths: string | null
  cookies: string | null
  queries: string | null
  mobile: unknown
  loggedIn: unknown
  speedOn: unknown
}

/** One query, aliased to the names used below. speedOn reads the feature flag from Site Settings. */
const SETTINGS_SQL = [
  'SELECT s.id AS rowId, s.caching_page_cache AS pageCache,',
  ' s.caching_cache_ttl_seconds AS ttl,',
  ' s.cache_epoch AS epoch,',
  ' s.caching_never_cache_paths AS paths,',
  ' s.caching_never_cache_cookies AS cookies,',
  ' s.caching_never_cache_query_strings AS queries,',
  ' s.caching_cache_mobile_separately AS mobile,',
  ' s.caching_cache_logged_in_users AS loggedIn,',
  ' f.features_speed AS speedOn',
  ' FROM (SELECT features_speed FROM eg_site_settings LIMIT 1) f',
  ' LEFT JOIN (SELECT * FROM eg_speed_settings LIMIT 1) s ON 1',
].join('')

const MEMO_MS = 10000

let memo: { at: number; value: EdgeSettings | null } | null = null
let pending: Promise<EdgeSettings | null> | null = null

const truthy = (value: unknown): boolean => value === 1 || value === true || value === '1'

export const toEdgeSettings = (row: SettingsRow | null): EdgeSettings | null => {
  if (!row) return null
  // No saved Speed settings yet (a fresh install): the page cache is on by default, with the default time.
  // Saving the Speed settings page writes a row, and from then on the admin's choice decides.
  if (row.rowId === null) {
    return {
      enabled: truthy(row.speedOn),
      ttlSeconds: clampTtl(undefined),
      epoch: 1,
      mobileSeparately: false,
      cacheLoggedInUsers: false,
      neverCachePaths: [],
      neverCacheCookies: [],
      neverCacheQueryStrings: [],
    }
  }
  const epochNumber = Number(row.epoch)
  return {
    enabled: truthy(row.speedOn) && truthy(row.pageCache),
    ttlSeconds: clampTtl(row.ttl === null || row.ttl === undefined ? undefined : Number(row.ttl)),
    epoch: Number.isFinite(epochNumber) && epochNumber > 0 ? epochNumber : 1,
    mobileSeparately: truthy(row.mobile),
    cacheLoggedInUsers: truthy(row.loggedIn),
    neverCachePaths: parseRuleLines(row.paths),
    neverCacheCookies: parseRuleLines(row.cookies),
    neverCacheQueryStrings: parseRuleLines(row.queries).map((line) => line.toLowerCase()),
  }
}

/** Reads the settings, memoised for 10 seconds. A failed read is remembered as "off" for the same window. */
export async function loadEdgeSettings(db: D1Like | undefined): Promise<EdgeSettings | null> {
  if (!db) return null
  if (memo && Date.now() - memo.at < MEMO_MS) return memo.value
  if (!pending) {
    const load = (async (): Promise<EdgeSettings | null> => {
      try {
        const row = await db.prepare(SETTINGS_SQL).first<SettingsRow>()
        return toEdgeSettings(row)
      } catch {
        return null
      }
    })().then((value) => {
      memo = { at: Date.now(), value }
      publishEpoch(value && value.enabled ? value.epoch : undefined)
      return value
    })
    pending = load.finally((): void => {
      pending = null
    })
  }
  return pending
}

/** Test hook and admin use: forget the memo so the next request re-reads the settings. */
export const resetEdgeSettingsMemo = (): void => {
  memo = null
  pending = null
}

const readD1 = (env: unknown): D1Like | undefined => {
  const candidate = (env as { D1?: D1Like } | null | undefined)?.D1
  return candidate && typeof candidate.prepare === 'function' ? candidate : undefined
}

/** The deployed Worker version (Cloudflare's version_metadata binding), shortened. Empty when the binding is missing. */
export const readBuild = (env: unknown): string => {
  const id = (env as { CF_VERSION_METADATA?: { id?: unknown } } | null | undefined)?.CF_VERSION_METADATA?.id
  return typeof id === 'string' ? id.replace(/[^A-Za-z0-9]/g, '').slice(0, 12) : ''
}

const openCache = (): CacheLike | null => {
  try {
    const store = (globalThis as { caches?: { default?: unknown } }).caches?.default
    return store ? (store as CacheLike) : null
  } catch {
    return null
  }
}

/** Copy of a response with one extra debug header. The body is passed through untouched. */
export function tagResponse(response: Response, value: string): Response {
  try {
    const headers = new Headers(response.headers)
    headers.set('x-edge-cache', value)
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers })
  } catch {
    return response
  }
}

/** The copy that goes into the cache: shared-cache TTL only, no debug header. */
export function storedCopy(response: Response, ttlSeconds: number): Response {
  const headers = new Headers(response.headers)
  headers.set('Cache-Control', `public, max-age=0, s-maxage=${ttlSeconds}`)
  headers.delete('x-edge-cache')
  return new Response(response.body, { status: 200, headers })
}

const keepAlive = (ctx: unknown, work: Promise<unknown>): void => {
  work.catch((): void => undefined)
  const waiter = ctx as Partial<WaitUntilCtx> | undefined
  if (waiter && typeof waiter.waitUntil === 'function') waiter.waitUntil(work)
}

/**
 * Serves a stored copy when there is one, otherwise calls the handler and
 * stores a copy of a cacheable 200 HTML response.
 */
export async function withEdgeCache(request: Request, env: unknown, ctx: unknown, handler: Handler): Promise<Response> {
  if (request.method !== 'GET' && request.method !== 'HEAD') return handler(request, env, ctx)

  let settings: EdgeSettings | null = null
  try {
    settings = await loadEdgeSettings(readD1(env))
  } catch {
    settings = null
  }
  if (!settings || !settings.enabled) return handler(request, env, ctx)

  let verdict: { cacheable: boolean; reason: string }
  try {
    verdict = requestVerdict(request.url, request.method, request.headers, settings)
  } catch {
    verdict = { cacheable: false, reason: 'error' }
  }
  if (!verdict.cacheable) return tagResponse(await handler(request, env, ctx), `BYPASS(${verdict.reason})`)

  const build = readBuild(env)
  let key: string | null = null
  let cache: CacheLike | null = null
  try {
    cache = openCache()
    const mobile = settings.mobileSeparately && isMobileUserAgent(request.headers.get('user-agent'))
    key = cacheKeyFor(
      request.url,
      settings.epoch,
      mobile,
      visitorVariant(request.headers.get('accept-language'), request.headers.get('cf-ipcountry'), isOptInCountry),
      build,
    )
    if (cache) {
      const hit = await cache.match(key)
      if (hit) {
        const headers = new Headers(hit.headers)
        headers.set('x-edge-cache', 'HIT')
        return new Response(hit.body, { status: hit.status, statusText: hit.statusText, headers })
      }
    }
  } catch {
    // A failed lookup is a miss, never an error for the visitor.
  }

  // Not in this location's cache: try the shared snapshot in R2 before building the page.
  const bucket = key ? readSnapshotBucket(env) : undefined
  let snapshotKey: string | null = null
  let hadSnapshot = false
  if (bucket && key) {
    try {
      snapshotKey = await snapshotKeyFor(key)
      const snapshot = await readSnapshot(bucket, snapshotKey)
      hadSnapshot = Boolean(snapshot)
      const verdict = snapshot ? snapshotVerdict(snapshot, settings.epoch, settings.ttlSeconds, undefined, build) : 'none'
      if (snapshot && verdict === 'fresh') {
        if (cache && request.method === 'GET') keepAlive(ctx, cache.put(key, storedCopy(snapshotResponse(snapshot, settings.ttlSeconds, ''), settings.ttlSeconds)))
        return snapshotResponse(snapshot, settings.ttlSeconds, 'SNAPSHOT')
      }
      if (snapshot && verdict === 'stale') {
        refreshInBackground(request, env, ctx, handler, { cache, key, bucket, snapshotKey, settings, build })
        return snapshotResponse(snapshot, settings.ttlSeconds, 'STALE')
      }
    } catch {
      // A failed snapshot read is a miss.
    }
  }

  const response = await handler(request, env, ctx)
  if (!key || request.method !== 'GET') return tagResponse(response, 'MISS')

  try {
    if (isCacheableResponse(response.status, response.headers)) {
      const toStore = storedCopy(response.clone(), settings.ttlSeconds)
      if (cache) keepAlive(ctx, cache.put(key, toStore))
      if (bucket && snapshotKey) keepAlive(ctx, writeSnapshot(bucket, snapshotKey, settings.epoch, response.clone(), build))
    } else if (bucket && snapshotKey && hadSnapshot) {
      // The page is gone or no longer shareable: its old snapshot must never be served again.
      keepAlive(ctx, bucket.delete(snapshotKey))
    }
  } catch {
    // The copy could not be taken or stored. The visitor still gets the page.
  }
  return tagResponse(response, 'MISS')
}

/** Keys being rebuilt in this isolate, so a burst of visitors starts one rebuild, not one each. */
const refreshing = new Set<string>()

type RefreshTarget = { cache: CacheLike | null; key: string; bucket: SnapshotBucket; snapshotKey: string; settings: EdgeSettings; build: string }

/**
 * Builds the page again after a stale snapshot was served, then stores the new copy. A page that is no
 * longer cacheable (unpublished, deleted, now private) loses its snapshot instead.
 */
function refreshInBackground(request: Request, env: unknown, ctx: unknown, handler: Handler, target: RefreshTarget): void {
  if (refreshing.has(target.snapshotKey)) return
  refreshing.add(target.snapshotKey)
  const work = (async (): Promise<void> => {
    const fresh = await handler(new Request(request.url, { method: 'GET', headers: request.headers }), env, ctx)
    if (isCacheableResponse(fresh.status, fresh.headers)) {
      if (target.cache) await target.cache.put(target.key, storedCopy(fresh.clone(), target.settings.ttlSeconds))
      await writeSnapshot(target.bucket, target.snapshotKey, target.settings.epoch, fresh, target.build)
    } else {
      await target.bucket.delete(target.snapshotKey)
    }
  })().finally((): void => {
    refreshing.delete(target.snapshotKey)
  })
  keepAlive(ctx, work)
}