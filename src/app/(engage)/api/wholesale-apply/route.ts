import { NextResponse } from 'next/server'

import { getEngine } from '@/engine'
import { validateApplication } from '@/features/ecommerce/lib/wholesale'
import { rawD1 } from '@/features/ecommerce/server/db'
import { loadWholesaleConfig, submitApplication, type D1 } from '@/features/ecommerce/server/wholesale'
import { clientKey, hit } from '@/features/security/rateLimit'

export const dynamic = 'force-dynamic'

const reply = (body: unknown, status = 200): Response => NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } })

/**
 * POST { company, taxId?, phone?, message? }: a signed-in customer asks for a wholesale account. The account is the
 * session's own, never a field of the request. The application waits on the Wholesale admin screen. A pending or
 * approved application is not replaced; a rejected one can be sent again.
 */
export async function POST(request: Request): Promise<Response> {
  if (hit(`wholesale-apply:${clientKey(request)}`, 5).limited) return reply({ error: 'Too many attempts. Try again in a little while.' }, 429)
  const engine = (await getEngine()) as unknown as { auth: (a: unknown) => Promise<{ user?: { id?: number | string; email?: string } | null }>; findGlobal: (a: unknown) => Promise<unknown> }
  const cfg = await loadWholesaleConfig(engine)
  if (!cfg.enabled || !cfg.applyOpen) return reply({ error: 'Wholesale applications are closed.' }, 404)
  const { user } = await engine.auth({ headers: request.headers }).catch((): { user: null } => ({ user: null }))
  const id = Number(user?.id)
  if (!user || !Number.isInteger(id) || id < 1) return reply({ error: 'Please sign in first.' }, 401)
  const body = (await request.json().catch((): null => null)) as Record<string, unknown> | null
  if (!body) return reply({ error: 'Invalid request.' }, 400)
  const { value, error } = validateApplication(body)
  if (error) return reply({ error }, 400)
  const d1 = (await rawD1()) as never as D1
  const result = await submitApplication(d1, { id, email: String(user.email ?? '') }, value, new Date().toISOString())
  if (result === 'approved') return reply({ ok: true, status: 'approved' })
  return reply({ ok: true, status: 'pending' })
}
