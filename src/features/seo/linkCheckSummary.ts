/** Light, client-safe parts of the link checker: how a reply is judged and the summary counts. */

export type LinkVerdict = 'ok' | 'redirect' | 'broken' | 'blocked' | 'unknown'

/** 2xx fine, 3xx a redirect (still works), 404 and 410 broken, 5xx and refusals unknown (the site may block checkers). */
export function judgeStatus(status: number): LinkVerdict {
  if (status >= 200 && status < 300) return 'ok'
  if (status >= 300 && status < 400) return 'redirect'
  if (status === 404 || status === 410) return 'broken'
  if (status === 401 || status === 403 || status === 429 || status === 999) return 'blocked'
  if (status === 0 || status >= 400) return status >= 500 || status === 0 ? 'unknown' : 'broken'
  return 'unknown'
}

export type LinkResult = { href: string; status: number; verdict: LinkVerdict; location?: string }

/** Summary for the audit tiles. */
export function summariseLinks(results: LinkResult[]): { checked: number; broken: number; redirects: number; unknown: number } {
  return {
    checked: results.length,
    broken: results.filter((r) => r.verdict === 'broken').length,
    redirects: results.filter((r) => r.verdict === 'redirect').length,
    unknown: results.filter((r) => r.verdict === 'unknown' || r.verdict === 'blocked').length,
  }
}
