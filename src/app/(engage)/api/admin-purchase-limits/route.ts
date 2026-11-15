import { NextResponse } from 'next/server'

import { getAdminContext } from '@/admin/auth'
import { rawD1 } from '@/features/ecommerce/server/db'
import { adminRequestRefusal } from '@/features/forms/origin'
import { parseRule } from '@/features/purchaseLimits/logic'
import * as store from '@/features/purchaseLimits/store'
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
  if (!(await getFeatureFlags()).limits) return json({ error: 'Switch Purchase limits on in Site Settings first.' }, 409)
  return null
}

/** GET: the rules, the products to pick from, recent refused attempts and counts. Admin only. */
export async function GET(request: Request): Promise<Response> {
  const denied = await guard(request, false)
  if (denied) return denied
  const d1 = (await rawD1()) as never as store.D1
  const products = await (d1 as unknown as { prepare: (s: string) => { bind: () => { all: <T>() => Promise<{ results: T[] }> } } }).prepare('SELECT id, title FROM eg_products ORDER BY title LIMIT 500').bind().all<{ id: number; title: string }>().then((r) => r.results).catch((): { id: number; title: string }[] => [])
  return json({ rules: await store.listRules(d1), products, blocks: await store.listBlocks(d1, 100), counts: await store.blockCounts(d1) })
}

/** POST { action: saveRule | deleteRule, id?, ... }. Admin only. */
export async function POST(request: Request): Promise<Response> {
  const denied = await guard(request, true)
  if (denied) return denied
  const body = (await request.json().catch((): null => null)) as Record<string, unknown> | null
  if (!body) return json({ error: 'Send the details.' }, 400)
  const d1 = (await rawD1()) as never as store.D1
  const id = Number(body.id)
  const hasId = Number.isInteger(id) && id > 0
  switch (body.action) {
    case 'saveRule': {
      const parsed = parseRule(body)
      if (parsed.ok === false) return json({ error: parsed.error }, 400)
      await store.saveRule(d1, hasId ? id : null, parsed.value, new Date().toISOString())
      return json({ ok: true })
    }
    case 'deleteRule':
      if (!hasId) return json({ error: 'Pick one.' }, 400)
      await store.deleteRule(d1, id)
      return json({ ok: true })
    default:
      return json({ error: 'Unknown action.' }, 400)
  }
}
