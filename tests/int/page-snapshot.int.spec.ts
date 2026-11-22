// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { resetEdgeSettingsMemo, withEdgeCache, type D1Like } from '@/features/speed/edgeCacheWorker'
import {
  MAX_AGE_SECONDS,
  SNAPSHOT_PREFIX,
  STALE_WINDOW_SECONDS,
  clearSnapshots,
  isSnapshotKey,
  mayServeStale,
  snapshotKeyFor,
  snapshotVerdict,
  writeSnapshot,
  readSnapshot,
  type SnapshotBucket,
} from '@/features/speed/pageSnapshot'

const BASE = 'https://example.com'
const NOW = Math.floor(Date.now() / 1000)
const EPOCH = NOW - 3600 // last publish an hour ago

type Stored = { body: string; customMetadata: Record<string, string> }

const fakeBucket = () => {
  const store = new Map<string, Stored>()
  const bucket: SnapshotBucket & { store: Map<string, Stored> } = {
    store,
    get: vi.fn(async (key: string) => {
      const item = store.get(key)
      return item ? { text: async () => item.body, customMetadata: item.customMetadata } : null
    }),
    put: vi.fn(async (key: string, value: string, options?: { customMetadata?: Record<string, string> }) => {
      store.set(key, { body: value, customMetadata: options?.customMetadata || {} })
    }),
    delete: vi.fn(async (keys: string | string[]) => {
      for (const key of Array.isArray(keys) ? keys : [keys]) store.delete(key)
    }),
    list: vi.fn(async ({ prefix }: { prefix: string }) => ({
      objects: [...store.keys()].filter((key) => key.startsWith(prefix)).map((key) => ({ key })),
      truncated: false,
    })),
  }
  return bucket
}

const row = (epoch: number) => ({ pageCache: 1, ttl: 900, epoch, paths: '', cookies: '', queries: '', mobile: 0, loggedIn: 0, speedOn: 1 })
const fakeDb = (epoch: number): D1Like => ({ prepare: () => ({ first: async <T>(): Promise<T | null> => row(epoch) as T }) })
const html = (body: string) => new Response(body, { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } })

/** Runs every waitUntil promise so background work is finished before the assertions. */
const ctx = () => {
  const pending: Promise<unknown>[] = []
  return { waitUntil: (p: Promise<unknown>) => pending.push(p), settle: async () => { await Promise.all(pending) } }
}

const seed = async (bucket: SnapshotBucket, path: string, body: string, epoch: number, at: number) => {
  const key = await snapshotKeyFor(`${BASE}${path}?v=${epoch}&x=-.u`)
  const headers = { 'content-type': 'text/html; charset=utf-8', 'x-frame-options': 'SAMEORIGIN' }
  await bucket.put(key, `${JSON.stringify(headers)}\n${body}`, { customMetadata: { f: '2', epoch: String(epoch), at: String(at) } })
  return key
}

describe('snapshot rules', () => {
  it('keys a page by URL and variant, not by epoch', async () => {
    const a = await snapshotKeyFor(`${BASE}/about?v=1&x=-.u`)
    const b = await snapshotKeyFor(`${BASE}/about?v=99&x=-.u`)
    const c = await snapshotKeyFor(`${BASE}/about?v=1&x=fr.u`)
    expect(a).toBe(b)
    expect(a).not.toBe(c)
    expect(isSnapshotKey(a)).toBe(true)
  })

  it('serves an older copy only shortly after a publish', () => {
    expect(mayServeStale(EPOCH - 10, NOW - 60, NOW)).toBe(true)
    expect(mayServeStale(EPOCH - 10, NOW - STALE_WINDOW_SECONDS - 1, NOW)).toBe(false)
    expect(mayServeStale(5, 6, NOW)).toBe(false) // counter epochs carry no publish time
  })

  it('treats a current copy as fresh for one cache time, then stale, then gone', () => {
    expect(snapshotVerdict({ epoch: EPOCH, at: NOW - 10 }, EPOCH, 900, NOW)).toBe('fresh')
    expect(snapshotVerdict({ epoch: EPOCH, at: NOW - 1000 }, EPOCH, 900, NOW)).toBe('stale')
    expect(snapshotVerdict({ epoch: EPOCH, at: NOW - MAX_AGE_SECONDS - 1 }, EPOCH, 900, NOW)).toBe('none')
  })

  it('stores a copy built right after a publish as one epoch older', async () => {
    const bucket = fakeBucket()
    await writeSnapshot(bucket, `${SNAPSHOT_PREFIX}x`, NOW, html('<p>new</p>'))
    const snap = await readSnapshot(bucket, `${SNAPSHOT_PREFIX}x`)
    expect(snap?.epoch).toBe(NOW - 1)
  })

  it('clears only snapshot keys', async () => {
    const bucket = fakeBucket()
    await bucket.put('media/photo.jpg', 'img')
    await seed(bucket, '/a', '<p>a</p>', EPOCH, NOW)
    expect(await clearSnapshots(bucket)).toBe(1)
    expect(bucket.store.has('media/photo.jpg')).toBe(true)
  })
})

describe('withEdgeCache with snapshots', () => {
  beforeEach(() => {
    resetEdgeSettingsMemo()
    ;(globalThis as { caches?: unknown }).caches = { default: { match: vi.fn(async () => undefined), put: vi.fn(async () => undefined) } }
  })
  afterEach(() => {
    delete (globalThis as { caches?: unknown }).caches
  })

  it('serves a current snapshot without building the page', async () => {
    const bucket = fakeBucket()
    await seed(bucket, '/about', '<p>snap</p>', EPOCH, NOW - 5)
    const handler = vi.fn(async () => html('<p>built</p>'))
    const response = await withEdgeCache(new Request(`${BASE}/about`), { D1: fakeDb(EPOCH), R2: bucket }, ctx(), handler)
    expect(handler).not.toHaveBeenCalled()
    expect(response.headers.get('x-edge-cache')).toBe('SNAPSHOT')
    expect(response.headers.get('x-frame-options')).toBe('SAMEORIGIN')
    expect(await response.text()).toBe('<p>snap</p>')
  })

  it('stores a snapshot on a miss', async () => {
    const bucket = fakeBucket()
    const work = ctx()
    const built = () => new Response('<p>built</p>', { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Strict-Transport-Security': 'max-age=63072000' } })
    const response = await withEdgeCache(new Request(`${BASE}/about`), { D1: fakeDb(EPOCH), R2: bucket }, work, async () => built())
    expect(await response.text()).toBe('<p>built</p>')
    await work.settle()
    const key = await snapshotKeyFor(`${BASE}/about?v=${EPOCH}&x=-.u`)
    expect(bucket.store.get(key)?.body.endsWith('\n<p>built</p>')).toBe(true)
    const stored = await readSnapshot(bucket, key)
    expect(stored?.body).toBe('<p>built</p>')
    expect(stored?.headers['strict-transport-security']).toBe('max-age=63072000')
    expect(stored?.headers['set-cookie']).toBeUndefined()
    expect(bucket.store.get(key)?.customMetadata.epoch).toBe(String(EPOCH))
  })

  it('serves the old copy right after a publish and rebuilds it in the background', async () => {
    const bucket = fakeBucket()
    const published = NOW - 30
    const key = await seed(bucket, '/about', '<p>old</p>', EPOCH, NOW - 100)
    const handler = vi.fn(async () => html('<p>new</p>'))
    const work = ctx()
    const response = await withEdgeCache(new Request(`${BASE}/about`), { D1: fakeDb(published), R2: bucket }, work, handler)
    expect(response.headers.get('x-edge-cache')).toBe('STALE')
    expect(await response.text()).toBe('<p>old</p>')
    await work.settle()
    expect(handler).toHaveBeenCalledTimes(1)
    expect((await readSnapshot(bucket, key))?.body).toBe('<p>new</p>')
  })

  it('ignores a snapshot in an older storage format', async () => {
    const bucket = fakeBucket()
    const key = await snapshotKeyFor(`${BASE}/old?v=${EPOCH}&x=-.u`)
    await bucket.put(key, '<p>old</p>', { customMetadata: { epoch: String(EPOCH), at: String(NOW), h: '{"content-type":"text/html"}' } })
    expect(await readSnapshot(bucket, key)).toBeNull()
  })

  it('drops the snapshot when the rebuilt page is gone', async () => {
    const bucket = fakeBucket()
    const key = await seed(bucket, '/gone', '<p>old</p>', EPOCH, NOW - 100)
    const work = ctx()
    await withEdgeCache(new Request(`${BASE}/gone`), { D1: fakeDb(NOW - 30), R2: bucket }, work, async () => new Response('nope', { status: 404, headers: { 'Content-Type': 'text/html' } }))
    await work.settle()
    expect(bucket.store.has(key)).toBe(false)
  })

  it('builds the page when the publish was long ago and the copy is older', async () => {
    const bucket = fakeBucket()
    const key = await seed(bucket, '/gone', '<p>old</p>', EPOCH - 5000, NOW - 9000)
    const work = ctx()
    const response = await withEdgeCache(new Request(`${BASE}/gone`), { D1: fakeDb(EPOCH), R2: bucket }, work, async () => new Response('nope', { status: 404, headers: { 'Content-Type': 'text/html' } }))
    expect(response.status).toBe(404)
    await work.settle()
    expect(bucket.store.has(key)).toBe(false)
  })

  it('never uses snapshots for a signed-in visitor', async () => {
    const bucket = fakeBucket()
    await seed(bucket, '/about', '<p>snap</p>', EPOCH, NOW - 5)
    const handler = vi.fn(async () => html('<p>built</p>'))
    const response = await withEdgeCache(new Request(`${BASE}/about`, { headers: { Cookie: 'engage-token=abc' } }), { D1: fakeDb(EPOCH), R2: bucket }, ctx(), handler)
    expect(handler).toHaveBeenCalledTimes(1)
    expect(await response.text()).toBe('<p>built</p>')
    expect(bucket.get).not.toHaveBeenCalled()
  })
})
