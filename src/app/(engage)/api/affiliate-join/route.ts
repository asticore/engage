import { NextResponse } from 'next/server'

import { MAX_AFFILIATES, newToken, suggestCode } from '@/features/affiliates/core'
import * as store from '@/features/affiliates/store'
import { rawD1 } from '@/features/ecommerce/server/db'
import { clientKey, hit } from '@/features/security/rateLimit'
import { getFeatureFlags } from '@/utilities/features'

export const dynamic = 'force-dynamic'

const text = (v: unknown, max: number): string => (typeof v === 'string' ? v.trim().slice(0, max) : '')

/**
 * POST { name, email, website? }: someone asks to become an affiliate. `website` is a honeypot field. Creates the
 * affiliate as pending, or active when automatic approval is on (Affiliates screen). Returns the private
 * dashboard link, because there is no sign-in for affiliates yet.
 */
export async function POST(request: Request): Promise<Response> {
  const reply = (body: unknown, status = 200): Response => NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } })
  if (!(await getFeatureFlags()).affiliates) return reply({ error: 'Affiliates are not switched on.' }, 404)
  if (hit(`affiliate-join:${clientKey(request)}`, 5).limited) return reply({ error: 'Too many attempts. Try again in a little while.' }, 429)
  const body = (await request.json().catch((): null => null)) as Record<string, unknown> | null
  if (!body) return reply({ error: 'Invalid request.' }, 400)
  // A filled honeypot gets a normal-looking answer and nothing is saved.
  if (text(body.website, 100)) return reply({ ok: true, status: 'pending' })
  const name = text(body.name, 80)
  const email = text(body.email, 200).toLowerCase()
  if (!name) return reply({ error: 'Please enter your name.' }, 400)
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return reply({ error: 'Please enter a valid email address.' }, 400)
  const d1 = (await rawD1()) as never as store.D1
  if (await store.emailTaken(d1, email)) return reply({ error: 'That email is already registered. Ask the site owner for your dashboard link.' }, 409)
  if ((await store.countAffiliates(d1)) >= MAX_AFFILIATES) return reply({ error: 'The program is full right now.' }, 409)
  const settings = await store.getSettings(d1)
  let code = suggestCode(name)
  for (let i = 0; i < 5 && (await store.codeTaken(d1, code)); i++) code = suggestCode(name)
  const token = newToken()
  const status = settings.autoApprove ? 'active' : 'pending'
  const newId = await store.createAffiliate(d1, { code, name, email, status, token }, new Date().toISOString())
  if (status === 'active') await (await import('@/features/affiliates/service')).sendAffiliateEmail('approved', newId, {})
  return reply({ ok: true, status, code, dashboard: `/affiliates/dashboard?token=${token}` })
}
