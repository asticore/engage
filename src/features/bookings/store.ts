import { winsSlot, type Busy, type Override, type Rule } from './engine'
import { type BookingStatus, type CustomerInput, type TypeInput } from './logic'

type Stmt = { bind: (...args: unknown[]) => { all: <T>() => Promise<{ results: T[] }>; run: () => Promise<{ meta?: { last_row_id?: number } }> } }
export type D1 = { prepare: (sql: string) => Stmt }
type Row = Record<string, unknown>

const all = async (d1: D1, sql: string, ...args: unknown[]): Promise<Row[]> => (await d1.prepare(sql).bind(...args).all<Row>()).results
const run = (d1: D1, sql: string, ...args: unknown[]) => d1.prepare(sql).bind(...args).run()

export type Resource = { id: number; title: string; timeZone: string; active: boolean }
export type BookingType = TypeInput & { id: number }
export type Booking = {
  id: number
  number: string
  typeId: number
  resourceId: number
  status: BookingStatus
  startAt: string
  endAt: string
  startMs: number
  endMs: number
  units: number
  timeZone: string
  customerName: string
  customerEmail: string
  customerPhone: string
  notes: string
  cancelledAt: string | null
}

const toResource = (r: Row): Resource => ({ id: Number(r.id), title: String(r.title ?? ''), timeZone: String(r.time_zone ?? 'Australia/Sydney'), active: Number(r.active) !== 0 })
const toType = (r: Row): BookingType => ({
  id: Number(r.id),
  title: String(r.title ?? ''),
  slug: String(r.slug ?? ''),
  description: String(r.description ?? ''),
  resourceId: r.resource_id === null || r.resource_id === undefined ? null : Number(r.resource_id),
  locationText: String(r.location_text ?? ''),
  active: Number(r.active) !== 0,
  durationMinutes: Number(r.duration_minutes ?? 30),
  stepMinutes: Number(r.step_minutes ?? 30),
  bufferBeforeMinutes: Number(r.buffer_before ?? 0),
  bufferAfterMinutes: Number(r.buffer_after ?? 0),
  minNoticeMinutes: Number(r.min_notice_minutes ?? 60),
  maxAdvanceDays: Number(r.max_advance_days ?? 60),
  capacity: Number(r.capacity ?? 1),
})
const toBooking = (r: Row): Booking => ({
  id: Number(r.id),
  number: String(r.number ?? ''),
  typeId: Number(r.type_id),
  resourceId: Number(r.resource_id),
  status: String(r.status ?? 'confirmed') as BookingStatus,
  startAt: String(r.start_at ?? ''),
  endAt: String(r.end_at ?? ''),
  startMs: Number(r.start_ms ?? 0),
  endMs: Number(r.end_ms ?? 0),
  units: Number(r.units ?? 1),
  timeZone: String(r.time_zone ?? ''),
  customerName: String(r.customer_name ?? ''),
  customerEmail: String(r.customer_email ?? ''),
  customerPhone: String(r.customer_phone ?? ''),
  notes: String(r.notes ?? ''),
  cancelledAt: r.cancelled_at ? String(r.cancelled_at) : null,
})

export async function listResources(d1: D1): Promise<Resource[]> {
  return (await all(d1, 'SELECT * FROM eg_booking_resources ORDER BY id')).map(toResource)
}
export async function getResource(d1: D1, id: number): Promise<Resource | null> {
  const rows = await all(d1, 'SELECT * FROM eg_booking_resources WHERE id = ?1', id)
  return rows[0] ? toResource(rows[0]) : null
}
export async function saveResource(d1: D1, id: number | null, input: { title: string; timeZone: string; active: boolean }, nowIso: string): Promise<void> {
  if (id) await run(d1, 'UPDATE eg_booking_resources SET title=?1, time_zone=?2, active=?3, updated_at=?4 WHERE id=?5', input.title, input.timeZone, input.active ? 1 : 0, nowIso, id)
  else await run(d1, 'INSERT INTO eg_booking_resources (title, time_zone, active, updated_at, created_at) VALUES (?1,?2,?3,?4,?4)', input.title, input.timeZone, input.active ? 1 : 0, nowIso)
}
export async function deleteResource(d1: D1, id: number): Promise<void> {
  await run(d1, 'DELETE FROM eg_booking_hours WHERE resource_id = ?1', id)
  await run(d1, 'DELETE FROM eg_booking_overrides WHERE resource_id = ?1', id)
  await run(d1, 'UPDATE eg_booking_types SET resource_id = NULL WHERE resource_id = ?1', id)
  await run(d1, 'DELETE FROM eg_booking_resources WHERE id = ?1', id)
}

export async function listTypes(d1: D1): Promise<BookingType[]> {
  return (await all(d1, 'SELECT * FROM eg_booking_types ORDER BY id')).map(toType)
}
export async function getType(d1: D1, id: number): Promise<BookingType | null> {
  const rows = await all(d1, 'SELECT * FROM eg_booking_types WHERE id = ?1', id)
  return rows[0] ? toType(rows[0]) : null
}
export async function getTypeBySlug(d1: D1, slug: string): Promise<BookingType | null> {
  const rows = await all(d1, 'SELECT * FROM eg_booking_types WHERE slug = ?1', slug)
  return rows[0] ? toType(rows[0]) : null
}
/** Saves a type. Returns an error text when another type already has the address. */
export async function saveType(d1: D1, id: number | null, t: TypeInput, nowIso: string): Promise<string | null> {
  const clash = await all(d1, 'SELECT id FROM eg_booking_types WHERE slug = ?1', t.slug)
  if (clash[0] && Number(clash[0].id) !== id) return `The address "${t.slug}" is already used by another booking type.`
  const v = [t.title, t.slug, t.description, t.resourceId, t.durationMinutes, t.stepMinutes, t.bufferBeforeMinutes, t.bufferAfterMinutes, t.minNoticeMinutes, t.maxAdvanceDays, t.capacity, t.locationText, t.active ? 1 : 0, nowIso]
  if (id) await run(d1, 'UPDATE eg_booking_types SET title=?1, slug=?2, description=?3, resource_id=?4, duration_minutes=?5, step_minutes=?6, buffer_before=?7, buffer_after=?8, min_notice_minutes=?9, max_advance_days=?10, capacity=?11, location_text=?12, active=?13, updated_at=?14 WHERE id=?15', ...v, id)
  else await run(d1, 'INSERT INTO eg_booking_types (title, slug, description, resource_id, duration_minutes, step_minutes, buffer_before, buffer_after, min_notice_minutes, max_advance_days, capacity, location_text, active, updated_at, created_at) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?14)', ...v)
  return null
}
export async function deleteType(d1: D1, id: number): Promise<void> {
  await run(d1, 'DELETE FROM eg_booking_types WHERE id = ?1', id)
}

export async function rulesFor(d1: D1, resourceId: number): Promise<Rule[]> {
  return (await all(d1, 'SELECT weekday, start_time, end_time FROM eg_booking_hours WHERE resource_id = ?1 ORDER BY weekday, start_time', resourceId)).map((r) => ({ weekday: Number(r.weekday), start: String(r.start_time), end: String(r.end_time) }))
}
export async function setRules(d1: D1, resourceId: number, rules: Rule[]): Promise<void> {
  await run(d1, 'DELETE FROM eg_booking_hours WHERE resource_id = ?1', resourceId)
  for (const r of rules) await run(d1, 'INSERT INTO eg_booking_hours (resource_id, weekday, start_time, end_time) VALUES (?1,?2,?3,?4)', resourceId, r.weekday, r.start, r.end)
}
export type StoredOverride = Override & { id: number; note: string }
export async function overridesFor(d1: D1, resourceId: number): Promise<StoredOverride[]> {
  return (await all(d1, 'SELECT id, date, kind, start_time, end_time, note FROM eg_booking_overrides WHERE resource_id = ?1 ORDER BY date, id', resourceId)).map((r) => ({ id: Number(r.id), date: String(r.date), kind: r.kind === 'open' ? 'open' : 'closed', start: r.start_time ? String(r.start_time) : null, end: r.end_time ? String(r.end_time) : null, note: String(r.note ?? '') }))
}
export async function addOverride(d1: D1, resourceId: number, o: Override & { note: string }): Promise<void> {
  await run(d1, 'INSERT INTO eg_booking_overrides (resource_id, date, kind, start_time, end_time, note) VALUES (?1,?2,?3,?4,?5,?6)', resourceId, o.date, o.kind, o.start ?? null, o.end ?? null, o.note)
}
export async function deleteOverride(d1: D1, id: number): Promise<void> {
  await run(d1, 'DELETE FROM eg_booking_overrides WHERE id = ?1', id)
}

/** Confirmed and completed bookings of a resource that overlap a time range, as busy blocks. */
export async function busyFor(d1: D1, resourceId: number, fromMs: number, toMs: number): Promise<Busy[]> {
  const rows = await all(d1, "SELECT start_ms, end_ms, units FROM eg_bookings WHERE resource_id = ?1 AND status IN ('confirmed','completed') AND start_ms < ?3 AND end_ms > ?2", resourceId, fromMs, toMs)
  return rows.map((r) => ({ startMs: Number(r.start_ms), endMs: Number(r.end_ms), units: Number(r.units ?? 1) }))
}

export type NewBooking = { number: string; typeId: number; resourceId: number; startMs: number; endMs: number; timeZone: string; capacity: number; manageTokenHash: string; customer: CustomerInput }

/**
 * Saves a booking with insert-then-verify (see winsSlot): insert, look at every row overlapping it, and take the
 * row back out when it does not fit. Returns the booking, or null when the time was just taken.
 */
export async function createBooking(d1: D1, b: NewBooking, nowIso: string): Promise<Booking | null> {
  const inserted = await run(
    d1,
    "INSERT INTO eg_bookings (number, type_id, resource_id, status, start_at, end_at, start_ms, end_ms, units, time_zone, customer_name, customer_email, customer_phone, notes, manage_token_hash, updated_at, created_at) VALUES (?1,?2,?3,'confirmed',?4,?5,?6,?7,1,?8,?9,?10,?11,?12,?13,?14,?14)",
    b.number, b.typeId, b.resourceId, new Date(b.startMs).toISOString(), new Date(b.endMs).toISOString(), b.startMs, b.endMs, b.timeZone, b.customer.name, b.customer.email, b.customer.phone, b.customer.notes, b.manageTokenHash, nowIso,
  )
  const id = Number(inserted.meta?.last_row_id ?? 0)
  const overlapping = (await all(d1, "SELECT id, units FROM eg_bookings WHERE resource_id = ?1 AND status IN ('confirmed','completed') AND start_ms < ?3 AND end_ms > ?2", b.resourceId, b.startMs, b.endMs)).map((r) => ({ id: Number(r.id), units: Number(r.units ?? 1) }))
  if (!id || !winsSlot(id, overlapping, b.capacity)) {
    if (id) await run(d1, 'DELETE FROM eg_bookings WHERE id = ?1', id)
    return null
  }
  return (await getBooking(d1, id)) ?? null
}

export async function getBooking(d1: D1, id: number): Promise<Booking | null> {
  const rows = await all(d1, 'SELECT * FROM eg_bookings WHERE id = ?1', id)
  return rows[0] ? toBooking(rows[0]) : null
}
export async function getBookingByTokenHash(d1: D1, hash: string): Promise<Booking | null> {
  const rows = await all(d1, 'SELECT * FROM eg_bookings WHERE manage_token_hash = ?1', hash)
  return rows[0] ? toBooking(rows[0]) : null
}
export async function setBookingStatus(d1: D1, id: number, status: BookingStatus, nowIso: string): Promise<void> {
  await run(d1, 'UPDATE eg_bookings SET status = ?1, cancelled_at = CASE WHEN ?1 = ?4 THEN ?2 ELSE cancelled_at END, updated_at = ?2 WHERE id = ?3', status, nowIso, id, 'cancelled')
}
export async function listBookings(d1: D1, filter: { status?: string; from?: number }, limit = 200): Promise<Booking[]> {
  const where: string[] = []
  const args: unknown[] = []
  if (filter.status) {
    args.push(filter.status)
    where.push(`status = ?${args.length}`)
  }
  if (filter.from !== undefined) {
    args.push(filter.from)
    where.push(`start_ms >= ?${args.length}`)
  }
  const sql = `SELECT * FROM eg_bookings${where.length ? ` WHERE ${where.join(' AND ')}` : ''} ORDER BY start_ms DESC LIMIT ${Math.max(1, Math.min(limit, 500))}`
  return (await all(d1, sql, ...args)).map(toBooking)
}
