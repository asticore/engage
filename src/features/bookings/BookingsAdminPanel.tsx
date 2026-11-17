'use client'

import { useCallback, useEffect, useState } from 'react'

type Override = { id: number; date: string; kind: 'open' | 'closed'; start: string | null; end: string | null; note: string }
type Resource = { id: number; title: string; timeZone: string; active: boolean; hours: string; overrides: Override[] }
type BType = { id: number; title: string; slug: string; description: string; resourceId: number | null; locationText: string; active: boolean; durationMinutes: number; stepMinutes: number; bufferBeforeMinutes: number; bufferAfterMinutes: number; minNoticeMinutes: number; maxAdvanceDays: number; capacity: number; priceCents: number; refundHours: number }
type Booking = { id: number; number: string; typeId: number; status: string; startAt: string; timeZone: string; customerName: string; customerEmail: string; customerPhone: string; notes: string }

const blankType = { id: 0, title: '', slug: '', description: '', resourceId: null as number | null, locationText: '', active: true, durationMinutes: 30, stepMinutes: 30, bufferBeforeMinutes: 0, bufferAfterMinutes: 0, minNoticeMinutes: 60, maxAdvanceDays: 60, capacity: 1, priceCents: 0, refundHours: 24 }

/** Booking types, the people or places that are booked with their weekly hours, and the bookings made. */
export function BookingsAdminPanel() {
  const [data, setData] = useState<{ resources: Resource[]; types: BType[]; bookings: Booking[] } | null>(null)
  const [message, setMessage] = useState('')
  const [type, setType] = useState(blankType)
  const [resourceName, setResourceName] = useState('')
  const [resourceZone, setResourceZone] = useState('Australia/Sydney')
  const [hours, setHours] = useState<Record<number, string>>({})
  const [override, setOverride] = useState({ resourceId: 0, date: '', kind: 'closed', start: '', end: '', note: '' })
  const [filter, setFilter] = useState('')

  const load = useCallback(async (): Promise<void> => {
    const res = await fetch(`/api/admin-bookings${filter ? `?status=${filter}` : ''}`)
    const body = (await res.json().catch(() => ({}))) as { resources?: Resource[]; types?: BType[]; bookings?: Booking[]; error?: string }
    if (!res.ok) {
      setMessage(body.error ?? 'Could not load bookings.')
      return
    }
    setData({ resources: body.resources ?? [], types: body.types ?? [], bookings: body.bookings ?? [] })
    setHours(Object.fromEntries((body.resources ?? []).map((r) => [r.id, r.hours])))
  }, [filter])
  useEffect(() => {
    void load()
  }, [load])

  const post = async (payload: Record<string, unknown>, okText = ''): Promise<boolean> => {
    setMessage('')
    const res = await fetch('/api/admin-bookings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    const body = (await res.json().catch(() => ({}))) as { error?: string }
    if (!res.ok) {
      setMessage(body.error ?? 'That did not work.')
      return false
    }
    if (okText) setMessage(okText)
    await load()
    return true
  }

  if (!data) return message ? <p role="alert" className="badge">{message}</p> : <p>Loading…</p>
  const origin = typeof window === 'undefined' ? '' : window.location.origin
  const num = (key: keyof typeof blankType, label: string) => (
    <label className="field">{label}<input className="input" type="number" min={0} value={type[key] as number} onChange={(e) => setType({ ...type, [key]: Number(e.target.value) })} /></label>
  )

  return (
    <div className="stack">
      {message ? <p role="alert" className="badge">{message}</p> : null}

      <h2>People and places</h2>
      <p className="text-muted">Who or what is booked. Opening times are in that place&apos;s time zone.</p>
      {data.resources.map((r) => (
        <div key={r.id} className="card">
          <div className="card-body stack">
            <strong>{r.title}{r.active ? '' : ' (off)'} <span className="text-muted">{r.timeZone}</span></strong>
            <label className="field">Weekly hours, one line each, like &quot;mon-fri 09:00-17:00&quot;
              <textarea className="input" rows={4} value={hours[r.id] ?? ''} onChange={(e) => setHours({ ...hours, [r.id]: e.target.value })} />
            </label>
            <div className="cluster">
              <button type="button" className="btn" onClick={() => void post({ action: 'setHours', id: r.id, hours: hours[r.id] ?? '' }, 'Hours saved.')}>Save hours</button>
              <button type="button" className="btn" onClick={() => void post({ action: 'saveResource', id: r.id, title: r.title, timeZone: r.timeZone, active: !r.active })}>{r.active ? 'Turn off' : 'Turn on'}</button>
              <button type="button" className="btn" onClick={() => void post({ action: 'deleteResource', id: r.id })}>Delete</button>
            </div>
            {r.overrides.map((o) => (
              <p key={o.id} className="text-muted">{o.date}: {o.kind === 'closed' ? 'closed' : 'open'}{o.start ? ` ${o.start}-${o.end}` : ''}{o.note ? ` (${o.note})` : ''} <button type="button" className="btn" onClick={() => void post({ action: 'deleteOverride', id: o.id })}>Remove</button></p>
            ))}
          </div>
        </div>
      ))}
      <div className="cluster">
        <label className="field">Name<input className="input" value={resourceName} onChange={(e) => setResourceName(e.target.value)} /></label>
        <label className="field">Time zone<input className="input" value={resourceZone} onChange={(e) => setResourceZone(e.target.value)} /></label>
        <button type="button" className="btn" onClick={() => void post({ action: 'saveResource', title: resourceName, timeZone: resourceZone }).then((ok) => { if (ok) setResourceName('') })}>Add person or place</button>
      </div>
      <div className="cluster">
        <label className="field">Change a day for
          <select className="input" value={override.resourceId} onChange={(e) => setOverride({ ...override, resourceId: Number(e.target.value) })}>
            <option value={0}>Pick…</option>
            {data.resources.map((r) => <option key={r.id} value={r.id}>{r.title}</option>)}
          </select>
        </label>
        <label className="field">Date<input className="input" type="date" value={override.date} onChange={(e) => setOverride({ ...override, date: e.target.value })} /></label>
        <label className="field">
          <select className="input" value={override.kind} onChange={(e) => setOverride({ ...override, kind: e.target.value })}>
            <option value="closed">Closed (blank times: all day)</option>
            <option value="open">Open extra hours</option>
          </select>
        </label>
        <label className="field">From<input className="input" placeholder="12:00" value={override.start} onChange={(e) => setOverride({ ...override, start: e.target.value })} /></label>
        <label className="field">To<input className="input" placeholder="13:00" value={override.end} onChange={(e) => setOverride({ ...override, end: e.target.value })} /></label>
        <label className="field">Note<input className="input" value={override.note} onChange={(e) => setOverride({ ...override, note: e.target.value })} /></label>
        <button type="button" className="btn" onClick={() => void post({ action: 'addOverride', ...override })}>Add</button>
      </div>

      <h2>Booking types</h2>
      {data.types.map((t) => (
        <div key={t.id} className="card">
          <div className="card-body stack">
            <strong>{t.title}{t.active ? '' : ' (off)'}</strong>
            <p className="text-muted">{t.durationMinutes} minutes. Booking page: <a href={`${origin}/book/${t.slug}`}>{origin}/book/{t.slug}</a></p>
            <div className="cluster">
              <button type="button" className="btn" onClick={() => setType({ ...t })}>Edit</button>
              <button type="button" className="btn" onClick={() => void post({ action: 'deleteType', id: t.id })}>Delete</button>
            </div>
          </div>
        </div>
      ))}
      <div className="card">
        <div className="card-body stack">
          <strong>{type.id ? 'Edit booking type' : 'Add a booking type'}</strong>
          <div className="cluster">
            <label className="field">Name<input className="input" value={type.title} onChange={(e) => setType({ ...type, title: e.target.value })} /></label>
            <label className="field">Page address (blank: from the name)<input className="input" value={type.slug} onChange={(e) => setType({ ...type, slug: e.target.value })} /></label>
            <label className="field">Booked with
              <select className="input" value={type.resourceId ?? 0} onChange={(e) => setType({ ...type, resourceId: Number(e.target.value) || null })}>
                <option value={0}>Pick…</option>
                {data.resources.map((r) => <option key={r.id} value={r.id}>{r.title}</option>)}
              </select>
            </label>
          </div>
          <label className="field">Description<textarea className="input" rows={2} value={type.description} onChange={(e) => setType({ ...type, description: e.target.value })} /></label>
          <label className="field">Where (address or &quot;video call&quot;)<input className="input" value={type.locationText} onChange={(e) => setType({ ...type, locationText: e.target.value })} /></label>
          <div className="cluster">
            {num('durationMinutes', 'Length (minutes)')}
            {num('stepMinutes', 'Start times every (minutes)')}
            {num('bufferBeforeMinutes', 'Gap before (minutes)')}
            {num('bufferAfterMinutes', 'Gap after (minutes)')}
            {num('minNoticeMinutes', 'Least notice (minutes)')}
            {num('maxAdvanceDays', 'Book up to (days ahead)')}
            {num('capacity', 'People per time')}
            {num('priceCents', 'Price in cents (0 is free)')}
            {num('refundHours', 'Full refund if cancelled this many hours before')}
          </div>
          <label className="field"><span><input type="checkbox" checked={type.active} onChange={(e) => setType({ ...type, active: e.target.checked })} /> Taking bookings</span></label>
          <div className="cluster">
            <button type="button" className="btn" onClick={() => void post({ action: 'saveType', ...type, id: type.id || undefined }, 'Saved.').then((ok) => { if (ok) setType(blankType) })}>{type.id ? 'Save changes' : 'Add booking type'}</button>
            {type.id ? <button type="button" className="btn" onClick={() => setType(blankType)}>Cancel</button> : null}
          </div>
        </div>
      </div>

      <h2>Bookings</h2>
      <label className="field">Show
        <select className="input" value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="">All</option>
          <option value="pending_payment">Waiting for payment</option>
          <option value="confirmed">Confirmed</option>
          <option value="completed">Completed</option>
          <option value="no_show">No show</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </label>
      {data.bookings.length === 0 ? <p className="text-muted">No bookings yet.</p> : (
        <table className="table">
          <thead><tr><th>When</th><th>Type</th><th>Customer</th><th>Status</th><th /></tr></thead>
          <tbody>
            {data.bookings.map((b) => (
              <tr key={b.id}>
                <td>{new Intl.DateTimeFormat('en-AU', { dateStyle: 'medium', timeStyle: 'short', timeZone: b.timeZone }).format(new Date(b.startAt))}</td>
                <td>{data.types.find((t) => t.id === b.typeId)?.title ?? ''}</td>
                <td>{b.customerName}<br />{b.customerEmail}{b.customerPhone ? ` ${b.customerPhone}` : ''}{b.notes ? <><br />{b.notes}</> : null}</td>
                <td>{b.status.replace('_', ' ')}</td>
                <td>
                  {b.status === 'confirmed' ? (
                    <div className="cluster">
                      <button type="button" className="btn" onClick={() => void post({ action: 'setStatus', id: b.id, status: 'completed' })}>Completed</button>
                      <button type="button" className="btn" onClick={() => void post({ action: 'setStatus', id: b.id, status: 'no_show' })}>No show</button>
                      <button type="button" className="btn" onClick={() => void post({ action: 'setStatus', id: b.id, status: 'cancelled' })}>Cancel</button>
                    </div>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
