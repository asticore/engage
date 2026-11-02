'use client'

import React from 'react'

import { useAdminT } from '@/admin/i18n/AdminUiProvider'

import { dropUnusedTableAction, exportUnusedTableAction } from './unusedActions'
import { formatBytes } from './size'
import type { UnusedTable } from './unusedTables'

/**
 * The table list of the Unused tables screen. A convenience, not the boundary:
 * the server action re-checks the session, the feature switch, the payment rule
 * and the typed name before it drops anything.
 */

const cellClassName = 'border-b border-[var(--theme-elevation-100)] px-[calc(var(--base)*0.5)] py-[calc(var(--base)*0.35)] text-left align-top'
const numberCellClassName = `${cellClassName} text-right whitespace-nowrap`
const buttonClassName =
  'border [font-family:inherit] cursor-pointer rounded-[3px] bg-[var(--theme-elevation-0)] px-[calc(var(--base)*0.75)] py-[calc(var(--base)*0.3)] text-[0.85rem] border-[var(--theme-elevation-250)] text-[var(--theme-elevation-800)] disabled:cursor-not-allowed disabled:opacity-50'
const dangerButtonClassName = `${buttonClassName} border-[var(--theme-error-500,var(--theme-elevation-800))]`
const noteClassName = 'm-0 text-[0.85rem] text-[var(--theme-elevation-600)]'
const errorClassName = 'm-0 text-[0.85rem] text-[var(--theme-error-500,var(--theme-elevation-800))]'

/** Starts a browser download of text, without a server round trip. */
function download(filename: string, text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }))
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

const Row: React.FC<{ entry: UnusedTable; estimated: boolean; onDeleted: (table: string, message: string) => void }> = ({ entry, estimated, onDeleted }) => {
  const t = useAdminT()
  const [confirming, setConfirming] = React.useState(false)
  const [typed, setTyped] = React.useState('')
  const [busy, setBusy] = React.useState(false)
  const [message, setMessage] = React.useState<{ error: boolean; text: string } | null>(null)

  const refusalText = (reason: string | undefined): string => {
    if (reason?.startsWith('error:')) return t('ut.refused.error', { detail: reason.slice(6) })
    const key = `ut.refused.${reason ?? 'error'}` as Parameters<typeof t>[0]
    return t(key, { detail: reason ?? '' })
  }

  const exportJson = async (): Promise<void> => {
    setBusy(true)
    setMessage({ error: false, text: t('ut.exporting') })
    const result = await exportUnusedTableAction(entry.table)
    if (result.ok) {
      download(`${entry.table}.json`, result.json)
      setMessage(result.truncated ? { error: false, text: t('ut.exportTruncated', { rows: result.rows }) } : null)
    } else {
      setMessage({ error: true, text: refusalText(result.reason) })
    }
    setBusy(false)
  }

  const remove = async (): Promise<void> => {
    setBusy(true)
    const result = await dropUnusedTableAction(entry.table, typed)
    setBusy(false)
    if (result.ok) onDeleted(entry.table, t('ut.deleted', { table: entry.table, rows: result.rowsDropped }))
    else setMessage({ error: true, text: refusalText(result.reason) })
  }

  return (
    <tr>
      <td className={cellClassName}>
        <code>{entry.table}</code>
      </td>
      <td className={cellClassName}>{entry.featureLabel}</td>
      <td className={numberCellClassName}>{entry.rows.toLocaleString()}</td>
      <td className={numberCellClassName}>
        {estimated && entry.bytes > 0 ? '~' : ''}
        {formatBytes(entry.bytes)}
      </td>
      <td className={cellClassName}>
        {entry.paymentRecord ? (
          <p className={noteClassName}>{t('ut.paymentKept')}</p>
        ) : (
          <div className="flex flex-col gap-[calc(var(--base)*0.4)]">
            <div className="flex flex-wrap gap-[calc(var(--base)*0.4)]">
              <button className={buttonClassName} disabled={busy} onClick={exportJson} type="button">
                {t('ut.export')}
              </button>
              {!confirming && (
                <button className={dangerButtonClassName} disabled={busy} onClick={() => setConfirming(true)} type="button">
                  {t('ut.delete')}
                </button>
              )}
            </div>
            {confirming && (
              <div className="flex flex-col gap-[calc(var(--base)*0.4)]">
                <p className={noteClassName}>{t('ut.confirmPrompt', { table: entry.table })}</p>
                <p className={noteClassName}>{t('ut.exportFirst')}</p>
                <input
                  aria-label={t('ut.confirmField')}
                  autoComplete="off"
                  onChange={(event) => setTyped(event.target.value)}
                  placeholder={entry.table}
                  type="text"
                  value={typed}
                />
                <div className="flex flex-wrap gap-[calc(var(--base)*0.4)]">
                  <button className={dangerButtonClassName} disabled={busy || typed !== entry.table} onClick={remove} type="button">
                    {t('ut.confirmDelete')}
                  </button>
                  <button
                    className={buttonClassName}
                    disabled={busy}
                    onClick={() => {
                      setConfirming(false)
                      setTyped('')
                    }}
                    type="button"
                  >
                    {t('ut.cancel')}
                  </button>
                </div>
              </div>
            )}
            {message && <p className={message.error ? errorClassName : noteClassName}>{message.text}</p>}
          </div>
        )}
      </td>
    </tr>
  )
}

export const UnusedTablesPanel: React.FC<{ tables: UnusedTable[]; estimated: boolean }> = ({ tables, estimated }) => {
  const t = useAdminT()
  const [removed, setRemoved] = React.useState<string[]>([])
  const [notes, setNotes] = React.useState<string[]>([])
  const visible = tables.filter((entry) => !removed.includes(entry.table))

  return (
    <div className="flex flex-col gap-[var(--base)]">
      {notes.map((note) => (
        <p className="m-0 text-[0.9rem]" key={note} role="status">
          {note}
        </p>
      ))}
      {visible.length === 0 ? (
        <p className={noteClassName}>{t('ut.empty')}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[0.9rem]">
            <thead>
              <tr>
                <th className={cellClassName}>{t('ut.col.table')}</th>
                <th className={cellClassName}>{t('ut.col.section')}</th>
                <th className={numberCellClassName}>{t('ut.col.rows')}</th>
                <th className={numberCellClassName}>{t('ut.col.size')}</th>
                <th className={cellClassName}>{t('ut.col.action')}</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((entry) => (
                <Row
                  entry={entry}
                  estimated={estimated}
                  key={entry.table}
                  onDeleted={(table, message) => {
                    setRemoved((current) => [...current, table])
                    setNotes((current) => [...current, message])
                  }}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
