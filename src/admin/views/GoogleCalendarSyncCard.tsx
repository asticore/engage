'use client'

import { useEffect, useState } from 'react'

import { CollapsibleCard } from '@/admin/components/CollapsibleCard'

type Config = { enabled: boolean; calendarId: string; rules: string; intervalMin: number; lastRunAt: string | null }
type LogRow = { at: string; level: string; message: string }

/** Two-way Google Calendar sync settings on the Google connection screen (Task 15, 34j). */
export function GoogleCalendarSyncCard({ connected }: { connected: boolean }) {
  const [config, setConfig] = useState<Config | null>(null)
  const [log, setLog] = useState<LogRow[]>([])
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  const load = async () => {
    try {
      const res = await fetch('/api/admin-gcal-sync', { cache: 'no-store' })
      if (!res.ok) return
      const data = (await res.json()) as { config: Config; log: LogRow[] }
      setConfig(data.config)
      setLog(data.log)
    } catch {
      setMessage('Could not load the sync settings.')
    }
  }
  useEffect(() => {
    void load()
  }, [])

  const post = async (payload: Record<string, unknown>) => {
    setBusy(true)
    setMessage('')
    try {
      const res = await fetch('/api/admin-gcal-sync', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      const data = (await res.json()) as { ok?: boolean; message?: string; result?: Record<string, number> }
      if (payload.action === 'save') setMessage(data.ok ? 'Saved.' : 'Could not save.')
      else if (payload.action === 'test') setMessage(data.message ?? '')
      else if (data.result) setMessage(`Synced. From Google: ${data.result.pulledNew + data.result.pulledChanged + data.result.pulledDeleted}. To Google: ${data.result.pushedNew + data.result.pushedChanged + data.result.pushedDeleted}. Conflicts: ${data.result.conflicts}. Errors: ${data.result.errors}.`)
      await load()
    } catch {
      setMessage('The request failed. Try again.')
    } finally {
      setBusy(false)
    }
  }

  if (!config) return null
  const set = (patch: Partial<Config>) => setConfig({ ...config, ...patch })
  return (
    <CollapsibleCard id="google-connection-calendar-sync" title="Google Calendar sync">
      <p className="google-connection__text">
        Copies events both ways between your Events list and Google Calendar. If you connected Google before this was added, click Connect with Google again so the Calendar permission is granted.
      </p>
      {!connected && <p className="google-connection__help">Connect Google first.</p>}
      <label className="google-connection__label">
        <input type="checkbox" checked={config.enabled} onChange={(e) => set({ enabled: e.target.checked })} /> Sync events with Google Calendar
      </label>
      <div className="google-connection__field">
        <label htmlFor="gcal-id" className="google-connection__label">Default calendar</label>
        <input id="gcal-id" className="google-connection__input" value={config.calendarId} onChange={(e) => set({ calendarId: e.target.value })} />
        <p className="google-connection__help">Use primary, or a calendar address from Google Calendar settings.</p>
      </div>
      <div className="google-connection__field">
        <label htmlFor="gcal-rules" className="google-connection__label">Calendar per event type</label>
        <textarea id="gcal-rules" className="google-connection__input" rows={3} placeholder={'workshop | workshops@group.calendar.google.com'} value={config.rules} onChange={(e) => set({ rules: e.target.value })} />
        <p className="google-connection__help">One rule per line: a word in the event title or summary, a bar, then the calendar address. Other events use the default calendar. Events from every listed calendar are read.</p>
      </div>
      <div className="google-connection__field">
        <label htmlFor="gcal-interval" className="google-connection__label">Sync every (minutes)</label>
        <input id="gcal-interval" className="google-connection__input" type="number" min={5} max={1440} value={config.intervalMin} onChange={(e) => set({ intervalMin: Number(e.target.value) })} />
      </div>
      <p className="google-connection__help">When both sides change an event, the later edit wins and the clash is logged below. Last run: {config.lastRunAt ?? 'never'}.</p>
      <button type="button" className="btn btn--style-primary google-connection__button" disabled={busy} onClick={() => post({ action: 'save', ...config })}>Save</button>{' '}
      <button type="button" className="btn btn--style-secondary google-connection__button" disabled={busy || !connected} onClick={() => post({ action: 'test' })}>Test connection</button>{' '}
      <button type="button" className="btn btn--style-secondary google-connection__button" disabled={busy || !connected} onClick={() => post({ action: 'run' })}>Sync now</button>
      {message && <p role="status" className="google-connection__notice google-connection__notice--ok">{message}</p>}
      {log.length > 0 && (
        <ul className="google-connection__help">
          {log.map((row, i) => (
            <li key={`${row.at}-${i}`}>{row.at.slice(0, 16).replace('T', ' ')} · {row.level} · {row.message}</li>
          ))}
        </ul>
      )}
    </CollapsibleCard>
  )
}
