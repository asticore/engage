import { NextResponse } from 'next/server'

import { getAdminContext } from '@/admin/auth'
import { normaliseTags } from '@/features/ecommerce/lib/wholesale'
import { rawD1 } from '@/features/ecommerce/server/db'
import * as store from '@/features/ecommerce/server/wholesale'
import { adminRequestRefusal } from '@/features/forms/origin'
import { audit, auditContext } from '@/features/security/auditLog'
import { readSecuritySettingsFromD1 } from '@/features/security/settings'

export const dynamic = 'force-dynamic'

const json = (body: unknown, status = 200): Response => NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } })

async function guard(request: Request, write: boolean) {
  if (write) {
    const refusal = adminRequestRefusal(request)
    if (refusal) return { response: json({ error: refusal }, 403) }
  }
  const context = await getAdminContext()
  if (!context.user) return { response: json({ error: 'Please sign in again.' }, 401) }
  if (!context.isAdmin) return { response: json({ error: 'Only an admin can manage wholesale accounts.' }, 403) }
  return { context }
}

/** GET: applications and customers with tags. */
export async function GET(request: Request): Promise<Response> {
  const g = await guard(request, false)
  if (!g.context) return g.response
  const d1 = (await rawD1()) as never as store.D1
  return json({ applications: await store.listApplications(d1), tagged: await store.listTaggedCustomers(d1) })
}

/** POST { action: 'approve' | 'reject', userId, note? } | { action: 'tags', email, tags } */
export async function POST(request: Request): Promise<Response> {
  const g = await guard(request, true)
  if (!g.context) return g.response
  const body = (await request.json().catch((): null => null)) as Record<string, unknown> | null
  if (!body) return json({ error: 'Invalid request.' }, 400)
  const d1 = (await rawD1()) as never as store.D1
  const settings = await readSecuritySettingsFromD1()
  const ctx = auditContext(request)
  const me = g.context.user as { email?: string }
  const now = new Date().toISOString()

  if (body.action === 'approve' || body.action === 'reject') {
    const userId = Math.floor(Number(body.userId))
    const application = Number.isFinite(userId) && userId > 0 ? await store.getApplication(d1, userId) : null
    if (!application) return json({ error: 'Unknown application.' }, 404)
    const note = typeof body.note === 'string' ? body.note.trim() : ''
    if (body.action === 'approve') {
      // Approving sets up the applicant's company account (they own it) the first time; a company that cannot be made does not stop the approval.
      const organizationId = application.organizationId ?? (await store.createCompanyFor({ id: userId }, application.company, now))
      await store.decideApplication(d1, userId, { status: 'approved', by: me.email ?? '', note, organizationId }, now)
      await store.sendDecisionEmail(application, 'approved', note)
      void audit({ action: 'wholesale.approved', detail: `user ${userId} (${application.company})`, ...ctx }, settings)
      return json({ ok: true, companyCreated: Boolean(organizationId) })
    }
    await store.decideApplication(d1, userId, { status: 'rejected', by: me.email ?? '', note }, now)
    await store.sendDecisionEmail(application, 'rejected', note)
    void audit({ action: 'wholesale.rejected', detail: `user ${userId} (${application.company})`, ...ctx }, settings)
    return json({ ok: true })
  }
  if (body.action === 'tags') {
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
    if (!email) return json({ error: 'Enter the email address of the customer.' }, 400)
    const row = (await d1.prepare('SELECT id FROM eg_users WHERE lower(email) = ?1').bind(email).all<{ id: number }>()).results[0]
    if (!row) return json({ error: 'No account has that email address.' }, 404)
    const tags = normaliseTags(body.tags)
    await store.setTags(d1, Number(row.id), tags)
    void audit({ action: 'customer.tags-changed', detail: `user ${row.id}: ${tags.join(', ') || 'none'}`, ...ctx }, settings)
    return json({ ok: true, tags })
  }
  return json({ error: 'Unknown action.' }, 400)
}
