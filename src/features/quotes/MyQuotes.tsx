import React from 'react'

import { rawD1 } from '@/features/ecommerce/server/db'

import { OpenQuote } from './OpenQuote'
import { effectiveStatus, KIND_LABELS, portalCanOpen } from './logic'
import * as store from './store'

const money = (cents: number, currency: string): string => new Intl.NumberFormat('en-AU', { style: 'currency', currency }).format(cents / 100)

/** The signed-in customer's quote, offer and item requests, with Open quote where a quote is waiting. Only call it for a confirmed email. */
export async function MyQuotes({ email }: { email: string }): Promise<React.ReactElement | null> {
  const d1 = (await rawD1().catch((): null => null)) as never as store.D1 | null
  if (!d1) return null
  const requests = await store.listByEmail(d1, email).catch((): store.QuoteRequest[] => [])
  if (requests.length === 0) return null
  const now = new Date()
  return (
    <section className="account-section">
      <h2>Quotes and requests</h2>
      {requests.map((r) => (
        <article className="account-card" key={r.id}>
          <h3>{r.number} · {KIND_LABELS[r.kind]}</h3>
          <p className="account-muted">{effectiveStatus(r.status, r.validUntil, now)}{r.totalCents !== null ? ` · Quoted ${money(r.totalCents, r.currency)}` : ''}{r.validUntil && r.totalCents !== null ? ` · valid until ${r.validUntil.slice(0, 10)}` : ''}</p>
          {portalCanOpen(r, now) ? <OpenQuote id={r.id} /> : null}
        </article>
      ))}
    </section>
  )
}
