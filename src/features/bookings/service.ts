import { buildEventIcs } from '@/features/editScreens/ics'
import { localDateIn } from '@/features/editScreens/timeZone'
import { datesFrom, slotsForDate, type Slot } from './engine'
import { hashToken, newBookingNumber, newManageToken, type CustomerInput } from './logic'
import * as store from './store'

export type DaySlots = { date: string; slots: { start: string; local: string }[] }

const DAY_MS = 86_400_000

/** Bookable times for the next `days` days from `from`, for one type. Null when the type, or its resource, cannot take bookings. */
export async function availability(d1: store.D1, type: store.BookingType, from: string, days: number, now: Date): Promise<{ timeZone: string; days: DaySlots[] } | null> {
  if (!type.active || !type.resourceId) return null
  const resource = await store.getResource(d1, type.resourceId)
  if (!resource || !resource.active) return null
  const [rules, overrides] = await Promise.all([store.rulesFor(d1, resource.id), store.overridesFor(d1, resource.id)])
  const dates = datesFrom(from, days)
  if (dates.length === 0) return { timeZone: resource.timeZone, days: [] }
  const busy = await store.busyFor(d1, resource.id, now.getTime() - DAY_MS, now.getTime() + (type.maxAdvanceDays + 2) * DAY_MS)
  return { timeZone: resource.timeZone, days: dates.map((date) => ({ date, slots: slotsForDate(date, resource.timeZone, rules, overrides, type, busy, now).map((s: Slot) => ({ start: s.start, local: s.local })) })) }
}

export type CreateResult = { ok: true; booking: store.Booking; token: string } | { ok: false; status: number; error: string }

export const TAKEN_MESSAGE = 'That time was just taken, please pick another.'

/** Books a start time. The time must be one the engine offers right now; the browser's word is never taken. */
export async function createForType(d1: store.D1, type: store.BookingType, startIso: string, customer: CustomerInput, now: Date): Promise<CreateResult> {
  if (!type.active || !type.resourceId) return { ok: false, status: 404, error: 'This booking type is not available.' }
  const resource = await store.getResource(d1, type.resourceId)
  if (!resource || !resource.active) return { ok: false, status: 404, error: 'This booking type is not available.' }
  const startMs = Date.parse(startIso)
  if (!Number.isFinite(startMs)) return { ok: false, status: 400, error: 'Pick a time from the list.' }
  const date = localDateIn(new Date(startMs), resource.timeZone)
  const avail = await availability(d1, type, date, 1, now)
  const offered = avail?.days[0]?.slots.some((s) => Date.parse(s.start) === startMs)
  if (!offered) return { ok: false, status: 409, error: TAKEN_MESSAGE }
  const token = newManageToken()
  const booking = await store.createBooking(
    d1,
    { number: newBookingNumber(), typeId: type.id, resourceId: resource.id, startMs, endMs: startMs + type.durationMinutes * 60_000, timeZone: resource.timeZone, capacity: type.capacity, manageTokenHash: await hashToken(token), customer },
    now.toISOString(),
  )
  if (!booking) return { ok: false, status: 409, error: TAKEN_MESSAGE }
  return { ok: true, booking, token }
}

/** What the customer may cancel: their own confirmed booking, before it starts. */
export function cancelError(booking: store.Booking, now: Date): string | null {
  if (booking.status === 'cancelled') return 'This booking is already cancelled.'
  if (booking.status !== 'confirmed') return 'This booking can no longer be cancelled here.'
  if (booking.startMs <= now.getTime()) return 'This booking has already started.'
  return null
}

const localText = (ms: number, timeZone: string): string => new Intl.DateTimeFormat('en-AU', { dateStyle: 'full', timeStyle: 'short', timeZone }).format(new Date(ms))

export function confirmationEmail(booking: store.Booking, typeTitle: string, origin: string, token: string, siteName: string): { subject: string; text: string; html: string } {
  const when = localText(booking.startMs, booking.timeZone)
  const manage = `${origin}/book/manage/${token}`
  const calendar = `${origin}/api/booking-ics?token=${token}`
  const subject = `Booking confirmed: ${typeTitle} on ${when}`
  const text = `Hi ${booking.customerName},\n\nYour booking is confirmed.\n\n${typeTitle}\n${when} (${booking.timeZone})\nBooking number ${booking.number}\n\nAdd to your calendar: ${calendar}\nNeed to cancel? ${manage}\n\n${siteName}`
  const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const html = `<div style="font-family:system-ui,sans-serif;font-size:15px;line-height:1.5"><p>Hi ${esc(booking.customerName)},</p><p>Your booking is confirmed.</p><p><strong>${esc(typeTitle)}</strong><br>${esc(when)} (${esc(booking.timeZone)})<br>Booking number ${esc(booking.number)}</p><p><a href="${calendar}">Add to your calendar</a><br><a href="${manage}">Need to cancel?</a></p><p>${esc(siteName)}</p></div>`
  return { subject, text, html }
}

/** The reminder sent a day before. The cancel link is only in the confirmation email (only its hash is stored), so this one points back to it. */
export function reminderEmail(booking: store.Booking, typeTitle: string, siteName: string): { subject: string; text: string; html: string } {
  const when = localText(booking.startMs, booking.timeZone)
  const subject = `Reminder: ${typeTitle} on ${when}`
  const text = `Hi ${booking.customerName},\n\nA reminder of your booking.\n\n${typeTitle}\n${when} (${booking.timeZone})\nBooking number ${booking.number}\n\nNeed to cancel? Use the link in your confirmation email.\n\n${siteName}`
  const esc = (v: string): string => v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const html = `<div style="font-family:system-ui,sans-serif;font-size:15px;line-height:1.5"><p>Hi ${esc(booking.customerName)},</p><p>A reminder of your booking.</p><p><strong>${esc(typeTitle)}</strong><br>${esc(when)} (${esc(booking.timeZone)})<br>Booking number ${esc(booking.number)}</p><p>Need to cancel? Use the link in your confirmation email.</p><p>${esc(siteName)}</p></div>`
  return { subject, text, html }
}

export function bookingIcs(booking: store.Booking, typeTitle: string, location: string, origin: string): string {
  return buildEventIcs({ uid: `booking-${booking.number}@${new URL(origin).host}`, stamp: new Date(), start: new Date(booking.startMs), end: new Date(booking.endMs), summary: typeTitle, location: location || undefined, url: origin })
}
