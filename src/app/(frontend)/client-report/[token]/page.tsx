import { notFound } from 'next/navigation'
import React from 'react'

import { isToken } from '@/features/affiliates/core'
import { summaryLines } from '@/features/clientReports/core'
import { buildReport } from '@/features/clientReports/service'
import { findByToken, type D1 } from '@/features/clientReports/store'
import { rawD1 } from '@/features/ecommerce/server/db'
import { getEngine } from '@/lib/engine'
import { getFeatureFlags } from '@/utilities/features'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Report', robots: { index: false, follow: false } }

/** The read-only client report behind a private link. Shows numbers only: no sign-in, no editing, no personal data. */
export default async function ClientReportPage({ params }: { params: Promise<{ token: string }> }) {
  if (!(await getFeatureFlags()).clientreports) notFound()
  const { token } = await params
  if (!isToken(token)) notFound()
  const d1 = (await rawD1()) as never as D1
  const report = await findByToken(d1, token)
  if (!report) notFound()
  const data = await buildReport(await getEngine(), d1 as never, report.preset, new Date())
  return (
    <div className="page-shell">
      <main className="container">
        <h1>{report.name}</h1>
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
        <p><a href={`/api/client-report?token=${token}`}>Download as CSV</a></p>
      </main>
    </div>
  )
}
