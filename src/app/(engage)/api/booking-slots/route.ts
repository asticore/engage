import { NextResponse } from 'next/server'

import { availability } from '@/features/bookings/service'
import * as store from '@/features/bookings/store'
import { rawD1 } from '@/features/ecommerce/server/db'
import { hitShared } from '@/features/security/rateLimit'
import { parseIsoDate, localDateIn } from '@/features/editScreens/timeZone'
import { getFeatureFlags } from '@/utilities/features'

export const dynamic = 'force-dynamic'

const json = (body: unknown, status = 200): Response => NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } })

/** GET ?type=<slug>&from=YYYY-MM-DD&days=14: the bookable times for a booking type. 404 until Bookings is switched on. */
export async function GET(request: Request): Promise<Response> {
  if (!(await getFeatureFlags()).bookings) return json({ error: 'Not found' }, 404)
  const ip = request.headers.get('cf-connecting-ip') || request.headers.get('x-real-ip') || 'unknown'
  if ((await hitShared(`booking-slots:${ip}`, 60)).limited) return json({ error: 'Too many requests. Try again in a minute.' }, 429)
  const url = new URL(request.url)
  const d1 = (await rawD1()) as never as store.D1
  const type = await store.getTypeBySlug(d1, String(url.searchParams.get('type') ?? '')).catch((): null => null)
  if (!type || !type.active) return json({ error: 'Not found' }, 404)
  const days = Math.max(1, Math.min(Number(url.searchParams.get('days')) || 14, 31))
  const now = new Date()
  const fromParam = url.searchParams.get('from')
  const from = fromParam && parseIsoDate(fromParam) ? fromParam : null
  const resource = type.resourceId ? await store.getResource(d1, type.resourceId) : null
  const result = await availability(d1, type, from ?? localDateIn(now, resource?.timeZone ?? 'Australia/Sydney'), days, now)
  if (!result) return json({ error: 'Not found' }, 404)
  return json({ type: { title: type.title, description: type.description, durationMinutes: type.durationMinutes, locationText: type.locationText }, ...result })
}
