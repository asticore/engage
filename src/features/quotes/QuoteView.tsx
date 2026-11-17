'use client'

import { useEffect, useState } from 'react'

import { useStoreLocale, useStoreText } from '@/features/uiStrings/StoreTextsContext'

type Line = { description: string; quantity: number; unitCents: number }
type View = { number: string; kind: string; status: string; name: string; currency: string; lines: Line[]; totalCents: number | null; validUntil: string | null; terms: string; counterNote: string; counterCents: number | null; answerable: boolean }

const money = (cents: number, currency: string, locale: string): string => {
  try {
    return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(cents / 100)
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency}`
  }
}

/** The page behind the private link in the quote email: read the quote, accept it, decline it or send a counter-offer. */
export function QuoteView({ token }: { token: string }) {
  const t = useStoreText()
  const locale = useStoreLocale() ?? 'en-AU'
  const fmt = (cents: number, currency: string): string => money(cents, currency, locale)
  const [view, setView] = useState<View | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState('')
  const [amount, setAmount] = useState('')
  const [done, setDone] = useState(() => (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('paid') === '1' ? t('store.quote.page.donePaid') : ''))

  useEffect(() => {
    void (async () => {
      const res = await fetch(`/api/quote-view?token=${encodeURIComponent(token)}`)
      const body = (await res.json().catch(() => ({}))) as View & { error?: string }
      if (res.ok) setView(body)
      else setError(res.status === 404 ? t('store.quote.page.notFound') : (body.error ?? t('store.quote.page.loadFailed')))
    })()
  }, [token])

  const act = async (action: 'accept' | 'accept-card' | 'decline' | 'counter'): Promise<void> => {
    setBusy(true)
    setError('')
    try {
      const res = await fetch('/api/quote-view', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, action, note, amount }) })
      const body = (await res.json().catch(() => ({}))) as View & { error?: string; payUrl?: string }
      if (res.ok && body.payUrl) {
        window.location.href = body.payUrl
        return
      }
      if (res.ok) {
        setView(body)
        setDone(action === 'accept' ? t('store.quote.page.doneAccept') : action === 'decline' ? t('store.quote.page.doneDecline') : t('store.quote.page.doneCounter'))
      } else setError(body.error ?? t('store.quote.failed'))
    } finally {
      setBusy(false)
    }
  }

  const statusText = (status: string): string => (['new', 'quoted', 'countered', 'accepted', 'declined', 'expired', 'closed'].includes(status) ? t(`store.quote.status.${status}` as 'store.quote.status.new') : status)
  if (!view) return error ? <p role="alert" className="badge">{error}</p> : <p>{t('store.quote.page.loading')}</p>
  return (
    <div className="card">
      <div className="card-body stack">
        <strong>{t('store.quote.page.heading', { number: view.number, name: view.name })}</strong>
        {view.lines.length > 0 ? (
          <table className="table">
            <thead><tr><th>{t('store.quote.page.colItem')}</th><th>{t('store.quote.page.colQty')}</th><th>{t('store.quote.page.colPrice')}</th><th>{t('store.quote.page.colTotal')}</th></tr></thead>
            <tbody>{view.lines.map((l, i) => <tr key={i}><td>{l.description}</td><td>{l.quantity}</td><td>{fmt(l.unitCents, view.currency)}</td><td>{fmt(l.unitCents * l.quantity, view.currency)}</td></tr>)}</tbody>
          </table>
        ) : null}
        {view.totalCents !== null ? <p><strong>{t('store.quote.page.total', { amount: fmt(view.totalCents, view.currency) })}</strong></p> : null}
        {view.validUntil ? <p className="text-muted">{t('store.quote.page.validUntil', { date: new Intl.DateTimeFormat(locale, { dateStyle: 'long' }).format(new Date(view.validUntil)) })}</p> : null}
        {view.terms ? <p className="text-muted" style={{ whiteSpace: 'pre-wrap' }}>{view.terms}</p> : null}
        <p>{t('store.quote.page.status', { status: statusText(view.status) })}</p>
        {view.status === 'countered' ? <p className="text-muted">{view.counterCents ? t('store.quote.page.counteredAmount', { amount: fmt(view.counterCents, view.currency) }) : t('store.quote.page.countered')}</p> : null}
        {view.answerable ? (
          <>
            <div className="cluster">
              <button type="button" className="btn" disabled={busy} onClick={() => void act('accept')}>{t('store.quote.page.accept')}</button>
              <button type="button" className="btn" disabled={busy} onClick={() => void act('accept-card')}>{t('store.quote.page.acceptCard')}</button>
              <button type="button" className="btn" disabled={busy} onClick={() => void act('decline')}>{t('store.quote.page.decline')}</button>
            </div>
            <label className="field">{t('store.quote.page.changeNote')}<textarea className="input" rows={3} value={note} onChange={(e) => setNote(e.target.value)} /></label>
            <label className="field">{t('store.quote.page.amount')}<input className="input" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} /></label>
            <button type="button" className="btn" disabled={busy} onClick={() => void act('counter')}>{t('store.quote.page.counter')}</button>
          </>
        ) : null}
        {done ? <p role="status" className="badge">{done}</p> : null}
        {error ? <p role="alert" className="badge">{error}</p> : null}
      </div>
    </div>
  )
}
