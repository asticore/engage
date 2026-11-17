import { variationLabel } from '@/features/ecommerce/catalogue'
import { parseTiers, type TicketTier } from '@/features/editScreens/tiers'

/**
 * Paid tickets and bookings. A paid event sells its ticket as a shop product. When the order for that
 * product is paid, each ticket line becomes a booking (an `event-rsvps` row carrying the order id), so the
 * buyer gets the booking email, is on the check-in list and takes places in the event's capacity. When the
 * order is fully refunded or cancelled, those bookings are cancelled and the places are free again.
 *
 * Ticket types on a paid event: a ticket type can have its own shop product (picked on the event); a line for
 * that product is booked on that type. Otherwise sell one variation of the ticket product per type: a line whose
 * variation label is the same as a ticket type name, case aside, is booked on that type. A line with no
 * matching type is booked with no type.
 *
 * Idempotent: a booking is created once per order, event and line, so a replayed payment webhook never
 * books twice. Never throws to the caller; problems are returned so the order can note them.
 */

type Doc = Record<string, unknown>
type Engine = {
  find: (args: Record<string, unknown>) => Promise<{ docs: Doc[] }>
  findByID: (args: Record<string, unknown>) => Promise<Doc | null>
  create: (args: Record<string, unknown>) => Promise<Doc>
  update: (args: Record<string, unknown>) => Promise<Doc>
}
type Line = { productId?: unknown; variationId?: unknown; quantity?: unknown; name?: unknown }

const idOf = (value: unknown): number | null => {
  const n = typeof value === 'object' && value ? Number((value as { id?: unknown }).id) : Number(value)
  return Number.isInteger(n) && n > 0 ? n : null
}

/** The ticket type a line was bought for, or null. Pure. */
export function tierForLine(tiers: TicketTier[], label: string | null, lineName: string, productId: number | null = null): string | null {
  if (productId !== null) {
    const own = tiers.find((tier) => tier.productId === productId)
    if (own) return own.name
  }
  const wanted = (label ?? '').trim().toLowerCase()
  if (wanted) {
    const hit = tiers.find((tier) => tier.name.trim().toLowerCase() === wanted)
    if (hit) return hit.name
  }
  const name = lineName.trim().toLowerCase()
  const suffix = tiers.find((tier) => name.endsWith(` - ${tier.name.trim().toLowerCase()}`))
  return suffix ? suffix.name : null
}

export type OrderBookingResult = { created: number; skipped: number; problems: string[] }

export async function createRsvpsForOrder(engine: Engine, order: Doc): Promise<OrderBookingResult> {
  const result: OrderBookingResult = { created: 0, skipped: 0, problems: [] }
  const orderId = idOf(order.id)
  const email = typeof order.customerEmail === 'string' ? order.customerEmail.trim() : ''
  const lines = (Array.isArray(order.lineItems) ? order.lineItems : []) as Line[]
  if (!orderId || lines.length === 0) return result

  const productIds = [...new Set(lines.map((line) => idOf(line.productId)).filter((id): id is number => id !== null))]
  if (productIds.length === 0) return result
  const { docs: ticketEvents } = await engine.find({
    collection: 'events',
    where: { ticketProduct: { in: productIds } },
    depth: 0,
    limit: 200,
    overrideAccess: true,
  })
  // Ticket types can have their own product (stored inside the tiers, so not searchable): read the paid events and filter.
  const { docs: paidEvents } = await engine.find({ collection: 'events', where: { eventType: { equals: 'paid' } }, depth: 0, limit: 1000, overrideAccess: true })
  const events = [...ticketEvents]
  for (const event of paidEvents) {
    if (events.some((known) => idOf(known.id) === idOf(event.id))) continue
    if (parseTiers(event.ticketTiers).some((tier) => tier.productId && productIds.includes(tier.productId))) events.push(event)
  }
  if (events.length === 0) return result

  const { docs: existing } = await engine.find({ collection: 'event-rsvps', where: { orderId: { equals: orderId } }, depth: 0, limit: 500, overrideAccess: true })
  const booked = new Set(existing.map((row) => `${idOf(row.event)}:${String(row.notes ?? '').match(/line (\d+)/)?.[1] ?? ''}`))

  const buyerName = await buyerNameOf(engine, order, email)
  for (const [index, line] of lines.entries()) {
    const productId = idOf(line.productId)
    if (productId === null) continue
    for (const event of events) {
      const eventTiers = parseTiers(event.ticketTiers)
      if (idOf(event.ticketProduct) !== productId && !eventTiers.some((tier) => tier.productId === productId)) continue
      const eventId = idOf(event.id) as number
      if (booked.has(`${eventId}:${index}`)) {
        result.skipped += 1
        continue
      }
      const quantity = Number.isInteger(Number(line.quantity)) && Number(line.quantity) >= 1 ? Number(line.quantity) : 1
      try {
        let label: string | null = null
        if (line.variationId) {
          const product = await engine.findByID({ collection: 'products', id: productId, depth: 0, overrideAccess: true })
          const variations = (Array.isArray(product?.variations) ? product?.variations : []) as Array<Doc & { id?: string }>
          const variation = variations.find((v) => v.id === line.variationId)
          if (variation) label = variationLabel(variation as never)
        }
        const tier = tierForLine(eventTiers, label, typeof line.name === 'string' ? line.name : '', productId)
        await engine.create({
          collection: 'event-rsvps',
          data: {
            event: eventId,
            name: buyerName,
            email,
            guestCount: quantity,
            ticketTier: tier,
            orderId,
            status: 'confirmed',
            notes: `Paid ticket, order #${orderId}, line ${index}`,
          },
          overrideAccess: true,
        })
        result.created += 1
      } catch (error) {
        result.problems.push(`Event #${eventId}: ${error instanceof Error ? error.message : 'could not book'}`)
      }
    }
  }
  return result
}

async function buyerNameOf(engine: Engine, order: Doc, email: string): Promise<string> {
  const billing = order.shippingAddress
  if (billing && typeof billing === 'object') {
    const b = billing as Doc
    const full = [b.firstName, b.lastName].filter((p) => typeof p === 'string' && p).join(' ').trim()
    if (full) return full
    if (typeof b.name === 'string' && b.name.trim()) return b.name.trim()
  }
  const customerId = idOf(order.customer)
  if (customerId) {
    const user = await engine.findByID({ collection: 'users', id: customerId, depth: 0, overrideAccess: true }).catch((): null => null)
    if (user && typeof user.name === 'string' && user.name.trim()) return user.name.trim()
  }
  return email || 'Ticket buyer'
}

/** Cancels every booking made from this order. Already cancelled bookings are left alone. Returns how many changed. */
export async function cancelRsvpsForOrder(engine: Engine, orderId: number): Promise<number> {
  const { docs } = await engine.find({ collection: 'event-rsvps', where: { orderId: { equals: orderId } }, depth: 0, limit: 500, overrideAccess: true })
  let changed = 0
  for (const row of docs) {
    if (row.status === 'cancelled') continue
    await engine.update({ collection: 'event-rsvps', id: row.id as number, data: { status: 'cancelled', cancelledAt: new Date().toISOString() }, overrideAccess: true })
    changed += 1
  }
  return changed
}
