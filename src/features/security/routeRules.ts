/**
 * Per-route rate limit rules (Task 19b, first slice): an admin lists a path prefix, an optional method, a limit and a
 * window, and requests to that path are counted per address in D1. Over the limit gets a plain 429. The global limit and
 * the sign-in limit still apply as before. The longest matching prefix wins.
 */
export type RateRule = { id: number; pathPrefix: string; method: string; limit: number; windowSeconds: number; note: string; enabled: boolean }

export const MAX_RATE_RULES = 200
export const RATE_METHODS = ['ANY', 'GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const

export type RateRuleInput = { ok: true; rule: Omit<RateRule, 'id'> } | { ok: false; error: string }

export function parseRateRule(raw: unknown): RateRuleInput {
  const b = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const pathPrefix = typeof b.pathPrefix === 'string' ? b.pathPrefix.trim() : ''
  if (!pathPrefix.startsWith('/') || pathPrefix.length > 200 || /\s/.test(pathPrefix)) return { ok: false, error: 'The path must start with / and have no spaces, for example /api/forms.' }
  const method = typeof b.method === 'string' ? b.method.toUpperCase() : 'ANY'
  if (!(RATE_METHODS as readonly string[]).includes(method)) return { ok: false, error: 'Unknown method.' }
  const limit = Math.floor(Number(b.limit))
  if (!Number.isFinite(limit) || limit < 1 || limit > 100_000) return { ok: false, error: 'The limit must be from 1 to 100000.' }
  const windowSeconds = Math.floor(Number(b.windowSeconds))
  if (!Number.isFinite(windowSeconds) || windowSeconds < 10 || windowSeconds > 86_400) return { ok: false, error: 'The window must be from 10 seconds to 24 hours.' }
  const note = typeof b.note === 'string' ? b.note.trim().slice(0, 200) : ''
  return { ok: true, rule: { pathPrefix, method, limit, windowSeconds, note, enabled: b.enabled !== false } }
}

/** The rule that applies to a request: enabled, method matches, longest path prefix. */
export function matchRateRule(rules: RateRule[], pathname: string, method: string): RateRule | null {
  let best: RateRule | null = null
  for (const r of rules) {
    if (!r.enabled) continue
    if (r.method !== 'ANY' && r.method !== method.toUpperCase()) continue
    if (pathname !== r.pathPrefix && !pathname.startsWith(r.pathPrefix.endsWith('/') ? r.pathPrefix : `${r.pathPrefix}/`) && !(r.pathPrefix.endsWith('/') && pathname === r.pathPrefix.slice(0, -1))) continue
    if (!best || r.pathPrefix.length > best.pathPrefix.length) best = r
  }
  return best
}
