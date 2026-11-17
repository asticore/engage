import { isReportNoise, parseReports } from '@/features/security/cspBuilder'
import { recordViolations, refreshCspBuilder, type D1 } from '@/features/security/cspBuilderStore'
import { clientKey, hit } from '@/features/security/rateLimit'
import { rawD1 } from '@/features/ecommerce/server/db'

export const dynamic = 'force-dynamic'

const MAX_BODY = 16 * 1024
const empty = (status: number): Response => new Response(null, { status, headers: { 'Cache-Control': 'no-store' } })

/**
 * Receives Content-Security-Policy violation reports from visitors' browsers (report-uri). Public by nature, so it
 * is small and defensive: only while the builder is on and collecting, body capped, rate limited per address and
 * overall, log capped (see recordViolations), and it never answers with anything but an empty status.
 */
export async function POST(request: Request): Promise<Response> {
  const config = await refreshCspBuilder()
  if (config.mode === 'off' || !config.collectReports) return empty(204)
  if (hit(`csp-report:${clientKey(request)}`, 30).limited || hit('csp-report:all', 600).limited) return empty(429)
  const text = (await request.text().catch(() => '')).slice(0, MAX_BODY + 1)
  if (!text || text.length > MAX_BODY) return empty(413)
  let payload: unknown
  try {
    payload = JSON.parse(text)
  } catch {
    return empty(400)
  }
  const violations = parseReports(payload).filter((v) => !isReportNoise(v))
  if (violations.length === 0) return empty(204)
  try {
    await recordViolations((await rawD1()) as never as D1, violations, new Date().toISOString())
  } catch {
    // A logging problem must never surface to the visitor's browser.
  }
  return empty(204)
}
