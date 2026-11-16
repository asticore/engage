import { NextResponse } from 'next/server'

import { getAdminContext } from '@/admin/auth'
import { rawD1 } from '@/features/ecommerce/server/db'
import { adminRequestRefusal } from '@/features/forms/origin'
import { LOCK_CHOICES, MAX_FRANCHISES, cleanHost, cleanName, toLockChoice, toStatus } from '@/features/franchising/core'
import { createOwnerAccount, describeRollout, rolloutTemplate } from '@/features/franchising/service'
import * as store from '@/features/franchising/store'
import { isEmail } from '@/features/demos/core'
import { getFeatureFlags } from '@/utilities/features'

export const dynamic = 'force-dynamic'

const json = (body: unknown, status = 200): Response => NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } })

async function guard(request: Request, write: boolean) {
  if (write) {
    const refusal = adminRequestRefusal(request)
    if (refusal) return { response: json({ error: refusal }, 403) }
  }
  const context = await getAdminContext()
  if (!context.user) return { response: json({ error: 'Please sign in again.' }, 401) }
  if (!context.isAdmin) return { response: json({ error: 'Only an admin can manage franchises.' }, 403) }
  if (!(await getFeatureFlags()).franchising) return { response: json({ error: 'Switch Franchising on in Site Settings first.' }, 409) }
  return { context }
}

const email = (v: unknown): string => (typeof v === 'string' && isEmail(v) ? v.trim().toLowerCase() : '')

/** GET: franchises with their page counts, the templates that can be rolled out, and the roll-up totals. */
export async function GET(request: Request): Promise<Response> {
  const g = await guard(request, false)
  if (!g.context) return g.response
  const d1 = (await rawD1()) as never as store.D1
  const [franchises, templates] = await Promise.all([
    store.listFranchises(d1),
    g.context.engine.find({ collection: 'page-templates', overrideAccess: true, limit: 200, depth: 0, sort: 'name' }),
  ])
  const rollup = { franchises: franchises.length, active: franchises.filter((f) => f.status === 'active').length, pages: franchises.reduce((n, f) => n + f.pages, 0) }
  return json({ franchises, rollup, templates: templates.docs.map((t) => ({ id: Number((t as { id: unknown }).id), name: String((t as { name?: unknown }).name ?? '') })), lockChoices: LOCK_CHOICES })
}

/** POST { action: 'create' | 'update' | 'delete' | 'owner' | 'rollout', ... } */
export async function POST(request: Request): Promise<Response> {
  const g = await guard(request, true)
  if (!g.context) return g.response
  const body = (await request.json().catch((): null => null)) as Record<string, unknown> | null
  if (!body) return json({ error: 'Invalid request.' }, 400)
  const d1 = (await rawD1()) as never as store.D1
  const now = new Date()
  const iso = now.toISOString()

  if (body.action === 'create') {
    const name = cleanName(body.name)
    if (!name) return json({ error: 'Give the franchise a name.' }, 400)
    const host = cleanHost(body.host)
    if ('error' in host) return json({ error: host.error }, 400)
    if ((await store.countFranchises(d1)) >= MAX_FRANCHISES) return json({ error: `A site can have at most ${MAX_FRANCHISES} franchises.` }, 400)
    if (await store.hostTaken(d1, host.host)) return json({ error: 'Another franchise already uses that domain.' }, 400)
    const id = await store.createFranchise(d1, { name, host: host.host, ownerEmail: email(body.ownerEmail) }, iso)
    return json({ ok: true, id, message: `Franchise added. Add ${host.host} under Settings, Domains so it answers there.` })
  }
  if (body.action === 'rollout') {
    const templateId = Number(body.templateId)
    if (!Number.isFinite(templateId) || templateId <= 0) return json({ error: 'Choose a template to roll out.' }, 400)
    const summary = await rolloutTemplate(g.context.engine, d1, templateId, toLockChoice(body.lock), now)
    return json({ ok: summary.failed === 0, message: describeRollout(summary), summary }, summary.failed === 0 ? 200 : 207)
  }
  const id = Number(body.id)
  const franchise = Number.isFinite(id) && id > 0 ? await store.findFranchise(d1, id) : null
  if (!franchise) return json({ error: 'Franchise not found.' }, 404)

  if (body.action === 'update') {
    await store.updateFranchise(d1, id, { name: cleanName(body.name) || franchise.name, ownerEmail: email(body.ownerEmail), status: toStatus(body.status) }, iso)
    return json({ ok: true })
  }
  if (body.action === 'delete') {
    await store.deleteFranchise(d1, id)
    return json({ ok: true, message: 'Franchise removed. Its pages stay on the site; delete them under Pages if you do not want them.' })
  }
  if (body.action === 'owner') {
    const result = await createOwnerAccount(g.context.engine, franchise)
    return 'error' in result ? json({ error: result.error }, 400) : json({ ok: true, password: result.password })
  }
  return json({ error: 'Unknown action.' }, 400)
}
