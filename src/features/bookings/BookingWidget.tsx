'use client'

import { useEffect, useState } from 'react'

type Day = { date: string; slots: { start: string; local: string }[] }
type Data = { type: { title: string; description: string; durationMinutes: number; locationText: string }; timeZone: string; days: Day[] }

const dayLabel = (date: string): string => new Intl.DateTimeFormat('en-AU', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${date}T00:00:00Z`))

/** Pick a day, pick a time, give your details. The times come from the server and are checked again when you book. */
export function BookingWidget({ slug }: { slug: string }) {
  const [data, setData] = useState<Data | null>(null)
  const [error, setError] = useState('')
  const [date, setDate] = useState('')
  const [start, setStart] = useState('')
  const [form, setForm] = useState({ name: '', email: '', phone: '', notes: '' })
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState<{ number: string; manageUrl: string } | null>(null)

  const load = async (): Promise<void> => {
    const res = await fetch(`/api/booking-slots?type=${encodeURIComponent(slug)}&days=21`)
    const body = (await res.json().catch(() => ({}))) as Data & { error?: string }
    if (!res.ok) {
      setError(body.error ?? 'Could not load the times.')
      return
    }
    setData(body)
    setDate((current) => current || body.days.find((d) => d.slots.length > 0)?.date || body.days[0]?.date || '')
  }
  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug])

  const book = async (): Promise<void> => {
    setBusy(true)
    setError('')
    try {
      const res = await fetch('/api/booking-create', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: slug, start, ...form }) })
      const body = (await res.json().catch(() => ({}))) as { error?: string; number?: string; manageUrl?: string }
      if (!res.ok) {
        setError(body.error ?? 'That did not work.')
        if (res.status === 409) {
          setStart('')
          await load()
        }
        return
      }
      setDone({ number: body.number ?? '', manageUrl: body.manageUrl ?? '' })
    } finally {
      setBusy(false)
    }
  }

  if (done) {
    return (
      <div className="card">
        <div className="card-body stack">
          <strong>You are booked. Booking number {done.number}.</strong>
          <p>We have emailed your confirmation with a link to add it to your calendar or cancel.</p>
          {done.manageUrl ? <a className="btn" href={done.manageUrl}>Manage this booking</a> : null}
        </div>
      </div>
    )
  }
  if (!data) return error ? <p role="alert" className="badge">{error}</p> : <p>Loading times…</p>

  const day = data.days.find((d) => d.date === date)
  const zoneNote = `Times are in ${data.timeZone.replace(/_/g, ' ')}.`
  return (
    <div className="stack">
      <div>
        <h2>{data.type.title}</h2>
        <p className="text-muted">{data.type.durationMinutes} minutes{data.type.locationText ? `, ${data.type.locationText}` : ''}. {zoneNote}</p>
        {data.type.description ? <p>{data.type.description}</p> : null}
      </div>
      <div className="cluster" role="group" aria-label="Choose a day">
        {data.days.filter((d) => d.slots.length > 0).map((d) => (
          <button key={d.date} type="button" className="btn" aria-pressed={d.date === date} onClick={() => { setDate(d.date); setStart('') }}>{dayLabel(d.date)}</button>
        ))}
        {data.days.every((d) => d.slots.length === 0) ? <p>No times are free in the next three weeks.</p> : null}
      </div>
      {day && day.slots.length > 0 ? (
        <div className="cluster" role="group" aria-label="Choose a time">
          {day.slots.map((s) => <button key={s.start} type="button" className="btn" aria-pressed={s.start === start} onClick={() => setStart(s.start)}>{s.local}</button>)}
        </div>
      ) : null}
      {start ? (
        <form className="stack" onSubmit={(e) => { e.preventDefault(); void book() }}>
          <label className="field">Your name<input className="input" required autoComplete="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
          <label className="field">Email<input className="input" type="email" required autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
          <label className="field">Phone (optional)<input className="input" type="tel" autoComplete="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></label>
          <label className="field">Anything we should know (optional)<textarea className="input" rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></label>
          <button type="submit" className="btn" disabled={busy}>{busy ? 'Booking…' : 'Confirm booking'}</button>
        </form>
      ) : null}
      {error ? <p role="alert" className="badge">{error}</p> : null}
    </div>
  )
}
