/**
 * Debug timing for the D1 binding. When a request carries `x-eg-timing: 1`, the Worker counts the D1
 * statements that request runs and how long they take, and adds `x-d1-count` and `x-d1-ms` to the response.
 * Nothing about the queries themselves is exposed. Without the request header nothing is wrapped.
 */
export type D1Timing = { count: number; ms: number; trace?: string[]; t0?: number }

type AnyFn = (...args: unknown[]) => unknown

const timed = async (timing: D1Timing, run: () => unknown, label = ''): Promise<unknown> => {
  const start = Date.now()
  try {
    return await run()
  } finally {
    const took = Date.now() - start
    timing.count += 1
    timing.ms += took
    timing.trace?.push(`@${start - (timing.t0 ?? start)}+${took}ms ${label}`)
  }
}

const wrapStatement = (statement: Record<string, unknown>, timing: D1Timing, sql = ''): unknown =>
  new Proxy(statement, {
    get(target, prop) {
      const value = target[prop as string]
      if (typeof value !== 'function') return value
      if (prop === 'bind') return (...args: unknown[]) => wrapStatement((value as AnyFn).apply(target, args) as Record<string, unknown>, timing, sql)
      if (prop === 'first' || prop === 'all' || prop === 'run' || prop === 'raw') {
        return (...args: unknown[]) => timed(timing, () => (value as AnyFn).apply(target, args), sql)
      }
      return (value as AnyFn).bind(target)
    },
  })

export function wrapD1(db: Record<string, unknown>, timing: D1Timing): unknown {
  return new Proxy(db, {
    get(target, prop) {
      const value = target[prop as string]
      if (typeof value !== 'function') return value
      if (prop === 'prepare') return (sql: string) => wrapStatement((value as AnyFn).call(target, sql) as Record<string, unknown>, timing, sql.replace(/\s+/g, ' ').slice(0, 55))
      if (prop === 'batch' || prop === 'exec') return (...args: unknown[]) => timed(timing, () => (value as AnyFn).apply(target, args))
      return (value as AnyFn).bind(target)
    },
  })
}

const TRACED_METHODS = ['fetch', 'get', 'head', 'list', 'put', 'delete']

/** Times the methods of a non-D1 binding (assets, R2, images) so the trace shows every outside wait. */
function wrapBinding(name: string, binding: Record<string, unknown>, timing: D1Timing): unknown {
  return new Proxy(binding, {
    get(target, prop) {
      const value = target[prop as string]
      if (typeof value !== 'function') return value
      if (typeof prop === 'string' && TRACED_METHODS.includes(prop)) {
        return (...args: unknown[]) => {
          const first = args[0]
          const arg = typeof first === 'string' ? first : first instanceof Request ? first.url : ''
          return timed({ count: 0, ms: 0, trace: timing.trace, t0: timing.t0 }, () => (value as AnyFn).apply(target, args), `${name}.${prop} ${arg.slice(0, 50)}`)
        }
      }
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
  timing.t0 = Date.now()
  const others = new Map<string, unknown>()
  return new Proxy(source, {
    get: (target, prop) => {
      if (prop === 'D1') return wrapped
      const value = target[prop as string]
      if (timing.trace && typeof prop === 'string' && value && typeof value === 'object' && TRACED_METHODS.some((m) => typeof (value as Record<string, unknown>)[m] === 'function')) {
        if (!others.has(prop)) others.set(prop, wrapBinding(prop, value as Record<string, unknown>, timing))
        return others.get(prop)
      }
      return value
    },
  })
}

export function addTimingHeaders(response: Response, timing: D1Timing): Response {
  try {
    const headers = new Headers(response.headers)
    headers.set('x-d1-count', String(timing.count))
    headers.set('x-d1-ms', String(timing.ms))
    if (timing.trace) headers.set('x-d1-trace', timing.trace.join(' | ').replace(/[^\x20-\x7e]/g, '?').slice(0, 7000))
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers })
  } catch {
    return response
  }
}

/**
 * Debug only (trace mode 2): times outgoing `fetch` calls made while the request runs, so the trace shows
 * every wait on another server. The original fetch is restored when `restore()` is called. Concurrent
 * traced requests in one isolate may see each other's calls; it is a diagnostic, not a measurement tool.
 */
export function traceGlobalFetch(timing: D1Timing): () => void {
  const original = globalThis.fetch
  if (!timing.trace || typeof original !== 'function') return () => undefined
  const traced = ((input: RequestInfo | URL, init?: RequestInit) => {
    let label = ''
    try {
      const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : (input as Request).url)
      label = `fetch ${url.host}${url.pathname}`.slice(0, 60)
    } catch {
      label = 'fetch ?'
    }
    return timed({ count: 0, ms: 0, trace: timing.trace, t0: timing.t0 }, () => original(input, init), label) as Promise<Response>
  }) as typeof fetch
  globalThis.fetch = traced
  return () => {
    if (globalThis.fetch === traced) globalThis.fetch = original
  }
}

/**
 * Debug only (trace mode 2): drops a labelled mark into the trace. The Workers clock only moves when I/O finishes,
 * so a mark does one cheap cache lookup to refresh it; the gap between two marks then shows the compute between them.
 * Does nothing unless the current request is being traced.
 */
export async function traceMark(label: string): Promise<void> {
  const timing = (globalThis as { __egTiming?: D1Timing }).__egTiming
  if (!timing?.trace) return
  try {
    await (globalThis as { caches?: { default?: { match(req: Request): Promise<unknown> } } }).caches?.default?.match(new Request(`https://eg-trace.invalid/${Math.random()}`))
  } catch {
    // The mark still records below, with a stale clock.
  }
  timing.trace.push(`@${Date.now() - (timing.t0 ?? Date.now())}+0ms MARK ${label}`)
}

/** Makes `timing` the one marks are written to, until the returned function is called. */
export function startTimingMarks(timing: D1Timing): () => void {
  const holder = globalThis as { __egTiming?: D1Timing }
  holder.__egTiming = timing
  return () => {
    if (holder.__egTiming === timing) holder.__egTiming = undefined
  }
}
