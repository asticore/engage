'use client'

import React, { useEffect, useMemo, useState } from 'react'

import {
  addDays, dateOf, dayKeyIn, eventsOnDay, filterEvents, formatTime, googleCalendarUrl, keyOf, monthGrid, weekStart,
  type CalEvent, type CalView,
} from '@/features/calendar/model'

import './calendar.css'

export type CalendarClientProps = {
  events: CalEvent[]
  views: CalView[]
  defaultView: CalView
  firstDay: number
  hour12: boolean
  timeZone: string
  density: 'compact' | 'comfortable'
  showFilters: boolean
  colorByCategory: boolean
  feedUrl: string
  /** YYYY-MM-DD the calendar opens on. */
  today: string
}

const VIEW_LABEL: Record<CalView, string> = { month: 'Month', week: 'Week', day: 'Day', agenda: 'Agenda', list: 'List' }

export function CalendarClient(p: CalendarClientProps): React.ReactElement {
  const [view, setView] = useState<CalView>(p.views.includes(p.defaultView) ? p.defaultView : p.views[0] ?? 'month')
  const [today, setToday] = useState(p.today)
  const [origin, setOrigin] = useState('')
  const [cursor, setCursor] = useState(p.today)
  // The page may be a static snapshot, so today's date and the site address are read in the browser.
  useEffect(() => {
    const t = dayKeyIn(new Date().toISOString(), p.timeZone || undefined)
    if (t) {
      setToday(t)
      setCursor(t)
    }
    setOrigin(window.location.origin)
  }, [p.timeZone])
  const [category, setCategory] = useState('')
  const [tag, setTag] = useState('')
  const [open, setOpen] = useState<CalEvent | null>(null)

  const categories = useMemo(() => [...new Set(p.events.map((e) => e.category))].sort(), [p.events])
  const tags = useMemo(() => [...new Set(p.events.flatMap((e) => e.tags))].sort().slice(0, 20), [p.events])
  const events = useMemo(() => filterEvents(p.events, { category, tag }), [p.events, category, tag])
  const tz = p.timeZone || undefined
  const dayLabel = (key: string, o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(undefined, { ...o, timeZone: 'UTC' }).format(dateOf(key))
  const time = (iso: string) => formatTime(iso, { hour12: p.hour12, timeZone: tz })

  const step = (dir: number) => {
    const d = dateOf(cursor)
    if (view === 'month') setCursor(keyOf(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + dir, 1))))
    else if (view === 'week') setCursor(addDays(cursor, 7 * dir))
    else setCursor(addDays(cursor, dir))
  }
  const title = view === 'month' ? dayLabel(cursor, { month: 'long', year: 'numeric' }) : view === 'week' ? `${dayLabel(weekStart(cursor, p.firstDay), { month: 'short', day: 'numeric' })} - ${dayLabel(addDays(weekStart(cursor, p.firstDay), 6), { month: 'short', day: 'numeric', year: 'numeric' })}` : view === 'day' ? dayLabel(cursor, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) : 'Upcoming'

  const chip = (e: CalEvent) => (
    <button key={e.id + e.start} type="button" className="be-cal__chip" style={p.colorByCategory && e.color ? ({ '--cal-ev': e.color } as React.CSSProperties) : undefined} onClick={() => setOpen(e)}>
      <span className="be-cal__chip-time">{time(e.start)}</span> {e.title}
    </button>
  )

  const weekdayHeads = Array.from({ length: 7 }, (_, i) => dayLabel(addDays(weekStart('2026-01-04', p.firstDay), i), { weekday: 'short' }))

  const body = (() => {
    if (view === 'month') {
      const d = dateOf(cursor)
      const rows = monthGrid(d.getUTCFullYear(), d.getUTCMonth(), p.firstDay)
      return (
        <div className="be-cal__month" role="grid">
          {weekdayHeads.map((h) => <div key={h} className="be-cal__head" role="columnheader">{h}</div>)}
          {rows.flat().map((day) => {
            const list = eventsOnDay(events, day, tz)
            return (
              <div key={day} className={`be-cal__cell${dateOf(day).getUTCMonth() !== d.getUTCMonth() ? ' be-cal__cell--out' : ''}${day === today ? ' be-cal__cell--today' : ''}`} role="gridcell">
                <span className="be-cal__num">{dateOf(day).getUTCDate()}</span>
                {list.slice(0, 3).map(chip)}
                {list.length > 3 ? <button type="button" className="be-cal__more" onClick={() => { setCursor(day); setView(p.views.includes('day') ? 'day' : 'agenda') }}>{`+${list.length - 3} more`}</button> : null}
              </div>
            )
          })}
        </div>
      )
    }
    if (view === 'week') {
      const start = weekStart(cursor, p.firstDay)
      return (
        <div className="be-cal__week">
          {Array.from({ length: 7 }, (_, i) => addDays(start, i)).map((day) => (
            <div key={day} className={`be-cal__col${day === today ? ' be-cal__cell--today' : ''}`}>
              <strong className="be-cal__colhead">{dayLabel(day, { weekday: 'short', day: 'numeric' })}</strong>
              {eventsOnDay(events, day, tz).map(chip)}
            </div>
          ))}
        </div>
      )
    }
    if (view === 'day') {
      const list = eventsOnDay(events, cursor, tz)
      return <div className="be-cal__daylist">{list.length ? list.map(chip) : <p className="be-cal__empty">Nothing on this day.</p>}</div>
    }
    // agenda and list: upcoming events grouped by day (list is flat, agenda groups).
    const upcoming = events.filter((e) => dayKeyIn(e.end, tz) >= cursor || dayKeyIn(e.start, tz) >= cursor)
    if (!upcoming.length) return <p className="be-cal__empty">No upcoming events.</p>
    if (view === 'list') {
      return (
        <ul className="be-cal__list">
          {upcoming.map((e) => (
            <li key={e.id + e.start}>
              <button type="button" className="be-cal__row" style={p.colorByCategory && e.color ? ({ '--cal-ev': e.color } as React.CSSProperties) : undefined} onClick={() => setOpen(e)}>
                <time dateTime={e.start}>{dayLabel(dayKeyIn(e.start, tz), { month: 'short', day: 'numeric' })} {time(e.start)}</time>
                <span>{e.title}</span>
              </button>
            </li>
          ))}
        </ul>
      )
    }
    const days = [...new Set(upcoming.map((e) => dayKeyIn(e.start, tz)))].slice(0, 30)
    return (
      <div className="be-cal__agenda">
        {days.map((day) => (
          <section key={day}>
            <h3 className="be-cal__agenda-day">{dayLabel(day, { weekday: 'long', month: 'long', day: 'numeric' })}</h3>
            {upcoming.filter((e) => dayKeyIn(e.start, tz) === day).map(chip)}
          </section>
        ))}
      </div>
    )
  })()

  return (
    <div className={`be-cal be-cal--${p.density}`}>
      <div className="be-cal__bar">
        <div className="be-cal__nav">
          <button type="button" onClick={() => step(-1)} aria-label="Previous">&lsaquo;</button>
          <button type="button" onClick={() => setCursor(today)}>Today</button>
          <button type="button" onClick={() => step(1)} aria-label="Next">&rsaquo;</button>
        </div>
        <h2 className="be-cal__title" aria-live="polite">{title}</h2>
        {p.views.length > 1 ? (
          <div className="be-cal__views" role="group" aria-label="Calendar view">
            {p.views.map((v) => <button key={v} type="button" aria-pressed={v === view} onClick={() => setView(v)}>{VIEW_LABEL[v]}</button>)}
          </div>
        ) : null}
      </div>
      {p.showFilters && (categories.length > 1 || tags.length > 0) ? (
        <div className="be-cal__filters">
          {categories.length > 1 ? (
            <label>Category <select value={category} onChange={(e) => setCategory(e.target.value)}><option value="">All</option>{categories.map((c) => <option key={c} value={c}>{c}</option>)}</select></label>
          ) : null}
          {tags.length ? (
            <label>Tag <select value={tag} onChange={(e) => setTag(e.target.value)}><option value="">All</option>{tags.map((t) => <option key={t} value={t}>{`#${t}`}</option>)}</select></label>
          ) : null}
        </div>
      ) : null}
      {body}
      {p.feedUrl ? <p className="be-cal__sub"><a href={p.feedUrl}>Subscribe to this calendar</a></p> : null}
      {open ? (
        <div className="be-cal__modal" role="dialog" aria-modal="true" aria-label={open.title} onClick={(e) => { if (e.target === e.currentTarget) setOpen(null) }}>
          <div className="be-cal__card">
            <button type="button" className="be-cal__close" aria-label="Close" onClick={() => setOpen(null)}>&times;</button>
            {open.image ? <img src={open.image} alt="" loading="lazy" className="be-cal__img" /> : null}
            <h3>{open.title}</h3>
            <p><time dateTime={open.start}>{dayLabel(dayKeyIn(open.start, tz), { weekday: 'long', month: 'long', day: 'numeric' })}, {time(open.start)}</time>{open.end !== open.start ? ` - ${time(open.end)}` : ''}</p>
            {open.venue || open.online ? <p>{open.online ? 'Online' : open.venue}{open.online && open.venue ? `, ${open.venue}` : ''}{open.venue ? <> (<a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(open.venue)}`} target="_blank" rel="noopener noreferrer">map</a>)</> : null}</p> : null}
            {open.summary ? <p>{open.summary}</p> : null}
            <p className="be-cal__actions">
              <a href={`/events/${open.slug}`}>Details{open.paid ? ' and tickets' : ' and RSVP'}</a>
              <a href={googleCalendarUrl(open, origin)} target="_blank" rel="noopener noreferrer">Add to Google</a>
              <a href={`/api/events/${open.slug}/ics`}>Add to calendar (ICS)</a>
            </p>
          </div>
        </div>
      ) : null}
    </div>
  )
}
