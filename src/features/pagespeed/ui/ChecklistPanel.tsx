'use client'

import React, { useState } from 'react'

import { STATUS_WORD, groupChecklist, type ChecklistRow, type CheckStatus } from '../checklist'
import './checklist.css'

const STATUS_CLASS: Record<CheckStatus, string> = { pass: 'cl-pass', warning: 'cl-warn', fail: 'cl-fail', na: 'cl-na', manual: 'cl-manual', info: 'cl-info' }

/**
 * Every check of a report, grouped by category, always shown: passing rows are green, rows that do not apply are grey
 * "Not applicable" and nothing is hidden. Used for the PageSpeed Insights checklist and for our own page checks.
 */
export function ChecklistPanel({ rows, groupLabelOverride }: { rows: ChecklistRow[]; groupLabelOverride?: Record<string, string> }) {
  const groups = groupChecklist(rows)
  const [open, setOpen] = useState<Record<string, boolean>>({})
  if (groups.length === 0) return null
  return (
    <div className="cl">
      {groups.map((g) => {
        const needs = g.counts.fail + g.counts.warning
        const isOpen = open[g.group] ?? needs > 0
        const label = groupLabelOverride?.[g.group] ?? g.label
        return (
          <section key={g.group} className="cl__group">
            <h4 className="cl__heading">
              <button type="button" className="cl__toggle" aria-expanded={isOpen} onClick={() => setOpen({ ...open, [g.group]: !isOpen })}>
                <span aria-hidden="true">{isOpen ? '▾' : '▸'}</span> {label}
                <span className="cl__counts">
                  {g.counts.fail > 0 && <span className="cl-chip cl-fail">{g.counts.fail} fail</span>}
                  {g.counts.warning > 0 && <span className="cl-chip cl-warn">{g.counts.warning} warning</span>}
                  {g.counts.manual > 0 && <span className="cl-chip cl-manual">{g.counts.manual} by hand</span>}
                  <span className="cl-chip cl-pass">{g.counts.pass} pass</span>
                  {g.counts.na > 0 && <span className="cl-chip cl-na">{g.counts.na} not applicable</span>}
                </span>
              </button>
            </h4>
            {isOpen && (
              <ul className="cl__list">
                {g.rows.map((row) => (
                  <li key={`${row.group}-${row.id}`} className={`cl__row ${STATUS_CLASS[row.status]}`}>
                    <span className={`cl-chip ${STATUS_CLASS[row.status]}`}>{STATUS_WORD[row.status]}</span>
                    <span className="cl__title">{row.title}</span>
                    {row.value ? <span className="cl__value">{row.value}</span> : null}
                    {row.hint ? <span className="cl__hint">{row.hint}</span> : null}
                  </li>
                ))}
              </ul>
            )}
          </section>
        )
      })}
    </div>
  )
}
