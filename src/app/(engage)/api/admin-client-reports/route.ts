import { NextResponse } from 'next/server'

import { getAdminContext } from '@/admin/auth'
import { newToken } from '@/features/affiliates/core'
import { CADENCES, MAX_NAME, MAX_RECIPIENTS, MAX_REPORTS, PRESETS, parseRecipients, reportCsv, toCadence, toPreset } from '@/features/clientReports/core'
import { buildReport, reportLink, sendReport } from '@/features/clientReports/service'
import * as store from '@/features/clientReports/store'
import { rawD1 } from '@/features/ecommerce/server/db'
import { adminRequestRefusal } from '@/features/forms/origin'
import { requestSiteOrigin } from '@/utilities/siteOrigin'
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
  if (!context.isAdmin) return { response: json({ error: 'Only an admin can manage client reports.' }, 403) }
  if (!(await getFeatureFlags()).clientreports) return { response: json({ error: 'Switch Client reports on in Site Settings first.' }, 409) }
  return { context }
}

const text = (v: unknown, max: number): string => (typeof v === 'string' ? v.trim().slice(0, max) : '')

/** GET: every report with its share link. GET ?csv=<id> downloads that report's numbers as CSV. */
export async function GET(request: Request): Promise<Response> {
  const g = await guard(request, false)
  if (!g.context) return g.response
  const d1 = (await rawD1()) as never as store.D1
  const csvId = Number(new URL(request.url).searchParams.get('csv'))
  if (csvId) {
    const report = await store.findById(d1, csvId)
    if (!report) return json({ error: 'Report not found.' }, 404)
    const data = await buildReport(g.context.engine, d1 as never, report.preset, new Date())
    return new Response(reportCsv(data), { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="client-report-${report.id}.csv"`, 'Cache-Control': 'no-store' } })
  }
  const origin = await requestSiteOrigin()
  const reports = (await store.listReports(d1)).map((r) => ({ ...r, link: reportLink(origin, r.token) }))
  return json({ reports, presets: PRESETS, cadences: CADENCES, maxRecipients: MAX_RECIPIENTS })
}

/** POST { action: 'create' | 'update' | 'revoke' | 'restore' | 'rotate' | 'delete' | 'send', id?, name?, preset?, recipients?, cadence? } */
export async function POST(request: Request): Promise<Response> {
  const g = await guard(request, true)
  if (!g.context) return g.response
  const body = (await request.json().catch((): null => null)) as Record<string, unknown> | null
  if (!body) return json({ error: 'Invalid request.' }, 400)
  const d1 = (await rawD1()) as never as store.D1
  const now = new Date()
  const iso = now.toISOString()
  const id = Number(body.id)

  if (body.action === 'create') {
    const name = text(body.name, MAX_NAME)
    if (!name) return json({ error: 'Give the report a name, such as the client name.' }, 400)
    if ((await store.countReports(d1)) >= MAX_REPORTS) return json({ error: `A site can have at most ${MAX_REPORTS} reports.` }, 400)
    const newId = await store.createReport(d1, { name, token: newToken(), preset: toPreset(body.preset), recipients: parseRecipients(body.recipients).join(', '), cadence: toCadence(body.cadence) }, iso)
    return json({ ok: true, id: newId })
  }
  if (!Number.isFinite(id) || id <= 0) return json({ error: 'Unknown report.' }, 400)
  const report = await store.findById(d1, id)
  if (!report) return json({ error: 'Report not found.' }, 404)

  if (body.action === 'update') {
    const name = text(body.name, MAX_NAME) || report.name
    await store.updateReport(d1, id, { name, preset: toPreset(body.preset), recipients: parseRecipients(body.recipients).join(', '), cadence: toCadence(body.cadence) }, iso)
    return json({ ok: true })
  }
  if (body.action === 'revoke' || body.action === 'restore') {
    await store.setRevoked(d1, id, body.action === 'revoke', iso)
    return json({ ok: true })
  }
  if (body.action === 'rotate') {
    await store.rotateToken(d1, id, newToken(), iso)
    return json({ ok: true })
  }
  if (body.action === 'delete') {
    await store.deleteReport(d1, id)
    return json({ ok: true })
  }
  if (body.action === 'send') {
    const result = await sendReport(g.context.engine, d1, report, now, await requestSiteOrigin())
    return result.ok ? json({ ok: true, message: result.message }) : json({ error: result.message }, 400)
  }
  return json({ error: 'Unknown action.' }, 400)
}
