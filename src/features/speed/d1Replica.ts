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

/** 'first-unconstrained', 'first-primary', or a D1 bookmark string. */
export type ReplicaConstraint = string

const BOOKMARK_COOKIE = 'eg_d1_bm'
const BOOKMARK_PATTERN = /^[A-Za-z0-9._-]{8,300}$/

/** The D1 bookmark a signed-in browser carries from its last response, or null when absent or malformed. */
export function readBookmark(cookieHeader: string | null): string | null {
  for (const part of (cookieHeader || '').split(';')) {
    const piece = part.trim()
    if (piece.startsWith(`${BOOKMARK_COOKIE}=`)) {
      const value = piece.slice(BOOKMARK_COOKIE.length + 1)
      return BOOKMARK_PATTERN.test(value) ? value : null
    }
  }
  return null
}

/**
 * Which kind of D1 session a request gets, or null to keep the plain primary binding.
 * Anonymous page views read from the nearest replica. Signed-in reads (the admin included) start from the
 * bookmark the browser got on its last response, so a replica serves them once it has caught up to that
 * point and an editor always sees their own saves. With no bookmark (first visit, or after a write, see
 * withBookmarkCookie) the first statement goes to the primary and later ones read a replica at least as new.
 * Writes and anything under /api keep the primary binding.
 */
export function replicaConstraint(request: { method: string; url: string; headers: { get(name: string): string | null } }): ReplicaConstraint | null {
  if (usesReplica(request)) return 'first-unconstrained'
  if (request.method !== 'GET' && request.method !== 'HEAD') return null
  let pathname = '/'
  try {
    pathname = new URL(request.url).pathname
  } catch {
    return null
  }
  if (/^\/api(\/|$)/.test(pathname) || /^\/_next\//.test(pathname)) return null
  const cookie = request.headers.get('cookie') || ''
  const signedIn = cookie.split(';').some((part) => part.trim().startsWith(`${SESSION_COOKIE}=`))
  return signedIn ? readBookmark(cookie) ?? 'first-primary' : null
}

type SessionCapable = { withSession?: (constraint: string) => unknown }
type BookmarkSession = { getBookmark?: () => string | null }

/** An env whose D1 binding reads through a D1 session, plus a way to read that session's bookmark. Anything unexpected returns the env unchanged. */
export function openReplicaEnv(env: unknown, constraint: ReplicaConstraint = 'first-unconstrained'): { env: unknown; bookmark: () => string | null } {
  const unchanged = { env, bookmark: (): string | null => null }
  try {
    const source = env as Record<string, unknown> | null | undefined
    const db = source?.D1 as SessionCapable | undefined
    if (!source || !db || typeof db.withSession !== 'function') return unchanged
    const session = db.withSession(constraint)
    if (!session) return unchanged
    return {
      env: new Proxy(source, { get: (target, prop) => (prop === 'D1' ? session : target[prop as string]) }),
      bookmark: () => {
        try {
          const value = (session as BookmarkSession).getBookmark?.() ?? null
          return typeof value === 'string' && BOOKMARK_PATTERN.test(value) ? value : null
        } catch {
          return null
        }
      },
    }
  } catch {
    return unchanged
  }
}

/** An env whose D1 binding reads from the nearest replica. Anything unexpected returns the env unchanged. */
export function envWithReplicaReads(env: unknown, constraint: ReplicaConstraint = 'first-unconstrained'): unknown {
  return openReplicaEnv(env, constraint).env
}

/** A request that may have written: anything but a plain page or asset read, or any /api call. */
function isWriteLike(request: { method: string; url: string }): boolean {
  if (request.method !== 'GET' && request.method !== 'HEAD') return true
  try {
    return /^\/api(\/|$)/.test(new URL(request.url).pathname)
  } catch {
    return false
  }
}

/**
 * Keeps a signed-in browser's bookmark current. After a read served through a D1 session the response carries the
 * session's bookmark, so the next request can read a replica without a trip to the primary. After a write or an /api
 * call from a signed-in browser the cookie is cleared, so the next page view starts at the
 * primary and cannot read a copy older than that write. Anonymous requests and cached pages are left alone.
 */
export function withBookmarkCookie(
  request: { method: string; url: string; headers: { get(name: string): string | null } },
  response: Response,
  handle: { bookmark: () => string | null } | null,
): Response {
  try {
    const cookie = request.headers.get('cookie') || ''
    const signedIn = cookie.split(';').some((part) => part.trim().startsWith(`${SESSION_COOKIE}=`))
    if (!signedIn) return response
    const flags = 'Path=/; HttpOnly; Secure; SameSite=Lax'
    let value: string | null = null
    if (response.status >= 500 && readBookmark(cookie)) {
      // A server error while reading from a bookmark: drop it so the next try starts at the primary and cannot be stuck on a bad one.
      value = `${BOOKMARK_COOKIE}=; ${flags}; Max-Age=0`
    } else if (handle) {
      const bookmark = handle.bookmark()
      if (!bookmark) return response
      value = `${BOOKMARK_COOKIE}=${bookmark}; ${flags}; Max-Age=900`
    } else if (readBookmark(cookie) && isWriteLike(request)) {
      value = `${BOOKMARK_COOKIE}=; ${flags}; Max-Age=0`
    }
    if (!value) return response
    const headers = new Headers(response.headers)
    headers.append('set-cookie', value)
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers })
  } catch {
    return response
  }
}
