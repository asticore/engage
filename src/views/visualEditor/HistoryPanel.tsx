'use client'

import React, { useState } from 'react'

import { useAdminT } from '@/admin/i18n/AdminUiProvider'
import { useAuthorNames } from '@/admin/views/useAuthorNames'

import type { HistoryRow } from './history'
import { relativeTime, type RevisionRow } from './revisions'
import type { RevisionsState } from './useRevisions'

type PanelTab = 'actions' | 'revisions'

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

/** Saved versions from the server. Apply loads one into the editor as an undoable edit; nothing is saved until Save. */
const RevisionsList: React.FC<{
  revisions: RevisionsState
  onApply: (revision: RevisionRow) => void
}> = ({ revisions, onApply }) => {
  const t = useAdminT()
  const authorName = useAuthorNames(revisions.rows.map((row) => row.authorId))
  const now = revisions.fetchedAt

  if (revisions.status === 'loading') return <p className="ve-hist__note">{t('ve.history.loading')}</p>
  return (
    <>
      {revisions.error && <p className="ve-hist__error" role="alert">{revisions.error}</p>}
      {revisions.rows.length === 0 && !revisions.error ? (
        <p className="ve-hist__note">{t('ve.revisions.none')}</p>
      ) : (
        <ul className="ve-hist__list" aria-label={t('ve.history.revisions')}>
          {revisions.rows.map((row) => {
            const author = row.authorId === null ? t('ve.revisions.unknownAuthor') : authorName(row.authorId)
            const status = row.status === 'published' ? t('status.published') : row.status === 'draft' ? t('status.draft') : null
            const when = relativeTime(row.updatedAt, now)
            return (
              <li key={row.id} className="ve-hist__item">
                <span className="ve-hist__meta">
                  <span className="ve-hist__label" title={row.updatedAt}>{when}</span>
                  <span className="ve-hist__sub">{[author, status, row.latest ? t('ve.revisions.latest') : null].filter(Boolean).join(' - ')}</span>
                </span>
                <button type="button" className="ve-hist__apply" onClick={() => onApply(row)}>
                  {t('ve.revisions.apply')}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </>
  )
}

/**
 * The dock's History tab. Actions: this session's edits (undo list with jump). Revisions: the document's
 * saved versions on the server, hidden when the collection has none.
 */
export const HistoryPanel: React.FC<{
  rows: HistoryRow[]
  onJump: (steps: number) => void
  revisions: RevisionsState
  onApplyRevision: (revision: RevisionRow) => void
}> = ({ rows, onJump, revisions, onApplyRevision }) => {
  const t = useAdminT()
  const [tab, setTab] = useState<PanelTab>('actions')
  const showRevisions = revisions.status !== 'unavailable'
  const active: PanelTab = showRevisions ? tab : 'actions'

  return (
    <div className="ve-hist">
      {showRevisions && (
        <div className="ve-hist__tabs" role="tablist" aria-label={t('ve.history.tabs')}>
          <button type="button" role="tab" className="ve-hist__tab" aria-selected={active === 'actions'} onClick={() => setTab('actions')}>
            {t('ve.history.actions')}
          </button>
          <button type="button" role="tab" className="ve-hist__tab" aria-selected={active === 'revisions'} onClick={() => setTab('revisions')}>
            {t('ve.history.revisions')}
          </button>
        </div>
      )}
      {active === 'actions' ? (
        <>
          <ActionsList rows={rows} onJump={onJump} />
          <p className="ve-hist__note">{t('ve.history.note')}</p>
        </>
      ) : (
        <>
          <RevisionsList revisions={revisions} onApply={onApplyRevision} />
          <p className="ve-hist__note">{t('ve.revisions.note')}</p>
        </>
      )}
    </div>
  )
}

export default HistoryPanel
