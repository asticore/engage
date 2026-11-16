import { NextResponse } from 'next/server'

import { getAdminContext } from '@/admin/auth'
import { DEMO_EXPORT_OPTIONS, RESET_CHOICES, cleanBanner, toResetEvery } from '@/features/demos/core'
import { createDemoAccount, resetFromSnapshot, takeSnapshot } from '@/features/demos/service'
import * as store from '@/features/demos/store'
import { rawD1 } from '@/features/ecommerce/server/db'
import { adminRequestRefusal } from '@/features/forms/origin'
import { renderExport } from '@/features/settingsTransfer/export'
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
  if (!context.isAdmin) return { response: json({ error: 'Only an admin can manage demos.' }, 403) }
  if (!(await getFeatureFlags()).demos) return { response: json({ error: 'Switch Agency demos on in Site Settings first.' }, 409) }
  return { context }
}

/** GET: settings and the saved copy. GET ?download=package: the importable package file. */
export async function GET(request: Request): Promise<Response> {
  const g = await guard(request, false)
  if (!g.context) return g.response
  if (new URL(request.url).searchParams.get('download') === 'package') {
    const { body, filename } = await renderExport(g.context.engine, DEMO_EXPORT_OPTIONS)
    return new Response(body, { headers: { 'Content-Type': 'application/json; charset=utf-8', 'Content-Disposition': `attachment; filename="${filename.replace('export', 'demo-package')}"`, 'Cache-Control': 'no-store' } })
  }
  const d1 = (await rawD1()) as never as store.D1
  const [settings, snapshot] = await Promise.all([store.getSettings(d1), store.snapshotInfo(d1)])
  return json({ settings, snapshot, choices: RESET_CHOICES })
}

/** POST { action: 'settings', resetEvery, banner } | { action: 'snapshot' } | { action: 'reset' } | { action: 'account', email } */
export async function POST(request: Request): Promise<Response> {
  const g = await guard(request, true)
  if (!g.context) return g.response
  const body = (await request.json().catch((): null => null)) as Record<string, unknown> | null
  if (!body) return json({ error: 'Invalid request.' }, 400)
  const d1 = (await rawD1()) as never as store.D1
  const now = new Date()

  if (body.action === 'settings') {
    await store.saveSettings(d1, { resetEvery: toResetEvery(body.resetEvery), banner: cleanBanner(body.banner) }, now.toISOString())
    return json({ ok: true })
  }
  if (body.action === 'snapshot') {
    const result = await takeSnapshot(g.context.engine, d1, now)
    return 'error' in result ? json({ error: result.error }, 400) : json({ ok: true, size: result.size })
  }
  if (body.action === 'reset') {
    const result = await resetFromSnapshot(g.context.engine, d1, now)
    return result.ok ? json({ ok: true, message: result.message }) : json({ error: result.message }, 400)
  }
  if (body.action === 'account') {
    const host = new URL(request.url).hostname
    const result = await createDemoAccount(g.context.engine, typeof body.email === 'string' ? body.email : '', host)
    return 'error' in result ? json({ error: result.error }, 400) : json({ ok: true, password: result.password })
  }
  return json({ error: 'Unknown action.' }, 400)
}
