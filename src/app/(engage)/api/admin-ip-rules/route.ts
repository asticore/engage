import { NextResponse } from 'next/server'

import { getAdminContext } from '@/admin/auth'
import { adminRequestRefusal } from '@/features/forms/origin'
import { audit, auditContext } from '@/features/security/auditLog'
import { decideCountry, decideIp, MAX_RULES, parseBulk, parseCountries, type IpRule, type IpRuleKind } from '@/features/security/ipRules'
import * as store from '@/features/security/ipRulesStore'
import { clientKey } from '@/features/security/rateLimit'
import { readSecuritySettingsFromD1 } from '@/features/security/settings'
import { rawD1 } from '@/features/ecommerce/server/db'

export const dynamic = 'force-dynamic'

const json = (body: unknown, status = 200): Response => NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } })

async function guard(request: Request, write: boolean) {
  if (write) {
    const refusal = adminRequestRefusal(request)
    if (refusal) return { response: json({ error: refusal }, 403) }
  }
  const context = await getAdminContext()
  if (!context.user) return { response: json({ error: 'Please sign in again.' }, 401) }
  if (!context.isAdmin) return { response: json({ error: 'Only an admin can manage the IP lists.' }, 403) }
  return { context }
}

const csvCell = (v: string): string => `"${v.replace(/"/g, '""')}"`

/** GET: every rule, plus your own address. GET ?format=csv downloads them. */
export async function GET(request: Request): Promise<Response> {
  const g = await guard(request, false)
  if (!g.context) return g.response
  const rules = await store.listRules((await rawD1()) as never as store.D1).catch((): IpRule[] => [])
  if (new URL(request.url).searchParams.get('format') === 'csv') {
    const lines = ['kind,entry,reason,expires_at,created_at', ...rules.map((r) => [r.kind, r.entry, r.reason, r.expiresAt ?? '', r.createdAt].map(csvCell).join(','))]
    return new Response(lines.join('\n'), { headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': 'attachment; filename="ip-rules.csv"', 'Cache-Control': 'no-store' } })
  }
  return json({ rules, yourAddress: clientKey(request), yourCountry: request.headers.get('cf-ipcountry') ?? '' })
}

/** POST { action: 'add', kind, entries (text), reason?, expiresAt? } | { action: 'delete', ids } */
export async function POST(request: Request): Promise<Response> {
  const g = await guard(request, true)
  if (!g.context) return g.response
  const body = (await request.json().catch((): null => null)) as Record<string, unknown> | null
  if (!body) return json({ error: 'Invalid request.' }, 400)
  const d1 = (await rawD1()) as never as store.D1
  const now = new Date().toISOString()
  const settings = await readSecuritySettingsFromD1()
  const ctx = auditContext(request)

  if (body.action === 'add') {
    const kind: IpRuleKind = body.kind === 'allow' ? 'allow' : 'block'
    const parsed = parseBulk(typeof body.entries === 'string' ? body.entries.slice(0, 20000) : '')
    if (parsed.entries.length === 0) return json({ error: parsed.rejected.length ? `Not a valid address or range: ${parsed.rejected.join(', ')}` : 'Enter at least one address.' }, 400)
    const existing = await store.listRules(d1).catch((): IpRule[] => [])
    if (existing.length + parsed.entries.length > MAX_RULES) return json({ error: `The lists can hold at most ${MAX_RULES} entries.` }, 400)
    if (kind === 'block') {
      // Lockout guard: never let the saving admin block their own address.
      const me = clientKey(request)
      const test = parsed.entries.map((entry, i) => ({ id: i, kind: 'block' as const, entry, reason: '', expiresAt: null as string | null, createdAt: '' }))
      const allowed = existing.filter((r) => r.kind === 'allow')
      if (decideIp(me, [...allowed, ...test]) === 'block') return json({ error: 'That would block your own address. Add your address to the allow list first.' }, 400)
    }
    const reason = typeof body.reason === 'string' ? body.reason.trim().slice(0, 200) : ''
    const expiresAt = typeof body.expiresAt === 'string' && !Number.isNaN(Date.parse(body.expiresAt)) ? new Date(body.expiresAt).toISOString() : null
    for (const entry of parsed.entries) await store.addRule(d1, { kind, entry, reason, expiresAt }, now)
    store.resetIpRulesCache()
    void audit({ action: 'ip.rule', detail: `${kind} ${parsed.entries.length} added`, ...ctx }, settings)
    return json({ ok: true, added: parsed.entries.length, rejected: parsed.rejected })
  }
  if (body.action === 'countries') {
    const mode = body.mode === 'allow' ? 'country-allow' : body.mode === 'block' ? 'country-block' : null
    const parsed = parseCountries(typeof body.countries === 'string' ? body.countries.slice(0, 2000) : '')
    if (mode && parsed.codes.length === 0) return json({ error: parsed.rejected.length ? `Not a country code: ${parsed.rejected.join(', ')}. Use two letters such as AU or US (XX is an unknown country).` : 'Enter at least one country code.' }, 400)
    if (mode) {
      // Lockout guard: the saving admin must still get in from where they are, unless their address is on the allow list.
      const existing = await store.listRules(d1).catch((): IpRule[] => [])
      const test: IpRule[] = parsed.codes.map((entry, i) => ({ id: i, kind: mode, entry, reason: '', expiresAt: null as string | null, createdAt: '' }))
      const byIp = decideIp(clientKey(request), existing)
      if (byIp !== 'allow' && decideCountry(request.headers.get('cf-ipcountry'), test) === 'block') return json({ error: 'That would block your own country. Add your address to the IP allow list first.' }, 400)
    }
    await store.setCountries(d1, mode, parsed.codes, now)
    store.resetIpRulesCache()
    void audit({ action: 'ip.rule', detail: mode ? `${mode} ${parsed.codes.length} countries` : 'countries cleared', ...ctx }, settings)
    return json({ ok: true })
  }
  if (body.action === 'delete') {
    const ids = Array.isArray(body.ids) ? body.ids.map((n) => Math.floor(Number(n))).filter((n) => Number.isFinite(n) && n > 0) : []
    await store.deleteRules(d1, ids)
    store.resetIpRulesCache()
    void audit({ action: 'ip.rule', detail: `${ids.length} removed`, ...ctx }, settings)
    return json({ ok: true })
  }
  return json({ error: 'Unknown action.' }, 400)
}
