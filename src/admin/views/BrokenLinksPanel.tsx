'use client'

import React, { useState } from 'react'

import type { CollectedLink } from '@/features/seo/linkCheck'
import { summariseLinks, type LinkResult } from '@/features/seo/linkCheckSummary'

type Row = CollectedLink & { result?: LinkResult }

/** Checks every link in the published content and lists the broken ones with the pages that hold them. */
export function BrokenLinksPanel(): React.ReactElement {
  const [rows, setRows] = useState<Row[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState('')
  const [message, setMessage] = useState('')
  const [fixes, setFixes] = useState<Record<string, string>>({})

  const run = async () => {
    setBusy(true)
    setMessage('')
    try {
      const res = await fetch('/api/admin-seo-links', { cache: 'no-store' })
      if (!res.ok) throw new Error('load')
      const data = (await res.json()) as { links: CollectedLink[]; batchSize: number }
      const all: Row[] = data.links.map((l) => ({ ...l }))
      setRows(all)
      for (let i = 0; i < all.length; i += data.batchSize) {
        setProgress(`Checked ${Math.min(i, all.length)} of ${all.length}`)
        const batch = all.slice(i, i + data.batchSize)
        const r = await fetch('/api/admin-seo-links', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ urls: batch.map((b) => b.href) }) })
        if (!r.ok) throw new Error('check')
        const { results } = (await r.json()) as { results: LinkResult[] }
        results.forEach((result, k) => { all[i + k].result = result })
        setRows([...all])
      }
      setProgress(`Checked ${all.length} of ${all.length}`)
    } catch {
      setMessage('The check could not finish. Try again.')
    } finally {
      setBusy(false)
    }
  }

  const addRedirect = async (row: Row) => {
    const toPath = (fixes[row.href] ?? '').trim()
    const res = await fetch('/api/admin-seo-links', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ fromPath: row.href, toPath }) })
    const data = (await res.json().catch(() => ({}))) as { error?: string }
    setMessage(res.ok ? `Redirect added from ${row.href}.` : data.error ?? 'The redirect could not be added.')
  }

  const results = (rows ?? []).filter((r) => r.result).map((r) => r.result as LinkResult)
  const summary = summariseLinks(results)
  const broken = (rows ?? []).filter((r) => r.result?.verdict === 'broken')
  const unsure = (rows ?? []).filter((r) => r.result && (r.result.verdict === 'unknown' || r.result.verdict === 'blocked'))

  return (
    <section className="sa-results" aria-label="Broken links">
      <h2 className="sa-results__heading">Broken links</h2>
      <p className="sa-muted">Checks every link in published pages, posts, products and events, on this site and to other sites. Links to other sites that refuse the check are listed as unsure, not broken.</p>
      <div className="sa-savebar">
        <button type="button" onClick={run} disabled={busy}>{busy ? 'Checking...' : rows ? 'Check again' : 'Check links'}</button>
        {progress && <span role="status">{progress}</span>}
        {message && <span role="status">{message}</span>}
      </div>
      {rows && (
        <p>{summary.checked} checked, {summary.broken} broken, {summary.redirects} redirecting, {summary.unknown} unsure.</p>
      )}
      {broken.length > 0 && (
        <table className="sa-table">
          <thead><tr><th scope="col">Link</th><th scope="col">Result</th><th scope="col">Found on</th><th scope="col">Fix</th></tr></thead>
          <tbody>
            {broken.map((row) => (
              <tr key={row.href}>
                <td>{row.href}</td>
                <td>{row.result?.status}</td>
                <td>{row.sources.map((s) => s.title).join(', ')}</td>
                <td>
                  {row.internal ? (
                    <>
                      <label>New address <input type="text" value={fixes[row.href] ?? ''} placeholder="/new-page" onChange={(e) => setFixes({ ...fixes, [row.href]: e.target.value })} /></label>
                      <button type="button" onClick={() => addRedirect(row)} disabled={!(fixes[row.href] ?? '').trim()}>Add redirect</button>
                    </>
                  ) : 'Edit the page to change or remove the link.'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {rows && !busy && broken.length === 0 && summary.checked > 0 && <p>No broken links found.</p>}
      {unsure.length > 0 && (
        <details>
          <summary>{unsure.length} unsure</summary>
          <ul>{unsure.map((r) => <li key={r.href}>{r.href} ({r.result?.status || 'no answer'})</li>)}</ul>
        </details>
      )}
    </section>
  )
}
