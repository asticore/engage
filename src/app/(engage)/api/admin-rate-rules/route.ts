import { NextResponse } from 'next/server'

import { getAdminContext } from '@/admin/auth'
import { rawD1 } from '@/features/ecommerce/server/db'
import { adminRequestRefusal } from '@/features/forms/origin'
import { audit, auditContext } from '@/features/security/auditLog'
import { MAX_RATE_RULES, parseRateRule, type RateRule } from '@/features/security/routeRules'
import * as store from '@/features/security/routeRulesStore'
import { readSecuritySettingsFromD1 } from '@/features/security/settings'

export const dynamic = 'force-dynamic'

const json = (body: unknown, status = 200): Response => NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } })

async function guard(request: Request, write: boolean) {
  if (write) {
    const refusal = adminRequestRefusal(request)
    if (refusal) return { response: json({ error: refusal }, 403) }
  }
  const context = await getAdminContext()
  if (!context.user) return { response: json({ error: 'Please sign in again.' }, 401) }
  if (!context.isAdmin) return { response: json({ error: 'Only an admin can manage rate limit rules.' }, 403) }
  return { context }
}

export async function GET(request: Request): Promise<Response> {
  const g = await guard(request, false)
  if (!g.context) return g.response
  const rules = await store.listRateRules((await rawD1()) as never as store.D1).catch((): RateRule[] => [])
  return json({ rules })
}

/** POST { action: 'add', pathPrefix, method, limit, windowSeconds, note } | { action: 'toggle', id, enabled } | { action: 'delete', id } */
export async function POST(request: Request): Promise<Response> {
  const g = await guard(request, true)
  if (!g.context) return g.response
  const body = (await request.json().catch((): null => null)) as Record<string, unknown> | null
  if (!body) return json({ error: 'Invalid request.' }, 400)
  const d1 = (await rawD1()) as never as store.D1
  const settings = await readSecuritySettingsFromD1()
  const ctx = auditContext(request)
  const now = new Date().toISOString()

  if (body.action === 'add') {
    const parsed = parseRateRule(body)
    if (parsed.ok === false) return json({ error: parsed.error }, 400)
    const existing = await store.listRateRules(d1).catch((): RateRule[] => [])
    if (existing.length >= MAX_RATE_RULES) return json({ error: `At most ${MAX_RATE_RULES} rules.` }, 400)
    await store.addRateRule(d1, parsed.rule, now)
    store.resetRateRulesCache()
    void audit({ action: 'rate-rule', detail: `add ${parsed.rule.method} ${parsed.rule.pathPrefix} ${parsed.rule.limit}/${parsed.rule.windowSeconds}s`, ...ctx }, settings)
    return json({ ok: true })
  }
  const id = Math.floor(Number(body.id))
  if (!Number.isFinite(id) || id < 1) return json({ error: 'Unknown rule.' }, 400)
  if (body.action === 'toggle') {
    await store.setRateRuleEnabled(d1, id, body.enabled !== false)
    store.resetRateRulesCache()
    void audit({ action: 'rate-rule', detail: `${body.enabled !== false ? 'enable' : 'disable'} rule ${id}`, ...ctx }, settings)
    return json({ ok: true })
  }
  if (body.action === 'delete') {
    await store.deleteRateRule(d1, id)
    store.resetRateRulesCache()
    void audit({ action: 'rate-rule', detail: `delete rule ${id}`, ...ctx }, settings)
    return json({ ok: true })
  }
  return json({ error: 'Unknown action.' }, 400)
}
