'use client'

import React, { useCallback, useEffect, useState } from 'react'

import type { ApplicationRow, TaggedCustomer } from '../server/wholesale'

/** Admin screen: wholesale applications to approve or reject, and customer tags. English only. */
export const WholesalePanel: React.FC = () => {
  const [applications, setApplications] = useState<ApplicationRow[]>([])
  const [tagged, setTagged] = useState<TaggedCustomer[]>([])
  const [email, setEmail] = useState('')
  const [tags, setTags] = useState('')
  const [message, setMessage] = useState('')

  const load = useCallback(async () => {
    const res = await fetch('/api/admin-wholesale')
    const data = (await res.json().catch((): null => null)) as { applications?: ApplicationRow[]; tagged?: TaggedCustomer[]; error?: string } | null
    if (!res.ok) return setMessage(data?.error ?? 'Could not load wholesale accounts.')
    setApplications(data?.applications ?? [])
    setTagged(data?.tagged ?? [])
  }, [])
  useEffect(() => {
    void load()
  }, [load])

  const post = async (body: Record<string, unknown>, ok: string): Promise<boolean> => {
    const res = await fetch('/api/admin-wholesale', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const data = (await res.json().catch((): null => null)) as { error?: string; companyCreated?: boolean } | null
    if (!res.ok) {
      setMessage(data?.error ?? 'That did not work.')
      return false
    }
    setMessage(body.action === 'approve' && data?.companyCreated === false ? `${ok} A company account could not be created; add one from Companies.` : ok)
    await load()
    return true
  }

  const pending = applications.filter((a) => a.status === 'pending')
  const decided = applications.filter((a) => a.status !== 'pending')
  return (
    <div style={{ display: 'grid', gap: '2rem' }}>
      {message && <p role="status">{message}</p>}
      <section>
        <h2>Applications waiting</h2>
        {pending.length === 0 ? (
          <p>No applications waiting.</p>
        ) : (
          <table>
            <thead>
              <tr><th scope="col">Company</th><th scope="col">Account</th><th scope="col">Tax number</th><th scope="col">Phone</th><th scope="col">Message</th><th scope="col">Applied</th><th scope="col"><span className="visually-hidden">Decide</span></th></tr>
            </thead>
            <tbody>
              {pending.map((a) => (
                <tr key={a.userId}>
                  <td>{a.company}</td><td>{a.email}</td><td>{a.taxId}</td><td>{a.phone}</td><td>{a.message}</td><td>{a.appliedAt.slice(0, 10)}</td>
                  <td>
                    <button type="button" onClick={() => void post({ action: 'approve', userId: a.userId }, 'Approved.')}>Approve</button>{' '}
                    <button type="button" onClick={() => void post({ action: 'reject', userId: a.userId }, 'Rejected.')}>Reject</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
      <section>
        <h2>Decided</h2>
        {decided.length === 0 ? (
          <p>Nothing decided yet.</p>
        ) : (
          <table>
            <thead>
              <tr><th scope="col">Company</th><th scope="col">Account</th><th scope="col">Status</th><th scope="col">Decided</th><th scope="col">By</th><th scope="col"><span className="visually-hidden">Change</span></th></tr>
            </thead>
            <tbody>
              {decided.map((a) => (
                <tr key={a.userId}>
                  <td>{a.company}</td><td>{a.email}</td><td>{a.status}</td><td>{a.decidedAt?.slice(0, 10)}</td><td>{a.decidedBy}</td>
                  <td>
                    {a.status === 'approved' ? <button type="button" onClick={() => void post({ action: 'reject', userId: a.userId }, 'Wholesale access removed.')}>Remove access</button> : <button type="button" onClick={() => void post({ action: 'approve', userId: a.userId }, 'Approved.')}>Approve</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
      <section>
        <h2>Customer tags</h2>
        <p>Tags group customers for pricing rules (condition “Customers with a tag”) and price tiers (customer type <code>tag:vip</code>). Enter the tags as a comma separated list; saving replaces the customer's tags.</p>
        <form
          onSubmit={async (e) => {
            e.preventDefault()
            if (await post({ action: 'tags', email, tags }, 'Tags saved.')) {
              setEmail('')
              setTags('')
            }
          }}
          style={{ display: 'grid', gap: '0.75rem', maxWidth: '32rem' }}
        >
          <label>Customer email<br /><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
          <label>Tags<br /><input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="vip, stockist" /></label>
          <button type="submit">Save tags</button>
        </form>
        {tagged.length === 0 ? (
          <p>No customers have tags.</p>
        ) : (
          <table>
            <thead><tr><th scope="col">Customer</th><th scope="col">Tags</th><th scope="col"><span className="visually-hidden">Edit</span></th></tr></thead>
            <tbody>
              {tagged.map((c) => (
                <tr key={c.userId}>
                  <td>{c.email || `#${c.userId}`}</td><td>{c.tags.join(', ')}</td>
                  <td><button type="button" onClick={() => { setEmail(c.email); setTags(c.tags.join(', ')) }}>Edit</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  )
}
