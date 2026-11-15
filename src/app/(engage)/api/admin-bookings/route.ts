import { NextResponse } from 'next/server'

import { getAdminContext } from '@/admin/auth'
import { hoursToText, isBookingStatus, parseHoursText, parseOverride, parseResourceInput, parseTypeInput } from '@/features/bookings/logic'
import * as store from '@/features/bookings/store'
import { rawD1 } from '@/features/ecommerce/server/db'
import { adminRequestRefusal } from '@/features/forms/origin'
import { getFeatureFlags } from '@/utilities/features'

export const dynamic = 'force-dynamic'

const json = (body: unknown, status = 200): Response => NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } })

async function guard(request: Request, write: boolean): Promise<Response | null> {
  if (write) {
    const refusal = adminRequestRefusal(request)
    if (refusal) return json({ error: refusal }, 403)
  }
  const ctx = await getAdminContext()
  if (!ctx.user) return json({ error: 'Unauthorised' }, 401)
  if (!ctx.isAdmin) return json({ error: 'Forbidden' }, 403)
  if (!(await getFeatureFlags()).bookings) return json({ error: 'Switch Bookings on in Site Settings first.' }, 409)
  return null
}

/** GET: resources with their hours and overrides, booking types and recent bookings. Admin only. */
export async function GET(request: Request): Promise<Response> {
  const denied = await guard(request, false)
  if (denied) return denied
  const d1 = (await rawD1()) as never as store.D1
  const resources = await store.listResources(d1)
  const detailed = await Promise.all(resources.map(async (r) => ({ ...r, hours: hoursToText(await store.rulesFor(d1, r.id)), overrides: await store.overridesFor(d1, r.id) })))
  const status = new URL(request.url).searchParams.get('status')
  const bookings = await store.listBookings(d1, { status: isBookingStatus(status) ? status : undefined })
  return json({ resources: detailed, types: await store.listTypes(d1), bookings })
}

/** POST { action, ... }: saveResource, deleteResource, setHours, addOverride, deleteOverride, saveType, deleteType, setStatus. Admin only. */
export async function POST(request: Request): Promise<Response> {
  const denied = await guard(request, true)
  if (denied) return denied
  const body = (await request.json().catch((): null => null)) as Record<string, unknown> | null
  if (!body) return json({ error: 'Send the details.' }, 400)
  const d1 = (await rawD1()) as never as store.D1
  const now = new Date().toISOString()
  const id = Number(body.id)
  const hasId = Number.isInteger(id) && id > 0
  switch (body.action) {
    case 'saveResource': {
      const parsed = parseResourceInput(body)
      if (parsed.ok === false) return json({ error: parsed.error }, 400)
      await store.saveResource(d1, hasId ? id : null, parsed.value, now)
      return json({ ok: true })
    }
    case 'deleteResource':
      if (!hasId) return json({ error: 'Pick one.' }, 400)
      await store.deleteResource(d1, id)
      return json({ ok: true })
    case 'setHours': {
      if (!hasId || !(await store.getResource(d1, id))) return json({ error: 'Pick a person or place first.' }, 400)
      const parsed = parseHoursText(typeof body.hours === 'string' ? body.hours : '')
      if (parsed.ok === false) return json({ error: parsed.error }, 400)
      await store.setRules(d1, id, parsed.rules)
      return json({ ok: true })
    }
    case 'addOverride': {
      const resourceId = Number(body.resourceId)
      if (!Number.isInteger(resourceId) || !(await store.getResource(d1, resourceId))) return json({ error: 'Pick a person or place first.' }, 400)
      const parsed = parseOverride(body)
      if (parsed.ok === false) return json({ error: parsed.error }, 400)
      await store.addOverride(d1, resourceId, parsed.value)
      return json({ ok: true })
    }
    case 'deleteOverride':
      if (!hasId) return json({ error: 'Pick one.' }, 400)
      await store.deleteOverride(d1, id)
      return json({ ok: true })
    case 'saveType': {
      const parsed = parseTypeInput(body)
      if (parsed.ok === false) return json({ error: parsed.error }, 400)
      const error = await store.saveType(d1, hasId ? id : null, parsed.value, now)
      return error ? json({ error }, 409) : json({ ok: true })
    }
    case 'deleteType':
      if (!hasId) return json({ error: 'Pick one.' }, 400)
      await store.deleteType(d1, id)
      return json({ ok: true })
    case 'setStatus': {
      if (!hasId || !isBookingStatus(body.status)) return json({ error: 'Pick a booking and a status.' }, 400)
      await store.setBookingStatus(d1, id, body.status, now)
      return json({ ok: true })
    }
    default:
      return json({ error: 'Unknown action.' }, 400)
  }
}
