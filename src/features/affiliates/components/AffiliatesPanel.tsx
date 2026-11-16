'use client'

import React, { useCallback, useEffect, useState } from 'react'

import { setupSteps, shareKit, toConsentCategory } from '../core'
import type { AffiliateSettings, Affiliate, CommissionRow } from '../store'

type Row = Affiliate & { pending: number; owed: number; paid: number }
type Payout = { id: number; affiliateId: number; amountCents: number; note: string; createdAt: string }

const money = (cents: number): string => `$${(cents / 100).toFixed(2)}`

/** Admin screen for affiliates: settings, people, balances, manual payouts and the commission log. English only. */
export const AffiliatesPanel: React.FC<{ origin: string }> = ({ origin }) => {
  const [rows, setRows] = useState<Row[]>([])
  const [settings, setSettings] = useState<AffiliateSettings | null>(null)
  const [commissions, setCommissions] = useState<CommissionRow[]>([])
  const [payouts, setPayouts] = useState<Payout[]>([])
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [message, setMessage] = useState('')
  const [configured, setConfigured] = useState(true)

  const load = useCallback(async () => {
    const res = await fetch('/api/admin-affiliates')
    const data = (await res.json().catch((): null => null)) as { affiliates?: Row[]; settings?: AffiliateSettings; commissions?: CommissionRow[]; payouts?: Payout[]; configured?: boolean; error?: string } | null
    if (!res.ok) return setMessage(data?.error ?? 'Could not load affiliates.')
    setRows(data?.affiliates ?? [])
    setSettings(data?.settings ?? null)
    setCommissions(data?.commissions ?? [])
    setPayouts(data?.payouts ?? [])
    setConfigured(data?.configured !== false)
  }, [])
  useEffect(() => {
    void load()
  }, [load])

  const post = async (body: Record<string, unknown>, ok = ''): Promise<boolean> => {
    const res = await fetch('/api/admin-affiliates', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const data = (await res.json().catch((): null => null)) as { error?: string } | null
    if (!res.ok) {
      setMessage(data?.error ?? 'That did not work.')
      return false
    }
    setMessage(ok)
    await load()
    return true
  }

  const link = (c: string): string => `${origin.replace(/\/+$/, '')}/?ref=${encodeURIComponent(c)}`
  const dashboardLink = async (a: Row) => {
    let token = a.token
    if (!token) {
      const res = await fetch('/api/admin-affiliates', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'token', id: a.id }) })
      const data = (await res.json().catch((): null => null)) as { token?: string } | null
      if (!res.ok || !data?.token) return setMessage('Could not make a dashboard link.')
      token = data.token
      await load()
    }
    const url = `${origin.replace(/\/+$/, '')}/affiliates/dashboard?token=${token}`
    await navigator.clipboard?.writeText(url).then(() => setMessage(`Private dashboard link for ${a.name} copied. Send it to them.`)).catch(() => setMessage(url))
  }
  const copyKit = async (a: Row) => {
    let token = a.token
    if (!token) {
      const res = await fetch('/api/admin-affiliates', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'token', id: a.id }) })
      const data = (await res.json().catch((): null => null)) as { token?: string } | null
      if (!res.ok || !data?.token) return setMessage('Could not make a dashboard link.')
      token = data.token
      await load()
    }
    const text = shareKit({ name: a.name, link: link(a.code), dashboard: `${origin.replace(/\/+$/, '')}/affiliates/dashboard?token=${token}`, commissionPct: a.ratePct ?? settings?.commissionPct ?? 10, cookieDays: settings?.cookieDays ?? 30 })
    await navigator.clipboard?.writeText(text).then(() => setMessage(`Share kit for ${a.name} copied. Paste it into an email or message.`)).catch(() => setMessage(text))
  }
  const steps = setupSteps({ configured, affiliates: rows.length, active: rows.filter((r) => r.status === 'active').length, visits: rows.reduce((n, r) => n + r.visits, 0), commissions: commissions.length, payouts: payouts.length })
  const nameOf = (id: number): string => rows.find((r) => r.id === id)?.name ?? `#${id}`
  const set = (patch: Partial<AffiliateSettings>) => setSettings((s) => (s ? { ...s, ...patch } : s))

  return (
    <div style={{ display: 'grid', gap: '1.5rem' }}>
      {message && <p role="status">{message}</p>}

      {steps.some((st) => !st.done) && (
        <section aria-labelledby="aff-setup">
          <h2 id="aff-setup">Get started ({steps.filter((st) => st.done).length} of {steps.length} done)</h2>
          <ol>
            {steps.map((st) => (
              <li key={st.key}>
                <strong>{st.done ? 'Done: ' : 'To do: '}{st.label}.</strong> {st.done ? '' : st.hint}
              </li>
            ))}
          </ol>
        </section>
      )}

      {settings && (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            void post({ action: 'settings', settings }, 'Settings saved.')
          }}
          style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'end' }}
        >
          <label>Cookie days<br /><input type="number" min={1} max={365} value={settings.cookieDays} onChange={(e) => set({ cookieDays: Number(e.target.value) })} /></label>
          <label>Which click counts<br />
            <select value={settings.clickRule} onChange={(e) => set({ clickRule: e.target.value === 'first' ? 'first' : 'last' })}>
              <option value="last">Last click</option>
              <option value="first">First click</option>
            </select>
          </label>
          <label>Commission %<br /><input type="number" min={0} max={100} step="0.5" value={settings.commissionPct} onChange={(e) => set({ commissionPct: Number(e.target.value) })} /></label>
          <label>Days before payable<br /><input type="number" min={0} max={365} value={settings.pendingDays} onChange={(e) => set({ pendingDays: Number(e.target.value) })} /></label>
          <label>Minimum payout ($)<br /><input type="number" min={0} step="1" value={settings.minPayoutCents / 100} onChange={(e) => set({ minPayoutCents: Math.round(Number(e.target.value) * 100) })} /></label>
          <label>Referral cookie is filed under<br />
            <select value={settings.consentCategory} onChange={(e) => set({ consentCategory: toConsentCategory(e.target.value) })}>
              <option value="necessary">Necessary (always stored)</option>
              <option value="preferences">Preferences (needs consent)</option>
              <option value="analytics">Analytics (needs consent)</option>
              <option value="marketing">Marketing (needs consent)</option>
            </select>
          </label>
          <label>
            <input type="checkbox" checked={settings.firstOrderOnly} onChange={(e) => set({ firstOrderOnly: e.target.checked })} /> Commission on a buyer&apos;s first order only
          </label>
          <label>
            <input type="checkbox" checked={settings.emailNotifications} onChange={(e) => set({ emailNotifications: e.target.checked })} /> Email affiliates when approved, when they earn and when paid
          </label>
          <label>
            <input type="checkbox" checked={settings.autoApprove} onChange={(e) => set({ autoApprove: e.target.checked })} /> Approve new sign-ups automatically
          </label>
          <label style={{ flexBasis: '100%' }}>Program terms shown on the sign-up page (leave blank for the standard text)<br />
            <textarea rows={3} style={{ width: '100%' }} maxLength={4000} value={settings.terms} onChange={(e) => set({ terms: e.target.value })} />
          </label>
          <button type="submit">Save settings</button>
          <span>Public sign-up page: <a href="/affiliates" target="_blank" rel="noreferrer">{origin.replace(/\/+$/, '')}/affiliates</a></span>
        </form>
      )}

      <form
        onSubmit={async (e) => {
          e.preventDefault()
          if (await post({ action: 'create', name, email, code })) {
            setName('')
            setEmail('')
            setCode('')
          }
        }}
        style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'end' }}
      >
        <label>Name<br /><input value={name} onChange={(e) => setName(e.target.value)} required maxLength={80} /></label>
        <label>Email (optional)<br /><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={200} /></label>
        <label>Code (optional)<br /><input value={code} onChange={(e) => setCode(e.target.value)} maxLength={32} /></label>
        <button type="submit">Add affiliate</button>
      </form>

      {rows.length === 0 ? (
        <p>No affiliates yet. Add one, then share their link.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th scope="col">Name</th>
              <th scope="col">Link</th>
              <th scope="col">Status</th>
              <th scope="col">Visits</th>
              <th scope="col">Waiting</th>
              <th scope="col">Owed now</th>
              <th scope="col">Paid</th>
              <th scope="col">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((a) => (
              <tr key={a.id}>
                <th scope="row">{a.name}{a.email ? <small> ({a.email})</small> : null}</th>
                <td><code>{link(a.code)}</code></td>
                <td>{a.status}</td>
                <td>{a.visits}</td>
                <td>{money(a.pending)}</td>
                <td>{money(a.owed)}</td>
                <td>{money(a.paid)}</td>
                <td style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  {a.status !== 'active' && <button type="button" onClick={() => post({ action: 'status', id: a.id, status: 'active' })}>Approve</button>}
                  {a.status === 'active' && <button type="button" onClick={() => post({ action: 'status', id: a.id, status: 'suspended' })}>Suspend</button>}
                  {a.owed > 0 && <button type="button" onClick={() => { const note = window.prompt(`Record a payout of ${money(a.owed)} to ${a.name}. Note (for example the payment reference):`, ''); if (note !== null) void post({ action: 'payout', id: a.id, note }, `Payout of ${money(a.owed)} recorded. Pay ${a.name} outside the site.`) }}>Record payout</button>}
                  <button type="button" onClick={() => { const v = window.prompt(`Commission rate for ${a.name} in percent (blank to use the program rate of ${settings?.commissionPct ?? 10}%):`, a.ratePct === null ? '' : String(a.ratePct)); if (v !== null) void post({ action: 'rate', id: a.id, ratePct: v.trim() === '' ? null : Number(v) }, 'Rate saved.') }}>Rate: {a.ratePct === null ? 'default' : `${a.ratePct}%`}</button>
                  <button type="button" onClick={() => { const v = window.prompt(`Coupon code that credits ${a.name} (for example a code they give their audience). Orders that use it are attributed to them when no link cookie is present. Blank removes it:`, a.couponCode); if (v !== null) void post({ action: 'coupon', id: a.id, coupon: v }, 'Coupon saved.') }}>Coupon: {a.couponCode || 'none'}</button>
                  <button type="button" onClick={() => void copyKit(a)}>Copy share kit</button>
                  <button type="button" onClick={() => void dashboardLink(a)}>Copy dashboard link</button>
                  <button type="button" onClick={() => navigator.clipboard?.writeText(link(a.code)).then(() => setMessage('Link copied.')).catch((): void => undefined)}>Copy link</button>
                  <button type="button" onClick={() => { if (window.confirm(`Delete ${a.name} and their visit log?`)) void post({ action: 'delete', id: a.id }) }}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {commissions.length > 0 && (
        <section>
          <h2>Recent commissions</h2>
          <table>
            <thead>
              <tr><th scope="col">Order</th><th scope="col">Affiliate</th><th scope="col">Amount</th><th scope="col">Status</th><th scope="col">Payable from</th></tr>
            </thead>
            <tbody>
              {commissions.map((c) => (
                <tr key={c.id}>
                  <td>#{c.order_id}</td>
                  <td>{nameOf(c.affiliate_id)}</td>
                  <td>{money(c.amount_cents)}</td>
                  <td>{c.status}</td>
                  <td>{c.eligible_at ? c.eligible_at.slice(0, 10) : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {payouts.length > 0 && (
        <section>
          <h2>Payouts recorded</h2>
          <p><a href="/api/admin-affiliates?export=payouts">Download payouts as CSV</a></p>
          <table>
            <thead>
              <tr><th scope="col">Date</th><th scope="col">Affiliate</th><th scope="col">Amount</th><th scope="col">Note</th></tr>
            </thead>
            <tbody>
              {payouts.map((p) => (
                <tr key={p.id}><td>{p.createdAt.slice(0, 10)}</td><td>{nameOf(p.affiliateId)}</td><td>{money(p.amountCents)}</td><td>{p.note}</td></tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  )
}
