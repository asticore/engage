import { isPrivateHostname } from '@/features/media/stock'
import { judgeStatus, type LinkResult } from './linkCheckSummary'

/** The URL to fetch for a link, or null when it must not be fetched (private or local hosts, credentials, odd ports). */
export function fetchTarget(href: string, origin: string): string | null {
  let url: URL
  try {
    url = new URL(href, origin)
  } catch {
    return null
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
  if (url.username || url.password) return null
  const own = new URL(origin)
  if (url.host === own.host) return url.toString()
  if (url.port && url.port !== '80' && url.port !== '443') return null
  if (isPrivateHostname(url.hostname)) return null
  return url.toString()
}



const TIMEOUT_MS = 6000
const CONCURRENCY = 5

async function checkOne(href: string, origin: string): Promise<LinkResult> {
  const target = fetchTarget(href, origin)
  if (!target) return { href, status: 0, verdict: 'blocked' }
  const attempt = async (method: 'HEAD' | 'GET') => {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
    try {
      return await fetch(target, { method, redirect: 'manual', signal: controller.signal, headers: { 'user-agent': 'Mozilla/5.0 (compatible; SiteLinkChecker/1.0)' } })
    } finally {
      clearTimeout(timer)
    }
  }
  try {
    let res = await attempt('HEAD')
    // Some servers refuse HEAD: ask again with GET before calling the link broken.
    if (res.status === 405 || res.status === 501 || res.status === 400) res = await attempt('GET')
    const location = res.headers.get('location') ?? undefined
    return { href, status: res.status, verdict: judgeStatus(res.status), ...(location ? { location } : {}) }
  } catch {
    return { href, status: 0, verdict: 'unknown' }
  }
}

/** Checks the links with a few at a time. Never throws. */
export async function checkLinks(hrefs: string[], origin: string): Promise<LinkResult[]> {
  const results: LinkResult[] = new Array(hrefs.length)
  let next = 0
  const worker = async () => {
    while (next < hrefs.length) {
      const i = next++
      results[i] = await checkOne(hrefs[i], origin)
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, hrefs.length) }, worker))
  return results
}
