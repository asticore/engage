'use client'

import React, { useCallback, useEffect, useState } from 'react'

import { useAdminT } from '@/admin/i18n/AdminUiProvider'
import type { ApplicationRow, TaggedCustomer } from '../server/wholesale'

/** Admin screen: wholesale applications to approve or reject, and customer tags. Text follows the admin language. */
export const WholesalePanel: React.FC<{ denied?: boolean }> = ({ denied = false }) => {
  const t = useAdminT()
  const [applications, setApplications] = useState<ApplicationRow[]>([])
  const [tagged, setTagged] = useState<TaggedCustomer[]>([])
  const [email, setEmail] = useState('')
  const [tags, setTags] = useState('')
  const [message, setMessage] = useState('')

  const load = useCallback(async () => {
    const res = await fetch('/api/admin-wholesale')
    const data = (await res.json().catch((): null => null)) as { applications?: ApplicationRow[]; tagged?: TaggedCustomer[]; error?: string } | null
    if (!res.ok) return setMessage(data?.error ?? t('wholesale.loadError'))
    setApplications(data?.applications ?? [])
    setTagged(data?.tagged ?? [])
  }, [t])
  useEffect(() => {
    void load()
  }, [load])

  const post = async (body: Record<string, unknown>, ok: string): Promise<boolean> => {
    const res = await fetch('/api/admin-wholesale', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const data = (await res.json().catch((): null => null)) as { error?: string; companyCreated?: boolean } | null
    if (!res.ok) {
      setMessage(data?.error ?? t('wholesale.failed'))
      return false
    }
    setMessage(body.action === 'approve' && data?.companyCreated === false ? `${ok} ${t('wholesale.companyFailed')}` : ok)
    await load()
    return true
  }

  if (denied) return <p>{t('wholesale.adminOnly')}</p>
  const pending = applications.filter((a) => a.status === 'pending')
  const decided = applications.filter((a) => a.status !== 'pending')
  return (
    <div className="settings-page">
      <div className="settings-page__header">
        <h1 className="settings-page__title">{t('wholesale.title')}</h1>
        <p className="settings-page__description">{t('wholesale.description')}</p>
      </div>
    <div style={{ display: 'grid', gap: '2rem' }}>
      {message && <p role="status">{message}</p>}
      <section>
        <h2>{t('wholesale.waiting')}</h2>
        {pending.length === 0 ? (
          <p>{t('wholesale.noneWaiting')}</p>
        ) : (
          <table>
            <thead>
              <tr><th scope="col">{t('wholesale.col.company')}</th><th scope="col">{t('wholesale.col.account')}</th><th scope="col">{t('wholesale.col.taxId')}</th><th scope="col">{t('wholesale.col.phone')}</th><th scope="col">{t('wholesale.col.message')}</th><th scope="col">{t('wholesale.col.applied')}</th><th scope="col"><span className="visually-hidden">{t('wholesale.edit')}</span></th></tr>
            </thead>
            <tbody>
              {pending.map((a) => (
                <tr key={a.userId}>
                  <td>{a.company}</td><td>{a.email}</td><td>{a.taxId}</td><td>{a.phone}</td><td>{a.message}</td><td>{a.appliedAt.slice(0, 10)}</td>
                  <td>
                    <button type="button" onClick={() => void post({ action: 'approve', userId: a.userId }, t('wholesale.approvedMsg'))}>{t('wholesale.approve')}</button>{' '}
                    <button type="button" onClick={() => void post({ action: 'reject', userId: a.userId }, t('wholesale.rejectedMsg'))}>{t('wholesale.reject')}</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
      <section>
        <h2>{t('wholesale.decided')}</h2>
        {decided.length === 0 ? (
          <p>{t('wholesale.nothingDecided')}</p>
        ) : (
          <table>
            <thead>
              <tr><th scope="col">{t('wholesale.col.company')}</th><th scope="col">{t('wholesale.col.account')}</th><th scope="col">{t('wholesale.col.status')}</th><th scope="col">{t('wholesale.col.decided')}</th><th scope="col">{t('wholesale.col.by')}</th><th scope="col"><span className="visually-hidden">{t('wholesale.edit')}</span></th></tr>
            </thead>
            <tbody>
              {decided.map((a) => (
                <tr key={a.userId}>
                  <td>{a.company}</td><td>{a.email}</td><td>{a.status === 'approved' ? t('wholesale.status.approved') : t('wholesale.status.rejected')}</td><td>{a.decidedAt?.slice(0, 10)}</td><td>{a.decidedBy}</td>
                  <td>
                    {a.status === 'approved' ? <button type="button" onClick={() => void post({ action: 'reject', userId: a.userId }, t('wholesale.accessRemoved'))}>{t('wholesale.removeAccess')}</button> : <button type="button" onClick={() => void post({ action: 'approve', userId: a.userId }, t('wholesale.approvedMsg'))}>{t('wholesale.approve')}</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
      <section>
        <h2>{t('wholesale.tags.heading')}</h2>
        <p>{t('wholesale.tags.help')}</p>
        <form
          onSubmit={async (e) => {
            e.preventDefault()
            if (await post({ action: 'tags', email, tags }, t('wholesale.tags.saved'))) {
              setEmail('')
              setTags('')
            }
          }}
          style={{ display: 'grid', gap: '0.75rem', maxWidth: '32rem' }}
        >
          <label>{t('wholesale.tags.email')}<br /><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
          <label>{t('wholesale.tags.label')}<br /><input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="vip, stockist" /></label>
          <button type="submit">{t('wholesale.tags.save')}</button>
        </form>
        {tagged.length === 0 ? (
          <p>{t('wholesale.tags.none')}</p>
        ) : (
          <table>
            <thead><tr><th scope="col">{t('wholesale.col.customer')}</th><th scope="col">{t('wholesale.col.tags')}</th><th scope="col"><span className="visually-hidden">{t('wholesale.edit')}</span></th></tr></thead>
            <tbody>
              {tagged.map((c) => (
                <tr key={c.userId}>
                  <td>{c.email || `#${c.userId}`}</td><td>{c.tags.join(', ')}</td>
                  <td><button type="button" onClick={() => { setEmail(c.email); setTags(c.tags.join(', ')) }}>{t('wholesale.edit')}</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
    </div>
  )
}
