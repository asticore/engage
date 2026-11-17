import React from 'react'

import { cancelError } from './service'
import * as store from './store'
import { CancelAppointment } from './CancelAppointment'
import { rawD1 } from '@/features/ecommerce/server/db'

/** The signed-in customer's appointments (booking pages), upcoming first. Only call it for a confirmed email. */
export async function MyAppointments({ email }: { email: string }): Promise<React.ReactElement | null> {
  const d1 = (await rawD1().catch((): null => null)) as never as store.D1 | null
  if (!d1) return null
  const bookings = await store.listBookingsByEmail(d1, email).catch((): store.Booking[] => [])
  if (bookings.length === 0) return null
  const types = new Map<number, string>()
  for (const b of bookings) if (!types.has(b.typeId)) types.set(b.typeId, (await store.getType(d1, b.typeId).catch((): null => null))?.title ?? 'Appointment')
  const now = new Date()
  const upcoming = bookings.filter((b) => b.startMs > now.getTime()).sort((a, b) => a.startMs - b.startMs)
  const past = bookings.filter((b) => b.startMs <= now.getTime())
  const when = (b: store.Booking): string => new Intl.DateTimeFormat('en-AU', { dateStyle: 'full', timeStyle: 'short', timeZone: b.timeZone }).format(new Date(b.startMs))
  return (
    <section className="account-section">
      <h2>Appointments</h2>
      {[...upcoming, ...past].map((b) => (
        <article className="account-card" key={b.id}>
          <h3>{types.get(b.typeId)}</h3>
          <p>{when(b)} ({b.timeZone.replace(/_/g, ' ')})</p>
          <p className="account-muted">Booking {b.number} · {b.status.replace('_', ' ')}</p>
          {cancelError(b, now) === null ? <CancelAppointment id={b.id} /> : null}
        </article>
      ))}
    </section>
  )
}
