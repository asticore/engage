import React from 'react'

import { balances } from '../commission'
import { bannerSnippet, parseCreativeIds, referralLink } from '../core'
import { PayoutDetailsForm } from './PayoutDetailsForm'
import { commissionsFor, creativesByIds, getSettings, type Affiliate, type D1 } from '../store'

const money = (cents: number): string => `$${(cents / 100).toFixed(2)}`

/** What an affiliate sees: their link, results and commissions. Shared by the private-link page and the member page. */
export async function AffiliateDashboardView({ d1, affiliate, origin, privateLink }: { d1: D1; affiliate: Affiliate; origin: string; privateLink: boolean }): Promise<React.ReactElement> {
  const rows = await commissionsFor(d1, affiliate.id, 100)
  const bal = balances(rows, new Date())
  const link = referralLink(origin, affiliate.code)
  const creatives = affiliate.status === 'active' ? await creativesByIds(d1, parseCreativeIds((await getSettings(d1)).creatives)) : []
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
      {affiliate.token && (
        <>
          <h2>How you get paid</h2>
          <PayoutDetailsForm token={affiliate.token} initial={affiliate.payoutDetails} />
        </>
      )}
      {creatives.length > 0 && (
        <>
          <h2>Banners and images</h2>
          <p>Use these on your site or posts. Copy the snippet to show the image as a link that carries your referral link.</p>
          {creatives.map((c) => (
            <div key={c.id}>
              <img src={c.url} alt={c.alt} style={{ maxWidth: '20rem', height: 'auto' }} />
              <p>
                <a href={c.url} download>Download</a>
                {c.width > 0 ? ` (${c.width} x ${c.height})` : ''}
              </p>
              <textarea readOnly rows={3} style={{ width: '100%' }} aria-label={`HTML for ${c.alt || c.filename}`} value={bannerSnippet({ link, imageUrl: /^https?:\/\//.test(c.url) ? c.url : `${origin}${c.url.startsWith('/') ? c.url : `/${c.url}`}`, alt: c.alt })} />
            </div>
          ))}
        </>
      )}
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
      {privateLink && <p>Keep this page&apos;s address private: anyone with it can see your results.</p>}
    </div>
  )
}
