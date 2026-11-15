/**
 * Shipment tracking: the shape stored on each shipment of an order, and the pure rules that merge a carrier's update into it.
 * No I/O. The carrier fetch and webhook (server/tracking.ts) only produce a TrackingUpdate; everything that decides what the
 * customer sees, and when they are emailed, is here so it can be tested by feeding events in.
 */

export const TRACKING_STATUSES = ['label-created', 'in-transit', 'out-for-delivery', 'delivered', 'exception'] as const
export type TrackingStatus = (typeof TRACKING_STATUSES)[number]
export const isTrackingStatus = (v: unknown): v is TrackingStatus => typeof v === 'string' && (TRACKING_STATUSES as readonly string[]).includes(v)

export const TRACKING_LABELS: Record<TrackingStatus, string> = {
  'label-created': 'Label created',
  'in-transit': 'In transit',
  'out-for-delivery': 'Out for delivery',
  delivered: 'Delivered',
  exception: 'Delivery problem',
}

export type TrackingEvent = { at: string; status: TrackingStatus; text: string; location?: string }
export type NotifyKind = 'outForDelivery' | 'delivered' | 'exception'
export type Tracking = { status: TrackingStatus; updatedAt: string; events: TrackingEvent[]; notified: Partial<Record<NotifyKind, boolean>>; polledAt?: string }

export type IncomingEvent = { at?: string; text?: string; location?: string; status?: TrackingStatus }
export type TrackingUpdate = { status?: TrackingStatus; events: IncomingEvent[] }

/** Reads a carrier's own wording ("Out for delivery", "Delivery attempted", "Held at depot") as one of our five states. */
export function statusFromText(raw: string): TrackingStatus {
  const t = raw.toLowerCase()
  if (/\b(out for delivery|with (the )?driver|on board for delivery|onboard for delivery|on vehicle for delivery)\b/.test(t)) return 'out-for-delivery'
  if (/\b(delivery attempted|attempted delivery|unable to deliver|undeliverable|returned to sender|return to sender|held|damaged|lost|exception|failed delivery|card left|address (issue|problem))\b/.test(t)) return 'exception'
  if (/\b(delivered|left at|signed for|collected by)\b/.test(t) && !/\bnot delivered\b/.test(t)) return 'delivered'
  if (/\b(label|booked|manifest|awaiting (collection|pickup)|shipment created|order received|info received)\b/.test(t)) return 'label-created'
  return 'in-transit'
}

const key = (e: { at: string; text: string }): string => `${e.at}|${e.text}`

/**
 * Merges an update into the stored tracking. Events are de-duplicated by time and text and kept oldest first; the status
 * is the update's, else the latest event's. Delivered is final. The returned `emails` lists what the customer should be told
 * now, and each kind is only ever returned once for a shipment (the `notified` flags travel with the record).
 */
export function mergeTracking(prev: Tracking | undefined, update: TrackingUpdate, now: Date): { tracking: Tracking; emails: NotifyKind[]; changed: boolean } {
  const base: Tracking = prev ?? { status: 'label-created', updatedAt: now.toISOString(), events: [], notified: {} }
  const seen = new Set(base.events.map(key))
  const added: TrackingEvent[] = []
  for (const e of update.events) {
    const text = (e.text ?? '').trim().slice(0, 300)
    if (!text && !e.status) continue
    const at = e.at && Number.isFinite(Date.parse(e.at)) ? new Date(e.at).toISOString() : now.toISOString()
    const event: TrackingEvent = { at, status: e.status ?? statusFromText(text), text: text || TRACKING_LABELS[e.status as TrackingStatus], ...(e.location ? { location: e.location.slice(0, 120) } : {}) }
    if (seen.has(key(event))) continue
    seen.add(key(event))
    added.push(event)
  }
  const events = [...base.events, ...added].sort((a, b) => Date.parse(a.at) - Date.parse(b.at)).slice(-60)
  let status: TrackingStatus = update.status ?? events[events.length - 1]?.status ?? base.status
  if (base.status === 'delivered') status = 'delivered'
  const notified = { ...base.notified }
  const emails: NotifyKind[] = []
  const want = (kind: NotifyKind): void => {
    if (!notified[kind]) {
      notified[kind] = true
      emails.push(kind)
    }
  }
  if (status !== base.status || added.length > 0) {
    if (status === 'delivered') {
      // Delivered supersedes an out-for-delivery message that was never sent.
      notified.outForDelivery = true
      want('delivered')
    } else if (status === 'out-for-delivery') want('outForDelivery')
    else if (status === 'exception') want('exception')
  }
  const changed = added.length > 0 || status !== base.status
  return { tracking: { ...base, status, events, notified, updatedAt: changed ? now.toISOString() : base.updatedAt, polledAt: base.polledAt }, emails, changed }
}

/** Not worth asking the carrier again: delivered, or asked within the last half hour. */
export const needsPolling = (t: Tracking | undefined, now: Date, minGapMs = 30 * 60_000): boolean => {
  if (t?.status === 'delivered') return false
  if (t?.polledAt && now.getTime() - Date.parse(t.polledAt) < minGapMs) return false
  return true
}

export const TRACKING_EMAILS: Record<NotifyKind, { subject: string; body: string }> = {
  outForDelivery: { subject: 'Your order #{{order_id}} is out for delivery', body: 'Hi {{customer_name}},\n\nYour order #{{order_id}} is out for delivery with {{carrier}} today.\nTracking number: {{tracking_number}}\nTrack it here: {{tracking_url}}\n\n{{site_name}}' },
  delivered: { subject: 'Your order #{{order_id}} was delivered', body: 'Hi {{customer_name}},\n\nYour order #{{order_id}} was delivered by {{carrier}}.\nTracking number: {{tracking_number}}\n\nIf anything is wrong, just reply to this email.\n\n{{site_name}}' },
  exception: { subject: 'There is a problem delivering your order #{{order_id}}', body: 'Hi {{customer_name}},\n\n{{carrier}} reported a problem delivering your order #{{order_id}}: {{latest}}\nTracking number: {{tracking_number}}\nTrack it here: {{tracking_url}}\n\nWe are keeping an eye on it. Reply to this email if you need help.\n\n{{site_name}}' },
}
