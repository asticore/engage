import { describe, expect, it } from 'vitest'

import { mergeTracking, needsPolling, statusFromText, type Tracking } from '@/features/ecommerce/lib/tracking'

const t = (iso: string): Date => new Date(iso)

describe('shipment tracking', () => {
  it('reads carrier wording', () => {
    expect(statusFromText('Out for delivery')).toBe('out-for-delivery')
    expect(statusFromText('Delivery attempted: nobody home')).toBe('exception')
    expect(statusFromText('Delivered, left at front door')).toBe('delivered')
    expect(statusFromText('Shipment created')).toBe('label-created')
    expect(statusFromText('Arrived at depot')).toBe('in-transit')
    expect(statusFromText('Not delivered')).not.toBe('delivered')
  })

  it('builds a timeline and sends each email once, with delivered final', () => {
    let tr: Tracking | undefined
    const step = (events: { at: string; text: string }[], at = '2026-03-05T00:00:00Z') => {
      const r = mergeTracking(tr, { events }, t(at))
      tr = r.tracking
      return r
    }
    expect(step([{ at: '2026-03-02T01:00:00Z', text: 'Picked up' }]).emails).toEqual([])
    expect(tr?.status).toBe('in-transit')
    // The same scan again changes nothing.
    const again = step([{ at: '2026-03-02T01:00:00Z', text: 'Picked up' }])
    expect(again.changed).toBe(false)
    expect(tr?.events).toHaveLength(1)
    // Out for delivery: one email, however many times it is reported.
    expect(step([{ at: '2026-03-04T21:00:00Z', text: 'Out for delivery' }]).emails).toEqual(['outForDelivery'])
    expect(step([{ at: '2026-03-04T22:00:00Z', text: 'With driver, out for delivery' }]).emails).toEqual([])
    // Delivered: one email, then final.
    expect(step([{ at: '2026-03-04T23:30:00Z', text: 'Delivered' }]).emails).toEqual(['delivered'])
    expect(step([{ at: '2026-03-05T01:00:00Z', text: 'Delivered' }, { at: '2026-03-05T02:00:00Z', text: 'Arrived at depot' }]).emails).toEqual([])
    expect(tr?.status).toBe('delivered')
    expect(tr?.events.map((e) => e.text)[0]).toBe('Picked up') // oldest first
  })

  it('skips the out for delivery email when the first news is delivered', () => {
    const r = mergeTracking(undefined, { events: [{ at: '2026-03-04T10:00:00Z', text: 'Delivered' }] }, t('2026-03-05T00:00:00Z'))
    expect(r.emails).toEqual(['delivered'])
    expect(r.tracking.notified.outForDelivery).toBe(true)
  })

  it('emails a delivery problem once', () => {
    const first = mergeTracking(undefined, { events: [{ at: '2026-03-04T10:00:00Z', text: 'Delivery attempted: no one home' }] }, t('2026-03-05T00:00:00Z'))
    expect(first.emails).toEqual(['exception'])
    expect(first.tracking.status).toBe('exception')
    const second = mergeTracking(first.tracking, { events: [{ at: '2026-03-04T12:00:00Z', text: 'Card left' }] }, t('2026-03-05T01:00:00Z'))
    expect(second.emails).toEqual([])
  })

  it('takes a status set by hand, and does not poll delivered or just-polled parcels', () => {
    const r = mergeTracking(undefined, { status: 'out-for-delivery', events: [{ status: 'out-for-delivery' }] }, t('2026-03-05T00:00:00Z'))
    expect(r.emails).toEqual(['outForDelivery'])
    expect(r.tracking.events[0].text).toBe('Out for delivery')
    const now = t('2026-03-05T01:00:00Z')
    expect(needsPolling(undefined, now)).toBe(true)
    expect(needsPolling({ ...r.tracking, polledAt: '2026-03-05T00:50:00Z' }, now)).toBe(false)
    expect(needsPolling({ ...r.tracking, polledAt: '2026-03-05T00:10:00Z' }, now)).toBe(true)
    expect(needsPolling({ ...r.tracking, status: 'delivered' }, now)).toBe(false)
  })
})
