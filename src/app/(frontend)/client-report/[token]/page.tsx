import { notFound } from 'next/navigation'
import React from 'react'

import { isToken } from '@/features/affiliates/core'
import { reportTables, summaryLines, withViewerRange } from '@/features/clientReports/core'
import { buildReport } from '@/features/clientReports/service'
import { findByToken, type D1 } from '@/features/clientReports/store'
import { rawD1 } from '@/features/ecommerce/server/db'
import { getEngine } from '@/lib/engine'
import { getFeatureFlags } from '@/utilities/features'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Report', robots: { index: false, follow: false } }

const one = (v: string | string[] | undefined): string => (Array.isArray(v) ? (v[0] ?? '') : (v ?? ''))

/** The read-only client report behind a private link. Shows numbers only: no sign-in, no editing, no personal data. The viewer can pick other dates. */
export default async function ClientReportPage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  if (!(await getFeatureFlags()).clientreports) notFound()
  const { token } = await params
  if (!isToken(token)) notFound()
  const query = await searchParams
  const d1 = (await rawD1()) as never as D1
  const report = await findByToken(d1, token)
  if (!report) notFound()
  const spec = withViewerRange(report, one(query.from), one(query.to))
  const data = await buildReport(await getEngine(), d1 as never, spec, new Date())
  const dates = `from=${data.range.from}&to=${data.range.to}`
  return (
    <div className="page-shell">
      <main className="container">
        <h1>{report.name}</h1>
        <form method="get" style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'end', marginBottom: '1rem' }}>
          <label>From<br /><input type="date" name="from" defaultValue={data.range.from} required /></label>
          <label>To<br /><input type="date" name="to" defaultValue={data.range.to} required /></label>
          <button type="submit">Show these dates</button>
        </form>
        <table>
          <tbody>
            {summaryLines(data).map((l) => (
              <tr key={l.label}>
                <th scope="row" style={{ textAlign: 'left' }}>{l.label}</th>
                <td>{l.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {reportTables(data).map((t) => (
          <section key={t.title}>
            <h2>{t.title}</h2>
            <table>
              <thead>
                <tr>{t.head.map((h) => <th key={h} scope="col" style={{ textAlign: 'left' }}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {t.rows.map((r, i) => (
                  <tr key={i}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>
                ))}
              </tbody>
            </table>
          </section>
        ))}
        <p><a href={`/api/client-report?token=${token}&${dates}`}>Download as CSV</a></p>
      </main>
    </div>
  )
}
