'use client'

import React from 'react'

import type { ConvertReport, ScanReport, UndoReport } from './service'

const LABELS: Record<string, string> = {
  hero: 'Hero',
  ctaBanner: 'Call to action banner',
  imageText: 'Image and text',
  gallery: 'Gallery',
  richText: 'Rich text',
  toc: 'Table of contents',
  eventGrid: 'Event grid',
  faq: 'FAQ',
  productGrid: 'Product grid',
}

const cell = 'border-b border-[var(--theme-elevation-100)] px-[calc(var(--base)*0.5)] py-[calc(var(--base)*0.35)] text-left align-top'
const button = 'border [font-family:inherit] cursor-pointer rounded-[3px] bg-[var(--theme-elevation-0)] px-[calc(var(--base)*0.75)] py-[calc(var(--base)*0.3)] text-[0.85rem] border-[var(--theme-elevation-250)] text-[var(--theme-elevation-800)] disabled:cursor-not-allowed disabled:opacity-50'
const note = 'm-0 text-[0.85rem] text-[var(--theme-elevation-600)]'

const summary = (counts: Record<string, number | undefined>): string =>
  Object.entries(counts).filter(([, n]) => n).map(([type, n]) => `${n} ${LABELS[type] ?? type}`).join(', ') || 'none'

async function call<T>(init?: RequestInit): Promise<T | null> {
  try {
    const res = await fetch('/api/admin-legacy-blocks', { credentials: 'same-origin', cache: 'no-store', ...init })
    return res.ok ? ((await res.json()) as T) : null
  } catch {
    return null
  }
}

/**
 * Settings > Legacy blocks. Report first (read only), then "Preview" lists what would change, then "Convert" saves a
 * backup and converts. Every conversion shows its batch so it can be undone.
 */
export const LegacyBlocksPanel: React.FC = () => {
  const [scan, setScan] = React.useState<ScanReport | null>(null)
  const [report, setReport] = React.useState<ConvertReport | null>(null)
  const [undo, setUndo] = React.useState<UndoReport | null>(null)
  const [busy, setBusy] = React.useState(false)
  const [failed, setFailed] = React.useState(false)

  const refresh = React.useCallback(async () => {
    setBusy(true)
    const next = await call<ScanReport>()
    setFailed(next === null)
    setScan(next)
    setBusy(false)
  }, [])
  React.useEffect(() => {
    void refresh()
  }, [refresh])

  const post = (body: Record<string, unknown>): RequestInit => ({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })

  const convert = async (execute: boolean, only?: { collection: string; id: string | number }): Promise<void> => {
    setBusy(true)
    setUndo(null)
    const result = await call<ConvertReport>(post({ action: 'convert', execute, ...(only ?? {}) }))
    setReport(result)
    setFailed(result === null)
    if (execute && result) {
      // Show the new state at once; the fresh count follows from the server.
      const done = new Set(result.entries.filter((e) => e.status === 'converted').map((e) => `${e.collection}-${e.id}`))
      setScan((prev) => (prev ? { ...prev, documents: prev.documents.filter((d) => !done.has(`${d.collection}-${d.id}`)) } : prev))
    }
    setBusy(false)
    if (execute) void refresh()
  }

  const undoBatch = async (batchId: string): Promise<void> => {
    setBusy(true)
    setUndo(await call<UndoReport>(post({ action: 'undo', batchId })))
    setReport(null)
    setBusy(false)
    void refresh()
  }

  return (
    <div className="flex flex-col gap-[var(--base)]">
      {failed && <p className="m-0 text-[var(--theme-error-500,var(--theme-elevation-800))]">That did not work. Check you are signed in as an admin and try again.</p>}
      {busy && scan && <p className={note} role="status">Working...</p>}
      {!scan && !failed && <p className={note}>Counting...</p>}
      {scan && (
        <>
          <p className="m-0">
            {scan.total === 0
              ? 'No page, post, product or template holds a legacy block. Nothing to convert.'
              : `${scan.total} legacy block${scan.total === 1 ? '' : 's'} left: ${summary(scan.totals)}.`}
          </p>
          <table className="w-full border-collapse text-[0.9rem]">
            <thead>
              <tr>
                <th className={cell}>Where</th>
                <th className={cell}>Documents</th>
                <th className={cell}>With legacy blocks</th>
                <th className={cell}>Blocks</th>
              </tr>
            </thead>
            <tbody>
              {scan.surfaces.map((s) => (
                <tr key={s.collection}>
                  <td className={cell}>{s.label}</td>
                  <td className={cell}>{s.error ? 'Not readable' : s.documents}</td>
                  <td className={cell}>{s.withLegacy}</td>
                  <td className={cell}>{summary(s.counts)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {scan.documents.length > 0 && (
            <ul className="m-0 flex list-none flex-col gap-1 p-0 text-[0.9rem]">
              {scan.documents.map((d) => (
                <li key={`${d.collection}-${d.id}`} className="flex flex-wrap items-center gap-2">
                  <span>
                    {d.title} <span className={note}>({d.collection}: {summary(d.counts)})</span>
                  </span>
                  <button type="button" className={button} disabled={busy} onClick={() => void convert(true, { collection: d.collection, id: d.id })}>
                    Convert this one
                  </button>
                </li>
              ))}
            </ul>
          )}
          {scan.truncated && <p className={note}>The list shows the first documents only. Convert all handles the rest.</p>}
          <p className={note}>Converting keeps every value and saves a backup of the old content first. The old renderers stay, so exports made earlier still import.</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={button} disabled={busy || scan.total === 0} onClick={() => void convert(false)}>
              Preview what would change
            </button>
            <button type="button" className={button} disabled={busy || scan.total === 0} onClick={() => void convert(true)}>
              Convert all
            </button>
          </div>
        </>
      )}
      {report && (
        <section className="flex flex-col gap-1" aria-live="polite">
          <h2 className="m-0 text-[1rem]">{report.dryRun ? 'Preview' : 'Converted'}</h2>
          <p className="m-0">
            {report.dryRun ? 'Would convert' : 'Converted'} {summary(report.converted)}. {report.errors > 0 ? `${report.errors} could not be changed.` : ''}
          </p>
          <ul className="m-0 flex list-none flex-col gap-1 p-0 text-[0.85rem]">
            {report.entries.map((e, i) => (
              <li key={`${e.collection}-${e.id}-${i}`}>
                {e.title} ({e.collection}): {e.status === 'error' ? `error, ${e.error}` : e.status === 'skipped' ? 'left as it was' : summary(e.converted)}
              </li>
            ))}
          </ul>
          {report.batchId && report.entries.some((e) => e.status === 'converted') && (
            <div className="flex flex-wrap items-center gap-2">
              <span className={note}>Batch {report.batchId}</span>
              <button type="button" className={button} disabled={busy} onClick={() => void undoBatch(report.batchId as string)}>
                Undo this batch
              </button>
            </div>
          )}
        </section>
      )}
      {undo && <p className="m-0">{undo.ok ? `Restored ${undo.restored} document${undo.restored === 1 ? '' : 's'}.` : `${undo.reason ?? 'Some documents could not be restored.'} ${undo.restored} restored.`}</p>}
    </div>
  )
}
