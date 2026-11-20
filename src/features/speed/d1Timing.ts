/**
 * Debug timing for the D1 binding. When a request carries `x-eg-timing: 1`, the Worker counts the D1
 * statements that request runs and how long they take, and adds `x-d1-count` and `x-d1-ms` to the response.
 * Nothing about the queries themselves is exposed. Without the request header nothing is wrapped.
 */
export type D1Timing = { count: number; ms: number }

type AnyFn = (...args: unknown[]) => unknown

const timed = async (timing: D1Timing, run: () => unknown): Promise<unknown> => {
  const start = Date.now()
  try {
    return await run()
  } finally {
    timing.count += 1
    timing.ms += Date.now() - start
  }
}

const wrapStatement = (statement: Record<string, unknown>, timing: D1Timing): unknown =>
  new Proxy(statement, {
    get(target, prop) {
      const value = target[prop as string]
      if (typeof value !== 'function') return value
      if (prop === 'bind') return (...args: unknown[]) => wrapStatement((value as AnyFn).apply(target, args) as Record<string, unknown>, timing)
      if (prop === 'first' || prop === 'all' || prop === 'run' || prop === 'raw') {
        return (...args: unknown[]) => timed(timing, () => (value as AnyFn).apply(target, args))
      }
      return (value as AnyFn).bind(target)
    },
  })

export function wrapD1(db: Record<string, unknown>, timing: D1Timing): unknown {
  return new Proxy(db, {
    get(target, prop) {
      const value = target[prop as string]
      if (typeof value !== 'function') return value
      if (prop === 'prepare') return (sql: string) => wrapStatement((value as AnyFn).call(target, sql) as Record<string, unknown>, timing)
      if (prop === 'batch' || prop === 'exec') return (...args: unknown[]) => timed(timing, () => (value as AnyFn).apply(target, args))
      return (value as AnyFn).bind(target)
    },
  })
}

/** An env whose D1 binding is the counting wrapper. Every other binding is passed through untouched. */
export function envWithD1Timing(env: unknown, timing: D1Timing): unknown {
  const source = env as Record<string, unknown> | null | undefined
  const db = source?.D1 as Record<string, unknown> | undefined
  if (!source || !db || typeof db.prepare !== 'function') return env
  const wrapped = wrapD1(db, timing)
  return new Proxy(source, { get: (target, prop) => (prop === 'D1' ? wrapped : target[prop as string]) })
}

export function addTimingHeaders(response: Response, timing: D1Timing): Response {
  try {
    const headers = new Headers(response.headers)
    headers.set('x-d1-count', String(timing.count))
    headers.set('x-d1-ms', String(timing.ms))
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers })
  } catch {
    return response
  }
}
