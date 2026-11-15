import { fillTemplate } from '@/features/email/renderTemplate'
import { textToHtml } from '@/features/email/renderTemplate'
import { sendEmail } from '@/features/email'

import { carrierDef } from '../shipping/catalogue'
import { getAdapter, normaliseShippingConfig } from '../shipping/registry'
import type { CarrierId } from '../shipping/types'
import { mergeTracking, needsPolling, statusFromText, TRACKING_EMAILS, type NotifyKind, type Tracking, type TrackingUpdate } from '../lib/tracking'

type Doc = Record<string, unknown>
export type TrackEngine = {
  find: (a: unknown) => Promise<{ docs: Doc[] }>
  findByID: (a: unknown) => Promise<Doc | null>
  findGlobal: (a: unknown) => Promise<Doc>
  update: (a: unknown) => Promise<Doc>
}
type Shipment = { id?: string; carrier?: string; trackingNumber?: string; carrierRef?: string; trackingUrl?: string; tracking?: Tracking } & Doc

const shipmentsOf = (order: Doc): Shipment[] => (Array.isArray(order.shipments) ? (order.shipments as Shipment[]) : [])

/** Tells the customer about a tracking change, unless the shop turned these emails off (Shop switches). Never throws. */
async function emailCustomer(engine: TrackEngine, order: Doc, shipment: Shipment, kind: NotifyKind, latest: string): Promise<void> {
  try {
    const to = typeof order.customerEmail === 'string' ? order.customerEmail : ''
    if (!to) return
    const switches = ((await engine.findGlobal({ slug: 'shop-extra-settings', depth: 0, overrideAccess: true }).catch((): null => null)) ?? {}) as Doc
    if (switches.trackingEmails === false) return
    const site = (await engine.findGlobal({ slug: 'site-settings', depth: 0, overrideAccess: true }).catch((): null => null)) as { siteName?: string } | null
    const addr = (order.shippingAddress ?? {}) as Record<string, unknown>
    const name = [addr.firstName, addr.lastName].filter((x) => typeof x === 'string' && x).join(' ') || 'there'
    const values = {
      order_id: String(order.orderNumber || order.id || ''),
      customer_name: name,
      carrier: carrierDef(shipment.carrier as never)?.label ?? String(shipment.carrier ?? 'the carrier'),
      tracking_number: String(shipment.trackingNumber ?? ''),
      tracking_url: String(shipment.trackingUrl ?? order.trackingUrl ?? ''),
      latest,
      site_name: site?.siteName ?? '',
    }
    const t = TRACKING_EMAILS[kind]
    const text = fillTemplate(t.body, values)
    await sendEmail({ to, template: `order.tracking-${kind}`, subject: fillTemplate(t.subject, values).replace(/[\r\n]+/g, ' '), text, html: textToHtml(text) })
  } catch {
    // The tracking record is saved; the email is a courtesy.
  }
}

/**
 * Applies a carrier update to one parcel of an order and tells the customer what changed (out for delivery, delivered, a
 * problem), each at most once. Returns false when the order or the tracking number is not found.
 */
export async function recordTracking(engine: TrackEngine, orderId: number | string, trackingNumber: string, update: TrackingUpdate, now = new Date(), opts: { polled?: boolean } = {}): Promise<boolean> {
  const order = await engine.findByID({ collection: 'orders', id: orderId, depth: 0, overrideAccess: true })
  if (!order) return false
  const shipments = shipmentsOf(order)
  const index = shipments.findIndex((s) => s.trackingNumber === trackingNumber)
  if (index < 0) return false
  const merged = mergeTracking(shipments[index].tracking, update, now)
  const tracking: Tracking = opts.polled ? { ...merged.tracking, polledAt: now.toISOString() } : merged.tracking
  const next = shipments.map((s, i) => (i === index ? { ...s, tracking } : s))
  await engine.update({ collection: 'orders', id: orderId, data: { shipments: next }, overrideAccess: true })
  const latest = tracking.events[tracking.events.length - 1]?.text ?? ''
  for (const kind of merged.emails) await emailCustomer(engine, order, shipments[index], kind, latest)
  return true
}

/** The order that holds a tracking number: the first one on the order, else a scan of recently shipped orders. */
export async function findOrderByTracking(engine: TrackEngine, trackingNumber: string): Promise<Doc | null> {
  const first = await engine.find({ collection: 'orders', where: { trackingNumber: { equals: trackingNumber } }, limit: 1, depth: 0, overrideAccess: true }).catch((): { docs: Doc[] } => ({ docs: [] }))
  if (first.docs[0]) return first.docs[0]
  const recent = await engine.find({ collection: 'orders', where: { shippedAt: { greater_than: new Date(Date.now() - 90 * 86_400_000).toISOString() } }, sort: '-shippedAt', limit: 500, depth: 0, overrideAccess: true }).catch((): { docs: Doc[] } => ({ docs: [] }))
  return recent.docs.find((o) => shipmentsOf(o).some((s) => s.trackingNumber === trackingNumber)) ?? null
}

export type PollResult = { checked: number; updated: number; skipped: number }

/** The hourly job: asks each carrier that can answer where its undelivered parcels are. One parcel failing never stops the rest. */
export async function pollTracking(engine: TrackEngine, now = new Date(), limit = 100): Promise<PollResult> {
  const result: PollResult = { checked: 0, updated: 0, skipped: 0 }
  const cfg = normaliseShippingConfig(await engine.findGlobal({ slug: 'shipping-settings', depth: 0, overrideAccess: true }).catch((): Doc => ({})))
  const { docs } = await engine.find({ collection: 'orders', where: { shippedAt: { greater_than: new Date(now.getTime() - 45 * 86_400_000).toISOString() } }, sort: '-shippedAt', limit, depth: 0, overrideAccess: true }).catch((): { docs: Doc[] } => ({ docs: [] }))
  for (const order of docs) {
    for (const shipment of shipmentsOf(order)) {
      if (!shipment.trackingNumber || !needsPolling(shipment.tracking, now)) continue
      const carrierId = shipment.carrier as CarrierId
      const carrier = cfg.carriers.find((c) => c.id === carrierId && c.enabled)
      const adapter = carrier ? getAdapter(carrierId) : null
      if (!carrier || !adapter?.track) {
        result.skipped += 1
        continue
      }
      result.checked += 1
      try {
        const found = await adapter.track(carrier.creds, { trackingNumber: shipment.trackingNumber, carrierRef: shipment.carrierRef })
        const update: TrackingUpdate = { events: found?.events ?? [], ...(found?.status ? { status: statusFromText(found.status) } : {}) }
        // The carrier's overall state only decides the status when it is clear; otherwise the latest event does.
        if (found?.status && update.status === 'in-transit' && update.events.length > 0) delete update.status
        if (await recordTracking(engine, order.id as number, shipment.trackingNumber, update, now, { polled: true })) result.updated += 1
      } catch (error) {
        console.error('shipment tracking error:', error instanceof Error ? error.message : error)
      }
    }
  }
  return result
}
