import { getCloudflareContext } from '@opennextjs/cloudflare'
import type { GetPlatformProxyOptions } from 'wrangler'

/**
 * Resolves the D1 binding without importing the schema. Kept in its own leaf
 * module so code that only needs the raw binding (the impersonation store,
 * reached from the edge request middleware) does not pull the whole schema,
 * and with it the node-only engine, into the edge bundle. `connect.ts`
 * re-exports this, so existing imports keep working.
 */

/**
 * Gets the D1 binding the same way src/engage.config.ts does for the original engine's
 * own adapter: `getCloudflareContext()` only resolves inside the actual
 * opennextjs-cloudflare runtime (production, or `next dev`/`wrangler dev`),
 * so anywhere else - the CLI, and this app's own vitest suite included -
 * falls back to wrangler's `getPlatformProxy()` against the local emulated
 * D1. Not the vendor package either way, just the Cloudflare/Next runtime
 * glue this app already depends on everywhere.
 */
export async function resolveD1Binding(): Promise<D1Database> {
  const isProduction = process.env.NODE_ENV === 'production' && !process.env.VITEST
  if (!isProduction) {
    const { getPlatformProxy } = await import(/* webpackIgnore: true */ `${'__wrangler'.replaceAll('_', '')}`)
    const proxy = await getPlatformProxy({ environment: process.env.CLOUDFLARE_ENV } satisfies GetPlatformProxyOptions)
    return (proxy.env as { D1: D1Database }).D1
  }
  const { env } = await getCloudflareContext({ async: true })
  return perRequestD1(env.D1)
}

/**
 * The engine builds its database connection once per isolate, from whichever request came first, and keeps it.
 * Handing it the raw binding would pin every later request to that first request's binding: it could not be
 * traced, and it could never use the read replica chosen for the current request (see
 * features/speed/d1Replica.ts). This stand-in looks the binding up from the request that is running when each
 * call is made. Outside a request (build time, tests) it falls back to the binding it was given.
 */
function perRequestD1(fallback: D1Database): D1Database {
  const current = (): D1Database => {
    try {
      const live = getCloudflareContext().env?.D1
      if (live && typeof live.prepare === 'function') return live
    } catch {
      // Not inside a request: use the binding we were given.
    }
    return fallback
  }
  return new Proxy(fallback, {
    get(_target, prop) {
      const value = (current() as unknown as Record<string | symbol, unknown>)[prop]
      return typeof value === 'function' ? (value as (...args: unknown[]) => unknown).bind(current()) : value
    },
  })
}
