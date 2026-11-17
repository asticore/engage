import { NextResponse } from 'next/server'

import { isToken } from '@/features/affiliates/core'
import { reportCsv, withViewerRange } from '@/features/clientReports/core'
import { buildReport } from '@/features/clientReports/service'
import * as store from '@/features/clientReports/store'
import { rawD1 } from '@/features/ecommerce/server/db'
import { getEngine } from '@/lib/engine'
import { getFeatureFlags } from '@/utilities/features'

export const dynamic = 'force-dynamic'

/** Public, read-only: GET ?token=<link token> returns the report numbers as CSV. A revoked or unknown link answers 404. */
export async function GET(request: Request): Promise<Response> {
  const notFound = () => NextResponse.json({ error: 'Not found.' }, { status: 404, headers: { 'Cache-Control': 'no-store' } })
  if (!(await getFeatureFlags()).clientreports) return notFound()
  const params = new URL(request.url).searchParams
  const token = params.get('token')
  if (!isToken(token)) return notFound()
  const d1 = (await rawD1()) as never as store.D1
  const report = await store.findByToken(d1, token)
  if (!report) return notFound()
  const data = await buildReport(await getEngine(), d1 as never, withViewerRange(report, params.get('from'), params.get('to')), new Date())
  return new Response(reportCsv(data), { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="report.csv"', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' } })
}
