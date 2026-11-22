import { decryptSecretHook } from '@/utilities/secretField'

import { fetchReviews, validPlaceId, type FetchLike } from './adapters'
import { REVIEW_PROVIDERS, type LiveReview, type ReviewAccount, type ReviewProvider } from './types'

/** Reviews change slowly and the providers have quotas, so a fetched set is reused for six hours. */
export const REVIEWS_TTL_MS = 6 * 60 * 60 * 1000

type EngineLike = { findGlobal: (args: Record<string, unknown>) => Promise<unknown> }
const text = (v: unknown): string => (typeof v === 'string' ? v.trim() : '')

/** Reads the review keys saved in Integrations, decrypting tokens. Never throws. The result stays on the server. */
export async function readReviewAccounts(engine: EngineLike): Promise<ReviewAccount[]> {
  try {
    const doc = (await engine.findGlobal({ slug: 'integrations', depth: 0, overrideAccess: true })) as { socialAccounts?: unknown } | null
    const rows = Array.isArray(doc?.socialAccounts) ? (doc.socialAccounts as Record<string, unknown>[]) : []
    const out: ReviewAccount[] = []
    for (const r of rows) {
      const provider = text(r.provider) as ReviewProvider
      const id = text(r.id)
      if (!id || !REVIEW_PROVIDERS.includes(provider)) continue
      const raw = text(r.accessToken)
      const token = raw.startsWith('enc:v1:') ? text(decryptSecretHook({ value: raw } as never)) : raw
      out.push({ id, provider, label: text(r.label) || provider, accountId: text(r.accountId), token })
    }
    return out
  } catch {
    return []
  }
}

/** Id and label only: the one shape the editor may see. */
export const publicReviewSources = (accounts: ReviewAccount[]): { value: string; label: string }[] =>
  accounts.map((a) => ({ value: a.id, label: `${a.label} (${a.provider.replace('-reviews', '')})` }))

type Entry = { at: number; reviews: LiveReview[] }
const memory = new Map<string, Entry>()
const inflight = new Map<string, Promise<LiveReview[]>>()
const cacheRequest = (key: string): Request => new Request(`https://review-source-cache.invalid/${encodeURIComponent(key)}`)

async function edgeGet(key: string): Promise<Entry | null> {
  try {
    const hit = await (globalThis as { caches?: { default?: Cache } }).caches?.default?.match(cacheRequest(key))
    return hit ? ((await hit.json()) as Entry) : null
  } catch {
    return null
  }
}
async function edgePut(key: string, entry: Entry): Promise<void> {
  try {
    await (globalThis as { caches?: { default?: Cache } }).caches?.default?.put(
      cacheRequest(key),
      new Response(JSON.stringify(entry), { headers: { 'Cache-Control': `max-age=${REVIEWS_TTL_MS / 1000}`, 'Content-Type': 'application/json' } }),
    )
  } catch {
    /* the cache is an optimisation */
  }
}

/** Test hook. */
export const clearReviewCache = (): void => {
  memory.clear()
  inflight.clear()
}

/**
 * Reviews for a place: fresh cache first, then the provider. On a provider failure the last good copy (however old) is
 * served, otherwise the result is empty. Never throws and never leaks the key. The key itself is not in the cache key.
 */
export async function getReviews(account: ReviewAccount, placeId: string, fetchImpl?: FetchLike, now = Date.now()): Promise<LiveReview[]> {
  const id = validPlaceId(placeId || account.accountId)
  if (!id) return []
  const key = `${account.id}|${account.provider}|${id}`
  const mem = memory.get(key)
  if (mem && now - mem.at < REVIEWS_TTL_MS) return mem.reviews
  const edge = mem ? null : await edgeGet(key)
  if (edge && now - edge.at < REVIEWS_TTL_MS) {
    memory.set(key, edge)
    return edge.reviews
  }
  const running = inflight.get(key)
  if (running) return running
  const job = (async (): Promise<LiveReview[]> => {
    try {
      const reviews = await fetchReviews(account, id, fetchImpl)
      const entry = { at: now, reviews }
      memory.set(key, entry)
      await edgePut(key, entry)
      return reviews
    } catch {
      const stale = (mem ?? edge)?.reviews
      memory.set(key, { at: now - REVIEWS_TTL_MS + 120_000, reviews: stale ?? [] })
      return stale ?? []
    } finally {
      inflight.delete(key)
    }
  })()
  inflight.set(key, job)
  return job
}
