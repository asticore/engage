'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { CollapsibleCard } from '@/admin/components/CollapsibleCard'
import { adminCollectionPath } from '@/admin/adminPaths'
import { ISSUE_BY_ID, type IssueDef } from '@/features/seo/crawl/issues'
import type { PageRow, RunRow } from '@/features/seo/crawl/store'
import { COLUMNS, DEFAULT_COLUMNS, EMPTY_FILTER, deltaText, filterRows, indexabilityOf, issueCounts, sortRows, toCsv, type TableFilter } from '@/features/seo/crawl/table'
import './site-audit.css'

type Loaded = { runs: RunRow[]; pages: PageRow[]; previous: RunRow | null; schedule: 'off' | 'daily' | 'weekly'; issues: IssueDef[] }
type StepResult = { done: number; total: number; finished: boolean }

const KIND_LABEL = { seo: 'SEO', accessibility: 'Accessibility', technical: 'Technical' } as const
const SEVERITY_LABEL = { error: 'Error', warning: 'Warning', notice: 'Notice' } as const

const post = async <T,>(body: Record<string, unknown>): Promise<T> => {
  const response = await fetch('/api/admin-seo-crawl', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  const json = (await response.json().catch((): null => null)) as (T & { error?: string }) | null
  if (!response.ok || !json) throw new Error(json?.error || 'The request failed.')
  return json
}

function Tile({ label, value, delta, tone }: { label: string; value: string | number; delta?: string; tone?: 'error' | 'warning' | 'notice' | 'good' }) {
  return (
    <div className={`sx-tile${tone ? ` sx-tile--${tone}`.trim() : ''}`}>
      <div className="sx-tile__value">{value}</div>
      <div className="sx-tile__label">{label}</div>
      {delta ? <div className="sx-tile__delta">{delta} since the last crawl</div> : null}
    </div>
  )
}

function Detail({ row, onClose }: { row: PageRow; onClose: () => void }) {
  const idx = indexabilityOf(row)
  const editHref = row.collection && row.docId ? `${adminCollectionPath(row.collection)}/${row.docId}` : null
  return (
    <aside className="sx-detail" aria-label={`Details for ${row.path}`}>
      <div className="sx-detail__head">
        <h3>{row.path}</h3>
        <button type="button" onClick={onClose}>Close</button>
      </div>
      {editHref && <p><a href={editHref}>Open in the editor</a></p>}
      <dl className="sx-detail__values">
        {COLUMNS.map((c) => {
          const value = c.value(row)
          return value === null || value === '' ? null : (
            <React.Fragment key={c.id}>
              <dt>{c.label}</dt>
              <dd>{String(value)}</dd>
            </React.Fragment>
          )
        })}
        {!idx.indexable && <><dt>Why not indexable</dt><dd>{idx.reason}</dd></>}
      </dl>
      <h4>Checks failed ({row.issues.length})</h4>
      {row.issues.length === 0 ? <p>None. This page passes every check.</p> : (
        <ul className="sx-issues">
          {row.issues.map((id) => {
            const def = ISSUE_BY_ID[id]
            return (
              <li key={id}>
                <span className={`sx-chip sx-chip--${def?.severity ?? 'notice'}`}>{SEVERITY_LABEL[def?.severity ?? 'notice']}</span>{' '}
                <span className="sx-chip sx-chip--kind">{KIND_LABEL[def?.kind ?? 'seo']}</span> <strong>{def?.label ?? id}</strong>
                <div className="sx-hint">{def?.hint}</div>
              </li>
            )
          })}
        </ul>
      )}
    </aside>
  )
}

/**
 * The site audit (Task 6, item 16o): a crawl of this site's own pages with a health score, issue cards and a table of
 * every page, in the style of the Screaming Frog Internal tab and the Semrush Site Audit. Core on-page and technical
 * checks only; there are no impressions, clicks or rankings here.
 */
export function SiteAuditPanel() {
  const [data, setData] = useState<Loaded | null>(null)
  const [denied, setDenied] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [filter, setFilter] = useState<TableFilter>(EMPTY_FILTER)
  const [columns, setColumns] = useState<string[]>([...DEFAULT_COLUMNS])
  const [sort, setSort] = useState<{ id: string; desc: boolean }>({ id: 'issues', desc: true })
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [detail, setDetail] = useState<PageRow | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [redirectTo, setRedirectTo] = useState('')
  const running = useRef(false)

  const loadRef = useRef<() => Promise<void>>(async () => undefined)

  const crawl = useCallback(async (runId: number) => {
    running.current = true
    try {
      for (let guard = 0; guard < 500; guard++) {
        const step = await post<StepResult>({ action: 'step', runId })
        setProgress({ done: step.done, total: step.total })
        if (step.finished) break
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The crawl stopped.')
    } finally {
      running.current = false
      setProgress(null)
      await loadRef.current()
    }
  }, [])

  const load = useCallback(async () => {
    try {
      const response = await fetch('/api/admin-seo-crawl')
      if (response.status === 401) return setDenied(true)
      const json = (await response.json().catch((): null => null)) as Loaded | null
      if (!response.ok || !json) throw new Error('Could not load the site audit.')
      setData(json)
      // A crawl left running (the tab was closed) carries on from where it stopped.
      if (json.runs[0]?.status === 'running' && !running.current) void crawl(json.runs[0].id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load the site audit.')
    }
  }, [crawl])

  useEffect(() => {
    loadRef.current = load
  }, [load])

  useEffect(() => {
    void load()
  }, [load])

  const start = async () => {
    setError(null)
    setNotice(null)
    try {
      const { runId, total } = await post<{ runId: number; total: number }>({ action: 'start' })
      setProgress({ done: 0, total })
      void crawl(runId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start the crawl.')
    }
  }

  const pages = useMemo(() => data?.pages ?? [], [data])
  const done = useMemo(() => pages.filter((p) => p.state === 'done'), [pages])
  const visible = useMemo(() => sortRows(filterRows(pages, filter), sort.id, sort.desc), [pages, filter, sort])
  const cards = useMemo(() => issueCounts(done), [done])
  const run = data?.runs[0] ?? null
  const previous = data?.previous ?? null

  if (denied) return null
  const selectedRows = visible.filter((r) => selected.has(r.id))

  const bulk = async (action: 'noindex' | 'redirect') => {
    setNotice(null)
    try {
      if (action === 'noindex') {
        const rows = selectedRows.filter((r) => r.collection && r.docId).map((r) => ({ collection: r.collection, id: r.docId }))
        if (rows.length === 0) return setNotice('None of the selected rows is a page, post, product or event that can be changed here.')
        const { results } = await post<{ results: { ok: boolean }[] }>({ action: 'noindex', rows })
        setNotice(`Marked ${results.filter((r) => r.ok).length} of ${results.length} as noindex. Run the crawl again to see the change.`)
      } else {
        const { results } = await post<{ results: { ok: boolean; error?: string }[] }>({ action: 'redirect', to: redirectTo, rows: selectedRows.map((r) => ({ from: r.path })) })
        setNotice(`Added ${results.filter((r) => r.ok).length} of ${results.length} redirects.`)
      }
    } catch (err) {
      setNotice(err instanceof Error ? err.message : 'The action failed.')
    }
  }

  const download = () => {
    const csv = toCsv(selectedRows.length > 0 ? selectedRows : visible, columns)
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url
    link.download = 'site-audit.csv'
    link.click()
    URL.revokeObjectURL(url)
  }

  const shownColumns = COLUMNS.filter((c) => columns.includes(c.id))

  return (
    <CollapsibleCard id="seo-site-audit" title="Site audit" className="sx">
      <p className="sx-muted">
        Crawls this site&apos;s own pages (the sitemap and every published page) and checks each for core on-page, technical and accessibility problems. It does not show Search Console data such as impressions, clicks or rankings.
      </p>
      <div className="sx-bar">
        <button type="button" className="btn" onClick={() => void start()} disabled={progress !== null}>{progress ? 'Crawling...' : run ? 'Crawl again' : 'Run the first crawl'}</button>
        <label>
          <span className="sx-muted">Scheduled crawl </span>
          <select
            value={data?.schedule ?? 'off'}
            onChange={async (event) => {
              const schedule = event.target.value as 'off' | 'daily' | 'weekly'
              try {
                await post({ action: 'schedule', schedule })
                setData((d) => (d ? { ...d, schedule } : d))
              } catch (err) {
                setError(err instanceof Error ? err.message : 'Could not save.')
              }
            }}
          >
            <option value="off">Off</option>
            <option value="daily">Every day</option>
            <option value="weekly">Every week</option>
          </select>
        </label>
        {progress && <span role="status">Checked {progress.done} of {progress.total} pages...</span>}
        {run?.finishedAt && !progress && <span className="sx-muted">Last crawl {new Date(run.finishedAt).toLocaleString()} ({run.source === 'schedule' ? 'scheduled' : 'manual'})</span>}
      </div>
      {error && <p className="sx-error" role="alert">{error}</p>}
      {!data && !error && <p className="sx-muted">Loading...</p>}

      {run && run.status === 'done' && (
        <>
          <div className="sx-tiles">
            <Tile label="Site health" value={`${run.health ?? 0}%`} delta={deltaText(run.health ?? 0, previous?.health)} tone={(run.health ?? 0) >= 90 ? 'good' : (run.health ?? 0) >= 60 ? 'warning' : 'error'} />
            <Tile label="Errors" value={run.errors} delta={deltaText(run.errors, previous?.errors)} tone="error" />
            <Tile label="Warnings" value={run.warnings} delta={deltaText(run.warnings, previous?.warnings)} tone="warning" />
            <Tile label="Notices" value={run.notices} delta={deltaText(run.notices, previous?.notices)} tone="notice" />
            <Tile label="Pages crawled" value={run.total} delta={deltaText(run.total, previous?.total)} />
          </div>

          <h3 className="sx-h">Issues found (click one to filter the table)</h3>
          <div className="sx-cards">
            {cards.length === 0 && <p className="sx-muted">No issues found.</p>}
            {cards.map((card) => {
              const def = ISSUE_BY_ID[card.id]
              return (
                <button key={card.id} type="button" className={`sx-card sx-card--${def?.severity ?? 'notice'}`} aria-pressed={filter.issue === card.id} onClick={() => setFilter({ ...filter, issue: filter.issue === card.id ? null : card.id })}>
                  <span className="sx-card__count">{card.count}</span>
                  <span className="sx-card__label">{def?.label ?? card.id}</span>
                  <span className="sx-card__kind">{KIND_LABEL[def?.kind ?? 'seo']}</span>
                </button>
              )
            })}
          </div>

          <div className="sx-filters">
            <input type="search" placeholder="Search address, title or description" aria-label="Search the table" value={filter.search} onChange={(event) => setFilter({ ...filter, search: event.target.value })} />
            <select aria-label="Type" value={filter.type} onChange={(event) => setFilter({ ...filter, type: event.target.value })}>
              <option value="all">All types</option>
              <option value="pages">Pages</option>
              <option value="posts">Posts</option>
              <option value="products">Products</option>
              <option value="events">Events</option>
              <option value="other">Other</option>
            </select>
            <select aria-label="Severity" value={filter.severity} onChange={(event) => setFilter({ ...filter, severity: event.target.value as TableFilter['severity'] })}>
              <option value="all">Any severity</option>
              <option value="error">Errors</option>
              <option value="warning">Warnings</option>
              <option value="notice">Notices</option>
            </select>
            <select aria-label="Indexable" value={filter.indexable} onChange={(event) => setFilter({ ...filter, indexable: event.target.value as TableFilter['indexable'] })}>
              <option value="all">Indexable or not</option>
              <option value="yes">Indexable</option>
              <option value="no">Not indexable</option>
            </select>
            {(filter.issue || filter.search || filter.type !== 'all' || filter.severity !== 'all' || filter.indexable !== 'all') && <button type="button" onClick={() => setFilter(EMPTY_FILTER)}>Clear filters</button>}
            <details className="sx-columns">
              <summary>Columns</summary>
              <div className="sx-columns__list">
                {COLUMNS.map((c) => (
                  <label key={c.id}>
                    <input type="checkbox" checked={columns.includes(c.id)} onChange={() => setColumns(columns.includes(c.id) ? columns.filter((x) => x !== c.id) : COLUMNS.map((x) => x.id).filter((x) => x === c.id || columns.includes(x)))} /> {c.label}
                  </label>
                ))}
              </div>
            </details>
          </div>

          <div className="sx-bulk">
            <span>{selectedRows.length} selected of {visible.length}</span>
            <button type="button" onClick={download}>Export CSV{selectedRows.length > 0 ? ' (selected)' : ''}</button>
            <button type="button" disabled={selectedRows.length === 0} onClick={() => void bulk('noindex')}>Mark noindex</button>
            <input type="text" placeholder="Redirect to / or https://..." aria-label="Redirect the selected addresses to" value={redirectTo} onChange={(event) => setRedirectTo(event.target.value)} />
            <button type="button" disabled={selectedRows.length === 0 || !redirectTo.trim()} onClick={() => void bulk('redirect')}>Add 301 redirects</button>
            {notice && <span role="status">{notice}</span>}
          </div>

          <div className="sx-split">
            <div className="sx-tablewrap">
              <table className="sx-table">
                <thead>
                  <tr>
                    <th scope="col"><input type="checkbox" aria-label="Select all shown" checked={visible.length > 0 && selectedRows.length === visible.length} onChange={(event) => setSelected(event.target.checked ? new Set(visible.map((r) => r.id)) : new Set())} /></th>
                    {shownColumns.map((c) => (
                      <th key={c.id} scope="col" aria-sort={sort.id === c.id ? (sort.desc ? 'descending' : 'ascending') : 'none'}>
                        <button type="button" onClick={() => setSort({ id: c.id, desc: sort.id === c.id ? !sort.desc : c.numeric === true })}>{c.label}{sort.id === c.id ? (sort.desc ? ' ▼' : ' ▲') : ''}</button>
                      </th>
                    ))}
                    <th scope="col">Open</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((row) => (
                    <tr key={row.id} className={detail?.id === row.id ? 'sx-row--open' : undefined}>
                      <td><input type="checkbox" aria-label={`Select ${row.path}`} checked={selected.has(row.id)} onChange={() => { const next = new Set(selected); if (next.has(row.id)) next.delete(row.id); else next.add(row.id); setSelected(next) }} /></td>
                      {shownColumns.map((c) => {
                        const value = c.value(row)
                        return <td key={c.id} className={c.numeric ? 'sx-num' : undefined}>{value === null ? '' : String(value)}</td>
                      })}
                      <td><button type="button" onClick={() => setDetail(row)}>Details</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {visible.length === 0 && <p className="sx-muted">No pages match these filters.</p>}
            </div>
            {detail && <Detail row={detail} onClose={() => setDetail(null)} />}
          </div>
        </>
      )}
    </CollapsibleCard>
  )
}

export default SiteAuditPanel
