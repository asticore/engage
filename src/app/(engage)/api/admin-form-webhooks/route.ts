import { NextResponse } from 'next/server'

import { getAdminContext, isAdminUser } from '@/admin/auth'
import { normaliseFormConfig } from '@/features/forms/config'
import { withResolvedFields } from '@/features/forms/layout'
import { runWebhookRetry } from '@/features/forms/maintenance'
import { FORM_DATA_RECIPES } from '@/features/forms/recipes'
import { adminRequestRefusal } from '@/features/forms/origin'
import { FORMS_SLUG, SUBMISSIONS_SLUG } from '@/features/forms/slugs'
import type { FormDoc } from '@/features/forms/types'
import { buildPayload, deliver, sampleValues, type WebhookAttempt } from '@/features/forms/webhooks'

export const dynamic = 'force-dynamic'

const json = (body: unknown, status = 200): Response => NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } })

type Engine = {
  find: (args: Record<string, unknown>) => Promise<{ docs: unknown[] }>
  findByID: (args: Record<string, unknown>) => Promise<unknown>
  update: (args: Record<string, unknown>) => Promise<unknown>
}

/**
 * GET  /api/admin-form-webhooks?form=<id>
 *   The delivery log of one form: the latest attempts across its entries, newest first
 *   (webhook, host, attempt number, time, status code, error, entry id).
 * POST /api/admin-form-webhooks
 *   { action: 'test', form: <id>, webhookId } sends a made-up entry (event form.test) to one saved webhook.
 *   { action: 'resend', entry: <id>, webhookId } sends one entry to one webhook again, even if it worked.
 *
 * Administrators only: a webhook sends entry data to another system.
 */
export async function GET(request: Request): Promise<Response> {
  try {
    const context = await getAdminContext()
    if (!isAdminUser(context.user)) return json({ error: 'Unauthorised' }, 401)
    if (new URL(request.url).searchParams.get('docs') === '1') {
      return new Response(FORM_DATA_RECIPES, { headers: { 'Content-Type': 'text/markdown; charset=utf-8', 'Cache-Control': 'no-store' } })
    }
    const form = Number(new URL(request.url).searchParams.get('form'))
    if (!Number.isSafeInteger(form) || form <= 0) return json({ error: 'Choose a form.' }, 400)
    const engine = context.engine as never as Engine
    const result = await engine.find({
      collection: SUBMISSIONS_SLUG,
      where: { and: [{ form: { equals: form } }, { webhookState: { in: ['ok', 'retry', 'failed'] } }] },
      sort: '-createdAt',
      limit: 30,
      depth: 0,
      overrideAccess: true,
    })
    const rows = (result.docs as { id: number; webhookDeliveries?: WebhookAttempt[] }[])
      .flatMap((entry) => (entry.webhookDeliveries || []).map((attempt) => ({ entry: entry.id, ...attempt })))
      .sort((a, b) => (a.at < b.at ? 1 : -1))
      .slice(0, 100)
    return json({ deliveries: rows })
  } catch (error) {
    console.error('admin-form-webhooks GET error:', error)
    return json({ error: 'Internal server error' }, 500)
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    const refusal = adminRequestRefusal(request)
    if (refusal) return json({ error: refusal }, 403)
    const context = await getAdminContext()
    if (!isAdminUser(context.user)) return json({ error: 'Unauthorised' }, 401)
    const body = (await request.json().catch((): null => null)) as Record<string, unknown> | null
    if (!body || typeof body.webhookId !== 'string') return json({ error: 'Choose a webhook.' }, 400)
    const engine = context.engine as never as Engine

    if (body.action === 'test') {
      const formId = Number(body.form)
      const form = (await engine.findByID({ collection: FORMS_SLUG, id: formId, depth: 0, overrideAccess: true }).catch((): null => null)) as FormDoc | null
      if (!form) return json({ error: 'That form was not found.' }, 404)
      const hook = (normaliseFormConfig(form.formConfig).webhooks || []).find((entry) => entry.id === body.webhookId)
      if (!hook?.url) return json({ error: 'Save the form with this webhook\'s address first, then send the test.' }, 400)
      const resolved = withResolvedFields(form)
      const at = new Date().toISOString()
      const payload = buildPayload(resolved, resolved.fields, 'test', sampleValues(resolved.fields), at, `test-${hook.id}-${Date.now()}`, {
        hook,
        meta: { sourceUrl: 'https://example.com/contact', status: 'new' },
        event: 'form.test',
      })
      const attempt = await deliver(hook, payload, 1)
      return json({ ok: attempt.ok, status: attempt.status, error: attempt.error })
    }

    if (body.action === 'resend') {
      const entryId = Number(body.entry)
      const entry = (await engine.findByID({ collection: SUBMISSIONS_SLUG, id: entryId, depth: 0, overrideAccess: true }).catch((): null => null)) as
        | { id: number; form?: number | { id: number }; values?: Record<string, unknown>; submittedAt?: string; createdAt?: string; webhookDeliveries?: WebhookAttempt[]; sourceUrl?: string; consent?: unknown; status?: string }
        | null
      if (!entry) return json({ error: 'That entry was not found.' }, 404)
      const formId = typeof entry.form === 'object' ? entry.form?.id : entry.form
      const form = (await engine.findByID({ collection: FORMS_SLUG, id: formId, depth: 0, overrideAccess: true }).catch((): null => null)) as FormDoc | null
      if (!form) return json({ error: 'The form for that entry no longer exists.' }, 404)
      const sent = await runWebhookRetry(engine as never, form, entry, new Date(), fetch, true, body.webhookId)
      if (sent === 0) return json({ error: 'That webhook is not set up on this form any more.' }, 404)
      return json({ ok: true })
    }
    return json({ error: 'Unknown action.' }, 400)
  } catch (error) {
    console.error('admin-form-webhooks POST error:', error)
    return json({ error: 'Internal server error' }, 500)
  }
}
