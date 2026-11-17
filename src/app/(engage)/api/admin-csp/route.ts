import { NextResponse } from 'next/server'

import { getAdminContext } from '@/admin/auth'
import { adminRequestRefusal } from '@/features/forms/origin'
import { audit, auditContext } from '@/features/security/auditLog'
import { addSource, builderPolicyText, builderWarnings, normaliseConfig, suggestionFor, validateBuilder } from '@/features/security/cspBuilder'
import * as store from '@/features/security/cspBuilderStore'
import { DEFAULT_CONTENT_SECURITY_POLICY } from '@/features/security/headers'
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
  if (!context.isAdmin) return { response: json({ error: 'Only an admin can change the Content-Security-Policy.' }, 403) }
  return { context }
}

/** GET: the builder config and the violation log. */
export async function GET(request: Request): Promise<Response> {
  const g = await guard(request, false)
  if (!g.context) return g.response
  const d1 = (await rawD1()) as never as store.D1
  const [config, violations] = await Promise.all([store.readConfig(d1).catch(() => normaliseConfig({})), store.listViolations(d1).catch((): store.StoredViolation[] => [])])
  return json({ config, defaultPolicy: DEFAULT_CONTENT_SECURITY_POLICY, violations: violations.map((v) => ({ ...v, suggestion: suggestionFor(v) })) })
}

/** POST { action: 'save', config } | { action: 'allow', id } | { action: 'dismiss', ids | 'all' } */
export async function POST(request: Request): Promise<Response> {
  const g = await guard(request, true)
  if (!g.context) return g.response
  const body = (await request.json().catch((): null => null)) as Record<string, unknown> | null
  if (!body) return json({ error: 'Invalid request.' }, 400)
  const d1 = (await rawD1()) as never as store.D1
  const now = new Date().toISOString()
  const settings = await readSecuritySettingsFromD1()
  const ctx = auditContext(request)

  if (body.action === 'save') {
    const config = normaliseConfig(body.config)
    const problem = validateBuilder(config)
    if (problem) return json({ error: problem }, 400)
    await store.saveConfig(d1, config, now)
    store.resetCspBuilderCache()
    void audit({ action: 'csp.builder', detail: `mode ${config.mode}; ${Object.keys(config.directives).length} directives`, ...ctx }, settings)
    return json({ ok: true, config, policy: builderPolicyText(config), warnings: builderWarnings(config) })
  }

  if (body.action === 'allow') {
    const id = Math.floor(Number(body.id))
    const violation = (await store.listViolations(d1)).find((v) => v.id === id)
    if (!violation) return json({ error: 'That report is gone. Reload the list.' }, 404)
    const suggestion = suggestionFor(violation)
    if (!suggestion) return json({ error: 'No host can fix this one (inline code or a directive the builder does not offer).' }, 400)
    const config = addSource(await store.readConfig(d1), suggestion.directive, suggestion.source)
    const problem = validateBuilder(config)
    if (problem) return json({ error: problem }, 400)
    await store.saveConfig(d1, config, now)
    await store.deleteViolations(d1, [id])
    store.resetCspBuilderCache()
    void audit({ action: 'csp.builder', detail: `allowed ${suggestion.source} in ${suggestion.directive}`, ...ctx }, settings)
    return json({ ok: true, config })
  }

  if (body.action === 'dismiss') {
    const ids = body.ids === 'all' ? 'all' : Array.isArray(body.ids) ? body.ids.map((n) => Math.floor(Number(n))).filter((n) => Number.isFinite(n) && n > 0) : []
    await store.deleteViolations(d1, ids)
    return json({ ok: true })
  }

  return json({ error: 'Unknown action.' }, 400)
}
