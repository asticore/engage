import { NextResponse } from 'next/server'

import { isTrackingStatus } from '@/features/ecommerce/lib/tracking'
import { authorizeOrders, parseOrderId } from '@/features/ecommerce/server/adminOrder'
import { recordTracking, type TrackEngine } from '@/features/ecommerce/server/tracking'

export const dynamic = 'force-dynamic'

/** POST { trackingNumber, status, text? } - staff add a tracking update by hand, for carriers that cannot be asked. Needs orders.update. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const auth = await authorizeOrders('update')
  if (!auth.ok) return auth.response
  const id = parseOrderId((await params).id)
  if (id === null) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
  const trackingNumber = typeof body.trackingNumber === 'string' ? body.trackingNumber : ''
  if (!trackingNumber || !isTrackingStatus(body.status)) return NextResponse.json({ error: 'Pick a parcel and a status.' }, { status: 400 })
  const text = typeof body.text === 'string' ? body.text.trim().slice(0, 300) : ''
  const ok = await recordTracking(auth.engine as unknown as TrackEngine, id, trackingNumber, { status: body.status, events: [{ status: body.status, text: text || undefined }] })
  return ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: 'That parcel is not on this order.' }, { status: 404 })
}
