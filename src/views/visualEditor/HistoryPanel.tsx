'use client'

import React from 'react'

import { useAdminT } from '@/admin/i18n/AdminUiProvider'

import type { HistoryRow } from './history'

/** The editor's own undo list: every action since the page was opened, click one to jump to it. */
const ActionsList: React.FC<{ rows: HistoryRow[]; onJump: (steps: number) => void }> = ({ rows, onJump }) => {
  const t = useAdminT()
  return (
    <ul className="ve-hist__list" aria-label={t('ve.history.actions')}>
      {rows.map((row, index) => {
        const current = row.steps === 0
        const future = row.steps > 0
        const label = row.label ?? (index === 0 ? t('ve.history.start') : t('ve.history.edited'))
        return (
          <li key={row.id}>
            <button
              type="button"
              className={`ve-hist__row${current ? ' ve-hist__row--current' : ''}${future ? ' ve-hist__row--future' : ''}`}
              aria-current={current ? 'true' : undefined}
              onClick={() => onJump(row.steps)}
              disabled={current}
            >
              <span className="ve-hist__label">{label}</span>
              {current && <span className="ve-hist__badge">{t('ve.history.current')}</span>}
            </button>
          </li>
        )
      })}
    </ul>
  )
}

/** The dock's History tab: this session's edits as an undo list with jump. */
export const HistoryPanel: React.FC<{
  rows: HistoryRow[]
  onJump: (steps: number) => void
}> = ({ rows, onJump }) => {
  const t = useAdminT()
  return (
    <div className="ve-hist">
      <ActionsList rows={rows} onJump={onJump} />
      <p className="ve-hist__note">{t('ve.history.note')}</p>
    </div>
  )
}

export default HistoryPanel
