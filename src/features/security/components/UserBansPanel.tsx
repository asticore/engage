'use client'

import React, { useCallback, useEffect, useState } from 'react'

import type { BanRow } from '../userBans'

/** Admin screen to ban and unban sign-ins. English only. */
export const UserBansPanel: React.FC = () => {
  const [bans, setBans] = useState<BanRow[]>([])
  const [email, setEmail] = useState('')
  const [reason, setReason] = useState('')
  const [days, setDays] = useState('')
  const [message, setMessage] = useState('')

  const load = useCallback(async () => {
    const res = await fetch('/api/admin-user-bans')
    const data = (await res.json().catch((): null => null)) as { bans?: BanRow[]; error?: string } | null
    if (!res.ok) return setMessage(data?.error ?? 'Could not load bans.')
    setBans(data?.bans ?? [])
  }, [])
  useEffect(() => {
    void load()
  }, [load])

  const post = async (body: Record<string, unknown>, ok: string): Promise<boolean> => {
    const res = await fetch('/api/admin-user-bans', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const data = (await res.json().catch((): null => null)) as { error?: string } | null
    if (!res.ok) {
      setMessage(data?.error ?? 'That did not work.')
      return false
    }
    setMessage(ok)
    await load()
    return true
  }

  return (
    <div style={{ display: 'grid', gap: '1.5rem' }}>
      {message && <p role="status">{message}</p>}
      <p>A banned person is signed out at once and sees only “This account cannot sign in.” The reason below is for your team and is never shown to them. A ban with a number of days lifts itself when the days are up; leave days empty for a permanent ban.</p>
      <form
        onSubmit={async (e) => {
          e.preventDefault()
          if (await post({ action: 'ban', email, reason, days }, 'Banned.')) {
            setEmail('')
            setReason('')
            setDays('')
          }
        }}
        style={{ display: 'grid', gap: '0.75rem', maxWidth: '32rem' }}
      >
        <label>Account email<br /><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
        <label>Reason (only your team sees it)<br /><input value={reason} maxLength={300} onChange={(e) => setReason(e.target.value)} /></label>
        <label>Lift automatically after this many days (optional)<br /><input type="number" min={1} max={3650} value={days} onChange={(e) => setDays(e.target.value)} /></label>
        <button type="submit">Ban this account</button>
      </form>
      {bans.length === 0 ? (
        <p>No banned accounts.</p>
      ) : (
        <table>
          <thead>
            <tr><th scope="col">Account</th><th scope="col">Reason</th><th scope="col">Banned</th><th scope="col">Lifts</th><th scope="col"><span className="visually-hidden">Unban</span></th></tr>
          </thead>
          <tbody>
            {bans.map((b) => (
              <tr key={b.userId}>
                <td>{b.email || `#${b.userId}`}</td>
                <td>{b.reason}</td>
                <td>{b.bannedAt.slice(0, 10)}</td>
                <td>{b.expiresAt ? b.expiresAt.slice(0, 10) : 'never'}</td>
                <td><button type="button" onClick={() => void post({ action: 'unban', userId: b.userId }, 'Unbanned.')}>Unban</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
