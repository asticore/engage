/**
 * Read replicas for anonymous page views. When D1 read replication is switched on for the database
 * (Cloudflare dashboard, D1, the database, Settings), `withSession('first-unconstrained')` lets a read
 * go to the replica nearest the visitor instead of the primary, which cuts each query from about
 * 165 ms to a few ms for visitors far from the primary region. With replication off the same call
 * simply uses the primary, so this is safe to ship before it is switched on.
 *
 * Only plain anonymous GET and HEAD requests use it: no session or unlock cookie, and nothing under
 * the admin, API or account paths. Everyone else keeps reading the primary, so a signed-in editor
 * never sees a stale read after saving. Writes in a session always go to the primary.
 */
const SESSION_COOKIE = 'engage-token'
const UNLOCK_PREFIX = 'eg_unlock_'
const PRIMARY_ONLY = [/^\/admin(\/|$)/, /^\/api(\/|$)/, /^\/next(\/|$)/, /^\/my-route(\/|$)/, /^\/_next\//]

export function usesReplica(request: { method: string; url: string; headers: { get(name: string): string | null } }): boolean {
  if (request.method !== 'GET' && request.method !== 'HEAD') return false
  let pathname = '/'
  try {
    pathname = new URL(request.url).pathname
  } catch {
    return false
  }
  if (PRIMARY_ONLY.some((pattern) => pattern.test(pathname))) return false
  const cookie = request.headers.get('cookie') || ''
  return !cookie.split(';').some((part) => {
    const name = part.trim()
    return name.startsWith(`${SESSION_COOKIE}=`) || name.startsWith(UNLOCK_PREFIX)
  })
}

type SessionCapable = { withSession?: (constraint: string) => unknown }

/** An env whose D1 binding reads from the nearest replica. Anything unexpected returns the env unchanged. */
export function envWithReplicaReads(env: unknown): unknown {
  try {
    const source = env as Record<string, unknown> | null | undefined
    const db = source?.D1 as SessionCapable | undefined
    if (!source || !db || typeof db.withSession !== 'function') return env
    const session = db.withSession('first-unconstrained')
    if (!session) return env
    return new Proxy(source, { get: (target, prop) => (prop === 'D1' ? session : target[prop as string]) })
  } catch {
    return env
  }
}
