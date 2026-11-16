import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import React from 'react'

import { balances } from '@/features/affiliates/commission'
import { isToken, referralLink } from '@/features/affiliates/core'
import { commissionsFor, findByToken, type D1 } from '@/features/affiliates/store'
import { rawD1 } from '@/features/ecommerce/server/db'
import { getFeatureFlags } from '@/utilities/features'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Your affiliate dashboard', robots: { index: false, follow: false } }

const money = (cents: number): string => `$${(cents / 100).toFixed(2)}`

export default async function AffiliateDashboard({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  if (!(await getFeatureFlags()).affiliates) notFound()
  const { token } = await searchParams
  if (!isToken(token)) notFound()
  const d1 = (await rawD1()) as never as D1
  const affiliate = await findByToken(d1, token)
  if (!affiliate) notFound()
  const rows = await commissionsFor(d1, affiliate.id, 100)
  const bal = balances(rows, new Date())
  const h = await headers()
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? ''
  const link = referralLink(host ? `https://${host}` : '', affiliate.code)
  const note = affiliate.status === 'pending' ? 'Your application is waiting for approval, so your link is not tracking yet.' : affiliate.status === 'suspended' ? 'Your account is suspended.' : ''
  return (
    <div className="page-shell">
      <h1>Your affiliate dashboard</h1>
      <p>
        Hello {affiliate.name}. {note}
      </p>
      <h2>Your link</h2>
      <p>
        <code>{link}</code>
      </p>
      <h2>Results</h2>
      <ul>
        <li>Visits: {affiliate.visits}</li>
        <li>Orders: {rows.length}</li>
        <li>Waiting to become payable: {money(bal.pending)}</li>
        <li>Payable now: {money(bal.owed)}</li>
        <li>Paid so far: {money(bal.paid)}</li>
      </ul>
      {rows.length > 0 && (
        <table>
          <thead>
            <tr>
              <th scope="col">Date</th>
              <th scope="col">Commission</th>
              <th scope="col">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{r.created_at.slice(0, 10)}</td>
                <td>{money(r.amount_cents)}</td>
                <td>{r.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p>Keep this page's address private: anyone with it can see your results.</p>
    </div>
  )
}
