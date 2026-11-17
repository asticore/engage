'use client'

import { useEffect, useState } from 'react'

import { useAdminHref } from '@/admin/adminRoute/AdminRouteProvider'
import { useAdminT } from '@/admin/i18n/AdminUiProvider'
import type { UiStringKey } from '@/features/uiStrings'

import { isOverdue, type Card } from './logic'

type Row = Card & { boardName: string; columnName: string }

/** Every open task given to the signed-in person, across the boards they may open. Soonest due first. */
export function MyTasksPanel() {
  const t = useAdminT()
  const adminHref = useAdminHref()
  const [rows, setRows] = useState<Row[] | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let live = true
    fetch('/api/admin-taskboard?mine=1', { cache: 'no-store' })
      .then(async (res) => {
        const body = (await res.json().catch(() => ({}))) as { cards?: Row[]; error?: string }
        if (!live) return
        if (!res.ok) setError(body.error ?? t('tb.loadFailed'))
        else setRows(body.cards ?? [])
      })
      .catch((): void => {
        if (live) setError(t('tb.loadFailed'))
      })
    return () => {
      live = false
    }
  }, [t])

  if (error) return <p role="alert" className="badge">{error}</p>
  if (!rows) return <p className="text-muted">{t('tb.loading')}</p>
  const today = new Date().toISOString().slice(0, 10)
  return (
    <div className="stack">
      <a className="btn" href={adminHref('/taskboard')}>{t('tb.mine.openBoard')}</a>
      {rows.length === 0 ? <p className="text-muted">{t('tb.mine.empty')}</p> : null}
      {rows.map((card) => (
        <article key={card.id} className="card">
          <div className="card-body stack">
            <strong>{card.title}</strong>
            <span className="cluster">
              <span className="text-muted">{card.boardName} · {card.columnName}</span>
              {card.priority !== 'normal' ? <span className="badge">{t(`tb.priority.${card.priority}` as UiStringKey)}</span> : null}
              {card.dueDate ? <span className={isOverdue(card, today) ? 'badge' : 'text-muted'}>{isOverdue(card, today) ? t('tb.overdue') : t('tb.due')} {card.dueDate}</span> : null}
            </span>
          </div>
        </article>
      ))}
    </div>
  )
}
