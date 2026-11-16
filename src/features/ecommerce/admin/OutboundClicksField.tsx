'use client'

import React, { useEffect, useState } from 'react'

import { useDocumentInfo } from '@/engine/ui'

type Report = { days: number; total: number; rows: Array<{ source: string; clicks: number }> }

/** Read-only click report under the external product address: clicks in the last 30 days, per source. */
export function OutboundClicksField() {
  const info = useDocumentInfo() as { id?: number | string }
  const [report, setReport] = useState<Report | null>(null)
  useEffect((): void => {
    if (!info?.id) return
    void fetch(`/api/admin-outbound-clicks?product=${info.id}&days=30`, { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : null))
      .then((body) => setReport(body as Report | null))
      .catch((): void => undefined)
  }, [info?.id])
  if (!info?.id) return <p style={{ opacity: 0.7 }}>Save the product to start counting clicks.</p>
  if (!report) return null
  return (
    <div style={{ margin: '0.5rem 0' }}>
      <strong>Outbound clicks, last {report.days} days: {report.total}</strong>
      {report.rows.length > 0 ? (
        <ul style={{ margin: '0.25rem 0 0', paddingLeft: '1.2rem' }}>
          {report.rows.map((r) => (
            <li key={r.source}>
              {r.source}: {r.clicks}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
