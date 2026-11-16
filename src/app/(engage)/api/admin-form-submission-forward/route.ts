import { NextResponse } from 'next/server'

import { getAdminContext, hasAdminPanelAccess } from '@/admin/auth'
import { forwardSubmission } from '@/features/forms/notify'
import { adminRequestRefusal } from '@/features/forms/origin'
import { FORMS_SLUG, SUBMISSIONS_SLUG } from '@/features/forms/slugs'
import type { FormDoc } from '@/features/forms/types'
import { audit, auditContext } from '@/features/security/auditLog'
import { readSecuritySettingsFromD1 } from '@/features/security/settings'
import { requestSiteOrigin } from '@/utilities/siteOrigin'

export const dynamic = 'force-dynamic'

const json = (body: unknown, status = 200): Response => NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } })

const NO_PROVIDER = 'No email provider is connected, so nothing was sent. Connect one under Integrations, then try again.'

/**
 * POST /api/admin-form-submission-forward
 *   { id: <entry id>, to: "a@x.com, b@y.com", cc?: string, bcc?: string, note?: string }
 *
 * Sends one entry by email to the address(es) typed, using the connected email
 * provider. Files go as expiring links. The forward is written on the entry
 * (who, when, to whom) and in the activity log. Needs permission to read entries.
 */
export async function POST(request: Request): Promise<Response> {
  try {
    const refusal = adminRequestRefusal(request)
    if (refusal) return json({ error: refusal }, 403)
    const context = await getAdminContext()
    if (!hasAdminPanelAccess(context.user)) return json({ error: 'Unauthorised' }, 401)
    if (!context.permissions.collections?.['form-submissions']?.read) return json({ error: 'Forbidden' }, 403)

    const body = (await request.json().catch((): null => null)) as Record<string, unknown> | null
    const id = Number(body?.id)
    if (!body || !Number.isSafeInteger(id) || id <= 0) return json({ error: 'Choose an entry to forward.' }, 400)
    const text = (value: unknown, max: number): string => (typeof value === 'string' ? value.slice(0, max) : '')

    const engine = context.engine as never as {
      findByID: (args: Record<string, unknown>) => Promise<unknown>
      update: (args: Record<string, unknown>) => Promise<unknown>
    }
    const entry = (await engine.findByID({ collection: SUBMISSIONS_SLUG, id, depth: 0, user: context.user }).catch((): null => null)) as {
      id: number
      form?: number | { id: number }
      values?: Record<string, unknown>
      submittedAt?: string
      createdAt?: string
      notificationStatus?: string
    } | null
    if (!entry) return json({ error: 'That entry was not found.' }, 404)
    const formId = typeof entry.form === 'object' ? entry.form?.id : entry.form
    const form = (await engine.findByID({ collection: FORMS_SLUG, id: formId, depth: 0, overrideAccess: true }).catch((): null => null)) as FormDoc | null
    if (!form) return json({ error: 'The form for that entry no longer exists.' }, 404)

    const result = await forwardSubmission(
      form,
      { id: entry.id, values: entry.values || {}, submittedAt: entry.submittedAt || entry.createdAt },
      { to: text(body.to, 500), cc: text(body.cc, 500), bcc: text(body.bcc, 500), note: text(body.note, 2000), origin: await requestSiteOrigin() },
    )
    if (!result.ok) {
      const unconnected = /switched off|No sending address|not configured/i.test(result.error || '')
      return json({ error: unconnected ? NO_PROVIDER : result.error }, unconnected ? 409 : 400)
    }

    const actor = context.user as { id?: number | string; email?: string }
    const line = `forwarded to ${text(body.to, 200)} by ${actor.email || actor.id || 'someone'} at ${new Date().toISOString()}`
    await engine
      .update({
        collection: SUBMISSIONS_SLUG,
        id,
        overrideAccess: true,
        data: { notificationStatus: [entry.notificationStatus, line].filter(Boolean).join('; ').slice(-1000) },
      })
      .catch((): null => null)

    try {
      const settings = await readSecuritySettingsFromD1()
      const seen = auditContext(request)
      await audit(
        { action: 'export', actorId: actor.id ?? null, actorEmail: actor.email ?? null, collectionSlug: SUBMISSIONS_SLUG, documentId: id, detail: `Forwarded form entry ${id} by email to ${result.sent} address(es)`, ip: seen.ip, userAgent: seen.userAgent },
        settings,
      )
    } catch {
      // A missing log line must not undo a sent email.
    }
    return json({ ok: true, sent: result.sent })
  } catch (error) {
    console.error('admin-form-submission-forward POST error:', error)
    return json({ error: 'Internal server error' }, 500)
  }
}
