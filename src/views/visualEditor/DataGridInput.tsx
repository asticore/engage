'use client'

import React, { useRef, useState } from 'react'

import { csvCell, parseCsv } from '@/components/blocks/elements/sparkData'

/**
 * Data editor for the Chart and Table elements. The value is stored as CSV text (first row = headings), so the element
 * renders the same either way. Edit cells in the grid, add or remove rows and columns, import a CSV file, or switch to
 * plain text to paste. Up to 500 rows and 24 columns, like the elements.
 */

const MAX_ROWS = 500
const MAX_COLS = 24
const IMPORT_MAX_BYTES = 1_000_000

const toCsv = (rows: string[][]) => rows.map((r) => r.map(csvCell).join(',')).join('\n')
const normalise = (rows: string[][]): string[][] => {
  const width = Math.min(MAX_COLS, Math.max(1, ...rows.map((r) => r.length)))
  return rows.slice(0, MAX_ROWS).map((r) => Array.from({ length: width }, (_, i) => r[i] ?? ''))
}

export const DataGridInput: React.FC<{ label: string; helpText?: string; value: unknown; onChange: (next: string) => void }> = ({ label, helpText, value, onChange }) => {
  const text = typeof value === 'string' ? value : ''
  const [asText, setAsText] = useState(false)
  const [note, setNote] = useState('')
  const file = useRef<HTMLInputElement>(null)
  const rows = normalise(parseCsv(text).length ? parseCsv(text) : [['', ''], ['', '']])

  const commit = (next: string[][]) => onChange(toCsv(next))
  const setCell = (r: number, c: number, v: string) => commit(rows.map((row, ri) => (ri === r ? row.map((cell, ci) => (ci === c ? v : cell)) : row)))
  const addRow = () => rows.length < MAX_ROWS && commit([...rows, rows[0]!.map(() => '')])
  const addCol = () => rows[0]!.length < MAX_COLS && commit(rows.map((row) => [...row, '']))
  const dropRow = (r: number) => rows.length > 1 && commit(rows.filter((_, i) => i !== r))
  const dropCol = (c: number) => rows[0]!.length > 1 && commit(rows.map((row) => row.filter((_, i) => i !== c)))

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    if (f.size > IMPORT_MAX_BYTES) {
      setNote('That file is over 1 MB.')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      const parsed = parseCsv(String(reader.result ?? ''))
      if (parsed.length === 0) {
        setNote('No rows found in that file.')
        return
      }
      setNote(`Imported ${Math.min(parsed.length, MAX_ROWS)} rows.`)
      commit(normalise(parsed))
    }
    reader.readAsText(f)
  }

  return (
    <div className="ve-field">
      <span>{label}</span>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '4px 0' }}>
        <button type="button" onClick={() => setAsText((v) => !v)}>
          {asText ? 'Edit as grid' : 'Edit as text'}
        </button>
        <button type="button" onClick={() => file.current?.click()}>
          Import CSV file
        </button>
        <input ref={file} type="file" accept=".csv,text/csv,text/plain" hidden onChange={onFile} />
      </div>
      {asText ? (
        <textarea rows={8} value={text} onChange={(e) => onChange(e.target.value)} aria-label={label} />
      ) : (
        <div style={{ maxHeight: 260, overflow: 'auto', border: '1px solid rgba(0,0,0,0.15)' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%' }}>
            <thead>
              <tr>
                <th />
                {rows[0]!.map((_, c) => (
                  <th key={c}>
                    <button type="button" aria-label={`Remove column ${c + 1}`} onClick={() => dropCol(c)}>
                      x
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, r) => (
                <tr key={r}>
                  <th scope="row">
                    <button type="button" aria-label={`Remove row ${r + 1}`} onClick={() => dropRow(r)}>
                      x
                    </button>
                  </th>
                  {row.map((cell, c) => (
                    <td key={c}>
                      <input style={{ width: '100%', minWidth: 70, fontWeight: r === 0 ? 700 : undefined }} value={cell} aria-label={`Row ${r + 1}, column ${c + 1}`} onChange={(e) => setCell(r, c, e.target.value)} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {!asText && (
        <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
          <button type="button" onClick={addRow}>
            Add row
          </button>
          <button type="button" onClick={addCol}>
            Add column
          </button>
        </div>
      )}
      {note && <span className="ve-field__help" role="status">{note}</span>}
      {helpText && <span className="ve-field__help">{helpText}</span>}
    </div>
  )
}
