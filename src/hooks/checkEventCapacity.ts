import type { CollectionAfterChangeHook, CollectionBeforeChangeHook } from '@/engine'

import { activeRsvps } from '../features/editScreens/rsvpStatus'
import { guestsByTier } from '../features/editScreens/tierSales'
import { parseTiers } from '../features/editScreens/tiers'

type RsvpRow = { id?: unknown; status?: unknown; guestCount?: unknown; ticketTier?: unknown }

/**
 * Prevents new RSVPs once an event's capacity has been reached.
 * Events with no capacity set are treated as unlimited.
 */
export const checkEventCapacity: CollectionBeforeChangeHook = async ({ data, req, operation }) => {
  if (operation !== 'create' || !data?.event) {
    return data
  }
  // A ticket bought through checkout is already paid for: the booking is recorded whatever the count says.
  if (data.orderId) return data

  const eventID = typeof data.event === 'object' ? data.event.id : data.event

  // A password-protected event takes RSVPs only from a visitor who has unlocked it (fails closed).
  // Lazy import: gate -> connect -> schema is built from the collections, which import this file.
  const { getPasswordGateStateForHeaders } = await import('@/features/visibility/gate')
  const isAdminUser = Boolean((req as { user?: { roles?: string[] | null } | null }).user?.roles?.includes('admin'))
  const gate = isAdminUser
    ? 'open'
    : await getPasswordGateStateForHeaders({
        collection: 'events',
        id: Number(eventID),
        headers: (req as { headers?: Headers }).headers,
      })
  if (gate === 'locked') {
    throw new Error('This event is password protected.')
  }

  const event = await req.engine.findByID({
    id: eventID,
    collection: 'events',
    req,
  })

  if (!event || typeof event.capacity !== 'number' || event.capacity <= 0) {
    return data
  }

  const existing = await req.engine.find({
    collection: 'event-rsvps',
    where: { event: { equals: eventID } },
    limit: 0,
    req,
  })

  const guestsSoFar = activeRsvps(existing.docs as RsvpRow[]).reduce(
    (sum, doc) => sum + (typeof doc.guestCount === 'number' ? doc.guestCount : 1),
    0,
  )
  const incomingGuests = typeof data.guestCount === 'number' ? data.guestCount : 1

  if (guestsSoFar + incomingGuests > event.capacity) {
    throw new Error(
      `Sorry, this event is at capacity. Only ${Math.max(event.capacity - guestsSoFar, 0)} spot(s) remaining.`,
    )
  }

  return data
}

const guestsOf = (doc: { guestCount?: unknown }): number => (typeof doc.guestCount === 'number' && doc.guestCount > 0 ? doc.guestCount : 1)

/**
 * The count above reads then inserts, and D1 has no row lock, so two bookings made at the same moment can both
 * pass it. This hook runs after the insert and settles it: a booking stays only if the bookings made up to and
 * including it (lowest id first) fit in the event's capacity and in its ticket type's capacity. A booking that does
 * not fit is deleted again and the guest sees the usual "at capacity" message. Because the order is by id, of two
 * racing bookings the earlier one always stays, never both and never neither.
 */
export const verifyEventCapacity: CollectionAfterChangeHook = async ({ doc, req, operation }) => {
  if (operation !== 'create' || !doc || doc.orderId) return doc
  const eventID = typeof doc.event === 'object' && doc.event ? (doc.event as { id: number }).id : doc.event
  if (!eventID) return doc
  const event = await req.engine.findByID({ id: eventID, collection: 'events', req, overrideAccess: true })
  if (!event) return doc
  const capacity = typeof event.capacity === 'number' && event.capacity > 0 ? event.capacity : null
  const tiers = parseTiers(event.ticketTiers)
  const tier = typeof doc.ticketTier === 'string' ? tiers.find((t) => t.name === doc.ticketTier) : undefined
  const tierCapacity = tier && tier.capacity !== null ? tier.capacity : null
  if (capacity === null && tierCapacity === null) return doc

  const all = await req.engine.find({ collection: 'event-rsvps', where: { event: { equals: eventID } }, limit: 0, req, overrideAccess: true })
  const upToMe = activeRsvps(all.docs as RsvpRow[]).filter((row) => Number(row.id) <= Number(doc.id))
  const eventGuests = upToMe.reduce((sum, row) => sum + guestsOf(row), 0)
  const tierGuests = tier ? (guestsByTier(upToMe).get(tier.name) ?? 0) : 0
  const overEvent = capacity !== null && eventGuests > capacity
  const overTier = tierCapacity !== null && tierGuests > tierCapacity
  if (!overEvent && !overTier) return doc

  await req.engine.delete({ collection: 'event-rsvps', id: doc.id, req, overrideAccess: true })
  throw new Error(overTier && tier ? `Sorry, ${tier.name} is sold out.` : 'Sorry, this event is at capacity.')
}
