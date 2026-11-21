/**
 * Worker entry: wraps the OpenNext-generated worker and adds a `scheduled`
 * handler. Cloudflare's cron trigger (see `triggers.crons` in wrangler.jsonc)
 * calls it every 5 minutes, and it forwards to the app's own cron route so the
 * normal engine and bindings are used for publishing due documents.
 *
 * `.open-next/worker.js` only exists after `opennextjs-cloudflare build`, so the
 * import is invisible to the type checker.
 */

// @ts-ignore - generated at build time by opennextjs-cloudflare
import openNextWorker from './.open-next/worker.js'
import { envWithReplicaReads, usesReplica } from './src/features/speed/d1Replica'
import { addTimingHeaders, envWithD1Timing, traceGlobalFetch, traceMark, startTimingMarks, type D1Timing } from './src/features/speed/d1Timing'
import { withEdgeCache } from './src/features/speed/edgeCacheWorker'

// Durable Object classes must stay top-level exports of the Worker entry.
// @ts-ignore - generated at build time by opennextjs-cloudflare
export { DOQueueHandler, DOShardedTagCache, BucketCachePurge } from './.open-next/worker.js'

type CronEnv = { ENGAGE_SECRET?: string } & Record<string, unknown>

type OpenNextWorker = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response>
}

/** hex(SHA-256(ENGAGE_SECRET + ':cron')), the same key the cron route expects. */
export async function computeCronKey(engageSecret: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${engageSecret}:cron`))
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export async function runScheduled(worker: OpenNextWorker, env: CronEnv, ctx: unknown): Promise<void> {
  const secret = env.ENGAGE_SECRET
  if (!secret) return
  try {
    const request = new Request('https://cron.internal/api/cron/publish-scheduled', {
      method: 'POST',
      headers: { 'x-cron-key': await computeCronKey(secret) },
    })
    const response = await worker.fetch(request, env, ctx)
    if (!response.ok) console.error('scheduled publish failed:', response.status)
  } catch (error) {
    console.error('scheduled publish error:', error)
  }
}

export default {
  async fetch(request: Request, rawEnv: unknown, ctx: unknown): Promise<Response> {
    // Anonymous page views read from the nearest D1 replica when read replication is on (see d1Replica.ts).
    const env = usesReplica(request) ? envWithReplicaReads(rawEnv) : rawEnv
    const run = (e: unknown) =>
      withEdgeCache(request, e, ctx, (req, e2, c) => (openNextWorker as OpenNextWorker).fetch(req, e2, c))
    // Debug only: `x-eg-timing: 1` on a request reports how many D1 statements ran and how long they took.
    const mode = request.headers.get('x-eg-timing')
    if (mode !== '1' && mode !== '2') return run(env)
    // Mode 2 also lists each statement (first 90 characters, no values) with its time.
    const timing: D1Timing = { count: 0, ms: 0, trace: mode === '2' ? [] : undefined }
    const wrappedEnv = envWithD1Timing(env, timing)
    const restore = traceGlobalFetch(timing)
    const stopMarks = startTimingMarks(timing)
    try {
      await traceMark('worker start')
      return addTimingHeaders(await run(wrappedEnv), timing)
    } finally {
      restore()
      stopMarks()
    }
  },
  async scheduled(_event: unknown, env: CronEnv, ctx: { waitUntil(p: Promise<unknown>): void }): Promise<void> {
    ctx.waitUntil(runScheduled(openNextWorker as OpenNextWorker, env, ctx))
  },
}
