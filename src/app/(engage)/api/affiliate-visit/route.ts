import { NextResponse } from 'next/server'

import { chooseCode, cleanPath, looksLikeBot, normaliseCode, parseUtm, readRefCookie, refCookie } from '@/features/affiliates/core'
import { findActiveByCode, getSettings, logVisit, type D1 } from '@/features/affiliates/store'
import { rawD1 } from '@/features/ecommerce/server/db'
import { clientKey, hit } from '@/features/security/rateLimit'
import { getFeatureFlags } from '@/utilities/features'

export const dynamic = 'force-dynamic'

/**
 * POST { code, path, utm_source?, utm_medium?, utm_campaign? }: a visitor arrived with ?ref=code.
 * Sets the first-party `eg_ref` cookie (last click wins) and logs the visit. Crawlers are not logged.
 * Always answers ok so the page cannot tell which codes exist.
 */
export async function POST(request: Request): Promise<Response> {
  const ok = (headers?: HeadersInit): Response => NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store', ...headers } })
  if (!(await getFeatureFlags()).affiliates) return ok()
  if (hit(`affiliate-visit:${clientKey(request)}`, 30).limited) return ok()
  if (looksLikeBot(request.headers.get('user-agent'))) return ok()
  const body = (await request.json().catch((): null => null)) as Record<string, unknown> | null
  const code = normaliseCode(body?.code)
  if (!code) return ok()
  const d1 = (await rawD1()) as never as D1
  const affiliate = await findActiveByCode(d1, code).catch((): null => null)
  if (!affiliate) return ok()
  const utm = parseUtm({ get: (name) => (typeof body?.[name] === 'string' ? (body[name] as string) : null) })
  await logVisit(d1, { affiliateId: affiliate.id, path: cleanPath(body?.path), ...utm }, new Date().toISOString()).catch((): void => undefined)
  const settings = await getSettings(d1)
  const keep = chooseCode(readRefCookie(request.headers.get('cookie')), affiliate.code, settings.clickRule)
  return ok({ 'Set-Cookie': refCookie(keep, settings.cookieDays) })
}
