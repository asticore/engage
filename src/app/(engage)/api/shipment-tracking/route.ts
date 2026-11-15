import { NextResponse } from 'next/server'

import { isTrackingStatus, statusFromText, type TrackingUpdate } from '@/features/ecommerce/lib/tracking'
import { findOrderByTracking, recordTracking, type TrackEngine } from '@/features/ecommerce/server/tracking'
import { hitShared } from '@/features/security/rateLimit'

export const dynamic = 'force-dynamic'

const json = (body: unknown, status = 200): Response => NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } })

/** Constant-time text compare, so the secret cannot be guessed from response time. */
const same = (a: string, b: string): boolean => {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

/**
 * POST { trackingNumber, status?, text?, at?, location?, events?: [{ at, text, location, status }] }: a carrier (or a
 * tracking service such as ShipStation or AfterShip pointed at this address) reports where a parcel is. The shared secret
 * is the TRACKING_WEBHOOK_SECRET setting, sent as the `x-tracking-secret` header or `?secret=`. With no secret set the
 * address does not exist.
 */
export async function POST(request: Request): Promise<Response> {
  const secret = process.env.TRACKING_WEBHOOK_SECRET
  if (!secret) return json({ error: 'Not found' }, 404)
  const ip = request.headers.get('cf-connecting-ip') || request.headers.get('x-real-ip') || 'unknown'
  if ((await hitShared(`tracking-webhook:${ip}`, 120)).limited) return json({ error: 'Too many requests.' }, 429)
  const given = request.headers.get('x-tracking-secret') ?? new URL(request.url).searchParams.get('secret') ?? ''
  if (!same(given, secret)) return json({ error: 'Unauthorised' }, 401)
  const body = (await request.json().catch((): null => null)) as Record<string, unknown> | null
  const trackingNumber = typeof body?.trackingNumber === 'string' ? body.trackingNumber.trim() : ''
  if (!body || !trackingNumber) return json({ error: 'Send a trackingNumber.' }, 400)
  const events = Array.isArray(body.events) ? (body.events as Record<string, unknown>[]).slice(0, 50) : []
  const list = events.map((e) => ({ at: typeof e.at === 'string' ? e.at : undefined, text: typeof e.text === 'string' ? e.text : '', location: typeof e.location === 'string' ? e.location : undefined, status: isTrackingStatus(e.status) ? e.status : undefined }))
  if (typeof body.text === 'string' || isTrackingStatus(body.status)) list.push({ at: typeof body.at === 'string' ? body.at : undefined, text: typeof body.text === 'string' ? body.text : '', location: typeof body.location === 'string' ? body.location : undefined, status: isTrackingStatus(body.status) ? body.status : undefined })
  const update: TrackingUpdate = { events: list, ...(isTrackingStatus(body.status) ? { status: body.status } : typeof body.status === 'string' ? { status: statusFromText(body.status) } : {}) }
  const { getEngine } = await import('@/lib/engine')
  const engine = (await getEngine()) as never as TrackEngine
  const order = await findOrderByTracking(engine, trackingNumber)
  if (!order) return json({ error: 'No order has that tracking number.' }, 404)
  await recordTracking(engine, order.id as number, trackingNumber, update)
  return json({ ok: true })
}
