/**
 * Page snapshots: a finished copy of each public page kept in R2, shared by every Cloudflare location.
 *
 * The edge cache (edgeCacheWorker.ts) is per location and keyed by the cache epoch, so a publish, or a
 * visitor in a location that has not seen the page yet, used to mean a full page build (React plus
 * 30 to 50 database reads). With a snapshot that visitor gets the stored HTML from R2 instead:
 *
 * - Snapshot from the current epoch: served as is. No page build, no database read.
 * - Snapshot from an older epoch, within STALE_WINDOW_SECONDS of the last publish: the old copy is
 *   served at once and the page is rebuilt in the background ("stale while revalidate"), so nobody
 *   waits on a build after a publish. Past the window, or with no snapshot, the page is built as before.
 *
 * Only pages the edge cache already decided are safe to share are stored (anonymous visitors, 200 HTML,
 * no Set-Cookie). Signed-in visitors never reach this code. A rebuild that no longer gives a cacheable
 * page (unpublished or deleted) removes the snapshot. "Clear cache now" deletes every snapshot, so it
 * never serves a stale copy.
 *
 * Every failure here falls back to building the page, so a broken bucket can slow a page, never break it.
 */

/** Every snapshot lives under this prefix. Backups and the storage summary skip it (they are only copies). */
export const SNAPSHOT_PREFIX = '_eg-page-snapshots/'

/** How long after a publish an older copy may still be served while the new one builds. */
export const STALE_WINDOW_SECONDS = 600

/** A snapshot older than this is never served, even while the page rebuilds. */
export const MAX_AGE_SECONDS = 86_400

/**
 * Right after a publish a nearby read replica may still return the old content for a few seconds. A page
 * built in that gap is stored as one epoch older, so the next visitor triggers a background rebuild
 * instead of the old content being kept as current.
 */
export const SETTLE_SECONDS = 15

/** Pages larger than this are not stored (a copy that big is better rebuilt). */
const MAX_BODY_BYTES = 2_000_000

/** Response headers worth replaying from a snapshot. Anything else is dropped. */
const KEPT_HEADERS = ['content-type', 'content-language', 'x-robots-tag', 'vary', 'link']

/** R2 customMetadata is capped at 2 KB in total, so stored headers are kept well under that. */
const MAX_HEADER_JSON = 1500

export type SnapshotBucket = {
  get(key: string): Promise<{ text(): Promise<string>; customMetadata?: Record<string, string> } | null>
  put(key: string, value: string, options?: { customMetadata?: Record<string, string>; httpMetadata?: Record<string, string> }): Promise<unknown>
  delete(keys: string | string[]): Promise<void>
  list(options: { prefix: string; cursor?: string; limit?: number }): Promise<{ objects: { key: string }[]; truncated: boolean; cursor?: string }>
}

export type Snapshot = { body: string; epoch: number; at: number; headers: Record<string, string> }

export function readSnapshotBucket(env: unknown): SnapshotBucket | undefined {
  const candidate = (env as { R2?: SnapshotBucket } | null | undefined)?.R2
  return candidate && typeof candidate.get === 'function' && typeof candidate.put === 'function' ? candidate : undefined
}

/** The R2 key for a page: a hash of the cache key without the epoch, so each page has one snapshot. */
export async function snapshotKeyFor(cacheKey: string): Promise<string> {
  const url = new URL(cacheKey)
  url.searchParams.delete('v')
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(url.toString()))
  const hex = Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
  return `${SNAPSHOT_PREFIX}${hex}`
}

export async function readSnapshot(bucket: SnapshotBucket, key: string): Promise<Snapshot | null> {
  const object = await bucket.get(key)
  if (!object) return null
  const meta = object.customMetadata || {}
  const epoch = Number(meta.epoch)
  if (!Number.isFinite(epoch)) return null
  let headers: Record<string, string> = {}
  try {
    const parsed = JSON.parse(meta.h || '{}') as unknown
    if (parsed && typeof parsed === 'object') headers = parsed as Record<string, string>
  } catch {
    headers = {}
  }
  if (!/^\s*text\/html/i.test(headers['content-type'] || '')) return null
  const at = Number(meta.at)
  return { body: await object.text(), epoch, at: Number.isFinite(at) ? at : 0, headers }
}

/** Stores a copy of a cacheable page. Returns false when it was too large to keep. */
export async function writeSnapshot(bucket: SnapshotBucket, key: string, epoch: number, response: Response): Promise<boolean> {
  const body = await response.text()
  if (body.length > MAX_BODY_BYTES) return false
  const headers: Record<string, string> = {}
  for (const name of KEPT_HEADERS) {
    const value = response.headers.get(name)
    if (!value) continue
    headers[name] = value
    if (JSON.stringify(headers).length > MAX_HEADER_JSON) delete headers[name]
  }
  const now = Math.floor(Date.now() / 1000)
  const storedEpoch = epoch >= 1_000_000_000 && now - epoch < SETTLE_SECONDS ? epoch - 1 : epoch
  await bucket.put(key, body, {
    customMetadata: { epoch: String(storedEpoch), at: String(Math.floor(Date.now() / 1000)), h: JSON.stringify(headers) },
    httpMetadata: { contentType: headers['content-type'] || 'text/html; charset=utf-8' },
  })
  return true
}

/** A page response built from a snapshot. */
export function snapshotResponse(snapshot: Snapshot, ttlSeconds: number, tag: string): Response {
  const headers = new Headers(snapshot.headers)
  headers.set('Cache-Control', `public, max-age=0, s-maxage=${ttlSeconds}`)
  headers.set('x-edge-cache', tag)
  return new Response(snapshot.body, { status: 200, headers })
}

export type SnapshotVerdict = 'fresh' | 'stale' | 'none'

/** Fresh: serve. Stale: serve and rebuild in the background. None: build the page now. */
export function snapshotVerdict(
  snapshot: Pick<Snapshot, 'epoch' | 'at'>,
  currentEpoch: number,
  ttlSeconds: number,
  nowSeconds = Math.floor(Date.now() / 1000),
): SnapshotVerdict {
  if (snapshot.epoch >= currentEpoch) {
    // Same rule as the edge cache: a copy is current for one cache time. After that it is served once more
    // while it rebuilds (edits made with "clear on publish" turned off still show up), and after a day it is rebuilt first.
    const age = nowSeconds - snapshot.at
    if (age < ttlSeconds) return 'fresh'
    return age < MAX_AGE_SECONDS ? 'stale' : 'none'
  }
  return mayServeStale(snapshot.epoch, currentEpoch, nowSeconds) ? 'stale' : 'none'
}

/**
 * The cache epoch is the Unix time of the last publish (see epoch.ts), so "within the window" means
 * the publish happened less than STALE_WINDOW_SECONDS ago.
 */
export function mayServeStale(snapshotEpoch: number, currentEpoch: number, nowSeconds = Math.floor(Date.now() / 1000)): boolean {
  if (!(snapshotEpoch < currentEpoch)) return false
  // An epoch that is not a Unix time (a fresh install counts 1, 2, 3...) gives no publish time: build instead.
  if (currentEpoch < 1_000_000_000) return false
  const age = nowSeconds - currentEpoch
  return age >= 0 && age < STALE_WINDOW_SECONDS
}

/** Deletes every snapshot. Used by "Clear cache now". Returns how many were removed. */
export async function clearSnapshots(bucket: SnapshotBucket, maxPages = 20): Promise<number> {
  let removed = 0
  let cursor: string | undefined
  for (let page = 0; page < maxPages; page++) {
    const listing = await bucket.list({ prefix: SNAPSHOT_PREFIX, cursor, limit: 1000 })
    const keys = listing.objects.map((object) => object.key).filter((key) => key.startsWith(SNAPSHOT_PREFIX))
    if (keys.length) {
      await bucket.delete(keys)
      removed += keys.length
    }
    if (!listing.truncated || !listing.cursor) break
    cursor = listing.cursor
  }
  return removed
}

/** True for keys that are snapshots, not media. */
export const isSnapshotKey = (key: string): boolean => key.startsWith(SNAPSHOT_PREFIX)
